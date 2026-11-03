import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { CallService } from '../../core/call.service';
import { Call } from '../../core/call.models';
import { CallLogDialogComponent, CallLogDialogData } from '../calls/call-log-dialog.component';
import { Task } from '../../core/task.models';
import { TaskService } from '../../core/task.service';
import { TaskDialogComponent, TaskDialogData } from '../tasks/task-dialog.component';
import { AuthService } from '../../core/auth.service';
import { Activity, AssignableUser, Lead, LEAD_STATUSES, LeadStatus, assigneeName } from '../../core/lead.models';
import { LeadService } from '../../core/lead.service';

@Component({
  selector: 'app-lead-detail',
  imports: [DatePipe, MatDialogModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.scss',
})
export class LeadDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leads = inject(LeadService);
  private readonly snack = inject(MatSnackBar);
  private readonly calls = inject(CallService);
  private readonly tasks = inject(TaskService);
  readonly openTasks = signal<Task[]>([]);
  private readonly dialog = inject(MatDialog);
  readonly auth = inject(AuthService);

  readonly statuses = LEAD_STATUSES;
  readonly pendingCall = signal<Call | null>(null);
  readonly callHistory = signal<Call[]>([]);
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
    this.loadCalls();
    this.loadTasks();
  }

  loadTasks(): void {
    this.tasks.list({ lead: this.id, status: 'open', limit: 50 }).subscribe({
      next: (page) => this.openTasks.set(page.items),
    });
  }

  addTask(task?: Task): void {
    const data: TaskDialogData = task
      ? { task }
      : { leadId: this.id, leadName: `${this.lead()?.firstName ?? ''} ${this.lead()?.lastName ?? ''}`.trim() };
    this.dialog
      .open(TaskDialogComponent, { data, width: '520px' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snack.open(task ? 'Task updated' : 'Task added', 'Close', { duration: 2500 });
          this.loadTasks();
          this.reloadActivities();
        }
      });
  }

  completeTask(task: Task): void {
    this.tasks.update(task.id, { status: 'done' }).subscribe({
      next: () => {
        this.loadTasks();
        this.reloadActivities();
      },
      error: () => this.fail('Could not update the task.'),
    });
  }

  private loadCalls(): void {
    this.calls.list({ lead: this.id, limit: 50 }).subscribe({
      next: (page) => {
        this.callHistory.set(page.items);
        const pending = page.items.find((c) => c.status === 'pending');
        this.pendingCall.set(pending ?? null);
      },
    });
  }

  /** Starts a call through the phone's dialer and records it as pending until the outcome is logged. */
  callLead(): void {
    this.busy.set(true);
    this.calls.start(this.id).subscribe({
      next: ({ call, dialNumber }) => {
        this.busy.set(false);
        this.pendingCall.set(call);
        this.loadCalls();
        window.location.href = `tel:${dialNumber}`;
      },
      error: () => this.fail('Could not start the call. Please try again.'),
    });
  }

  logCall(pending: Call | null): void {
    const lead = this.lead();
    const data: CallLogDialogData = pending
      ? { pendingCall: pending, leadName: `${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim() }
      : { leadId: this.id, leadName: `${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim() };
    this.dialog
      .open(CallLogDialogComponent, { data, width: '480px' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snack.open('Call saved', 'Close', { duration: 2500 });
          this.loadCalls();
          this.reloadActivities();
        }
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
