import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth.service';
import { AssignableUser, CURRENCIES, LEAD_SOURCES, LEAD_STATUSES, LeadStatus, PROPERTY_TYPES, PURPOSES, Lead } from '../../core/lead.models';
import { LeadService, LeadInput } from '../../core/lead.service';

const budgetOrder = (group: AbstractControl): ValidationErrors | null => {
  const min = group.get('budgetMin')?.value;
  const max = group.get('budgetMax')?.value;
  return min != null && max != null && min !== '' && max !== '' && Number(min) > Number(max)
    ? { budgetOrder: true }
    : null;
};

@Component({
  selector: 'app-lead-form',
  imports: [
    ReactiveFormsModule, RouterLink,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  templateUrl: './lead-form.component.html',
  styleUrl: './lead-form.component.scss',
})
export class LeadFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leads = inject(LeadService);
  private readonly snack = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly statuses = LEAD_STATUSES;
  readonly sources = LEAD_SOURCES;
  readonly propertyTypes = PROPERTY_TYPES;
  readonly purposes = PURPOSES;
  readonly currencies = CURRENCIES;

  readonly agents = signal<AssignableUser[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly duplicateId = signal<string | null>(null);
  editingId: string | null = null;

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(80)]],
      lastName: ['', [Validators.maxLength(80)]],
      phone: ['', [Validators.required]],
      email: ['', [Validators.email]],
      country: ['AE' as 'AE' | 'PK', [Validators.required]],
      location: ['', [Validators.maxLength(120)]],
      purpose: ['Buy'],
      propertyType: ['Apartment'],
      budgetMin: [null as number | null, [Validators.min(0)]],
      budgetMax: [null as number | null, [Validators.min(0)]],
      currency: ['AED'],
      source: ['Other'],
      status: ['New' as LeadStatus],
      assignedTo: [''],
      notes: ['', [Validators.maxLength(5000)]],
    },
    { validators: budgetOrder }
  );

  ngOnInit(): void {
    this.editingId = this.route.snapshot.paramMap.get('id');
    if (this.auth.isAdmin()) {
      this.leads.assignableUsers().subscribe({ next: (res) => this.agents.set(res.items) });
    }
    if (this.editingId) {
      this.leads.get(this.editingId).subscribe({
        next: (lead) => this.patchForm(lead),
        error: () => this.router.navigate(['/leads']),
      });
    } else {
      const me = this.auth.currentUser();
      if (me) {
        this.form.patchValue({ country: me.country, assignedTo: me.id });
      }
    }
    // Agents do not reassign; keep the control empty for them.
    if (!this.auth.isAdmin()) {
      this.form.controls.assignedTo.disable({ emitEvent: false });
    }
  }

  private patchForm(lead: Lead): void {
    const assignee = typeof lead.assignedTo === 'string' ? lead.assignedTo : lead.assignedTo?.id;
    this.form.patchValue({
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      country: lead.country,
      location: lead.location,
      purpose: lead.purpose,
      propertyType: lead.propertyType,
      budgetMin: lead.budgetMin ?? null,
      budgetMax: lead.budgetMax ?? null,
      currency: lead.currency,
      source: lead.source,
      status: lead.status,
      assignedTo: assignee ?? '',
      notes: lead.notes,
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.duplicateId.set(null);

    const raw = this.form.getRawValue();
    const input: LeadInput = {
      ...raw,
      email: raw.email.trim(),
      budgetMin: raw.budgetMin === null || raw.budgetMin === ('' as unknown) ? null : Number(raw.budgetMin),
      budgetMax: raw.budgetMax === null || raw.budgetMax === ('' as unknown) ? null : Number(raw.budgetMax),
    };
    // Only admins may send assignedTo; the API ignores it for agents anyway.
    if (!this.auth.isAdmin()) {
      delete input.assignedTo;
    }

    const request = this.editingId
      ? this.leads.update(this.editingId, input)
      : this.leads.create(input);

    request.subscribe({
      next: (lead) => {
        this.saving.set(false);
        this.snack.open(this.editingId ? 'Lead updated' : 'Lead created', 'Close', { duration: 3000 });
        this.router.navigate(['/leads', lead.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.duplicateId.set(err.error?.duplicateId ?? null);
        }
        this.error.set(
          err instanceof HttpErrorResponse && err.error?.error
            ? err.error.error
            : 'Could not save the lead. Please check the fields and try again.'
        );
      },
    });
  }
}
