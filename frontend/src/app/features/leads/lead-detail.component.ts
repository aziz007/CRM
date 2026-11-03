import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth.service';
import { Activity, AssignableUser, Lead, LEAD_STATUSES, LeadStatus, assigneeName } from '../../core/lead.models';
import { LeadService } from '../../core/lead.service';

@Component({
  selector: 'app-lead-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.scss',
})
export class LeadDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leads = inject(LeadService);
  private readonly snack = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly statuses = LEAD_STATUSES;
  readonly lead = signal<Lead | null>(null);
  readonly activities = signal<Activity[]>([]);
  readonly users = signal<AssignableUser[]>([]);
  readonly notFound = signal(false);
  readonly busy = signal(false);
  readonly assigneeName = assigneeName;
  readonly assigneeIdOf = assigneeIdOf;

  readonly noteControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });

  private id = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    if (this.auth.isAdmin()) {
      this.leads.assignableUsers().subscribe({ next: (res) => this.users.set(res.items) });
    }
  }

  load(): void {
    this.leads.get(this.id).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.notFound.set(false);
      },
      error: () => this.notFound.set(true),
    });
    this.leads.activities(this.id).subscribe({
      next: (res) => this.activities.set(res.items),
    });
  }

  changeStatus(status: LeadStatus): void {
    const current = this.lead();
    if (!current || status === current.status) return;
    this.busy.set(true);
    this.leads.update(this.id, { status }).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.busy.set(false);
        this.reloadActivities();
        this.snack.open(`Status set to ${status}`, 'Close', { duration: 2500 });
      },
      error: () => this.fail('Could not update the status.'),
    });
  }

  reassign(agentId: string): void {
    if (!this.lead() || !agentId) return;
    this.busy.set(true);
    this.leads.update(this.id, { assignedTo: agentId }).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.busy.set(false);
        this.reloadActivities();
        this.snack.open('Lead reassigned', 'Close', { duration: 2500 });
      },
      error: () => this.fail('Could not reassign the lead.'),
    });
  }

  addNote(): void {
    if (this.noteControl.invalid) {
      this.noteControl.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.leads.addNote(this.id, this.noteControl.value.trim()).subscribe({
      next: () => {
        this.noteControl.reset('');
        this.busy.set(false);
        this.reloadActivities();
      },
      error: () => this.fail('Could not save the note.'),
    });
  }

  archive(): void {
    if (!confirm('Archive this lead? It will be hidden from the list but its history is kept.')) return;
    this.leads.archive(this.id).subscribe({
      next: () => {
        this.snack.open('Lead archived', 'Close', { duration: 2500 });
        this.router.navigate(['/leads']);
      },
      error: () => this.fail('Could not archive the lead.'),
    });
  }

  canEdit(): boolean {
    const lead = this.lead();
    const me = this.auth.currentUser();
    return !!lead && !!me && (me.role === 'admin' || assigneeIdOf(lead) === me.id);
  }

  private reloadActivities(): void {
    this.leads.activities(this.id).subscribe({ next: (res) => this.activities.set(res.items) });
  }

  private fail(message: string): void {
    this.busy.set(false);
    this.snack.open(message, 'Close', { duration: 4000 });
  }
}

function assigneeIdOf(lead: Lead): string {
  return typeof lead.assignedTo === 'string' ? lead.assignedTo : lead.assignedTo?.id ?? '';
}
