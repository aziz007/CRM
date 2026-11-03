import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { FormControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, switchMap, of, Observable } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { AssignableUser } from '../../core/lead.models';
import { LeadService } from '../../core/lead.service';
import { Lead } from '../../core/lead.models';
import { Task, TASK_PRIORITIES, taskLeadId } from '../../core/task.models';
import { TaskService } from '../../core/task.service';

export interface TaskDialogData {
  task?: Task;
  leadId?: string;
  leadName?: string;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

@Component({
  selector: 'app-task-dialog',
  imports: [TitleCasePipe, ReactiveFormsModule, MatDialogModule, MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.task ? 'Edit task' : 'New task' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline">
          <mat-label>Task</mat-label>
          <input matInput formControlName="title" placeholder="Call back about the villa viewing" />
          @if (form.controls.title.touched && form.controls.title.invalid) {
            <mat-error>Enter a short description of the task.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Due</mat-label>
          <input matInput type="datetime-local" formControlName="due" />
          @if (form.controls.due.touched && form.controls.due.invalid) {
            <mat-error>Choose a due date and time.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority">
            @for (p of priorities; track p) {
              <mat-option [value]="p">{{ p | titlecase }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (!data.leadId && !data.task?.lead) {
          <mat-form-field appearance="outline">
            <mat-label>Lead (optional)</mat-label>
            <input matInput [formControl]="leadSearch" [matAutocomplete]="auto" placeholder="Search by name or phone" />
            <mat-autocomplete #auto="matAutocomplete" [displayWith]="displayLead" (optionSelected)="pickLead($event.option.value)">
              @for (lead of leadOptions(); track lead.id) {
                <mat-option [value]="lead">{{ lead.firstName }} {{ lead.lastName }} · {{ lead.phone }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
        } @else {
          <p class="lead-line">Lead: <strong>{{ data.leadName || 'Linked lead' }}</strong></p>
        }

        @if (auth.isAdmin() && users().length) {
          <mat-form-field appearance="outline">
            <mat-label>Assigned to</mat-label>
            <mat-select formControlName="assignedTo">
              @for (u of users(); track u.id) {
                <mat-option [value]="u.id">{{ u.name }} ({{ u.role }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Details (optional)</mat-label>
          <textarea matInput rows="3" formControlName="description"></textarea>
        </mat-form-field>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="ref.close()">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .content { display: flex; flex-direction: column; min-width: 340px; }
    .error { color: #b3261e; }
    .lead-line { margin: 8px 0 16px; }
  `],
})
export class TaskDialogComponent implements OnInit {
  readonly data = inject<TaskDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<TaskDialogComponent>);
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly tasks = inject(TaskService);
  private readonly leads = inject(LeadService);

  readonly priorities = TASK_PRIORITIES;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly users = signal<AssignableUser[]>([]);
  readonly leadOptions = signal<Lead[]>([]);
  readonly leadSearch = new FormControl<string | Lead>('', { nonNullable: true });
  private selectedLeadId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    due: [this.defaultDue(), [Validators.required]],
    priority: ['normal' as 'low' | 'normal' | 'high'],
    assignedTo: [''],
    description: ['', [Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    if (this.data.task) {
      const t = this.data.task;
      this.form.patchValue({
        title: t.title,
        due: toLocalInput(new Date(t.dueAt)),
        priority: t.priority,
        description: t.description,
        assignedTo: typeof t.assignedTo === 'string' ? t.assignedTo : t.assignedTo.id,
      });
    } else {
      const me = this.auth.currentUser();
      if (me) this.form.patchValue({ assignedTo: me.id });
    }
    if (this.auth.isAdmin()) {
      this.leads.assignableUsers().subscribe({ next: (res) => this.users.set(res.items) });
    }
    this.leadSearch.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value): Observable<{ items: Lead[] }> => {
          if (typeof value !== 'string' || value.trim().length < 2) return of({ items: [] });
          return this.leads.list({ search: value.trim(), limit: 8 });
        })
      )
      .subscribe((page) => this.leadOptions.set(page.items));
  }

  displayLead = (value: Lead | string | null): string => {
    if (!value || typeof value === 'string') return value ?? '';
    return `${value.firstName} ${value.lastName}`.trim();
  };

  pickLead(lead: Lead): void {
    this.selectedLeadId = lead.id;
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();
    const existingLeadId = this.data.task ? taskLeadId(this.data.task) : null;
    const leadId = this.data.leadId ?? existingLeadId ?? this.selectedLeadId ?? undefined;
    const input = {
      title: raw.title.trim(),
      description: raw.description,
      dueAt: new Date(raw.due).toISOString(),
      priority: raw.priority,
      leadId,
      assignedTo: this.auth.isAdmin() && raw.assignedTo ? raw.assignedTo : undefined,
    };

    const request = this.data.task
      ? this.tasks.update(this.data.task.id, input)
      : this.tasks.create(input);

    request.subscribe({
      next: () => this.ref.close(true),
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err instanceof HttpErrorResponse && err.error?.error ? err.error.error : 'Could not save the task.');
      },
    });
  }

  private defaultDue(): string {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return toLocalInput(d);
  }
}
