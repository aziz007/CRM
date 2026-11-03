import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CALL_OUTCOMES, Call } from '../../core/call.models';
import { CallService } from '../../core/call.service';

export interface CallLogDialogData {
  /** Set when completing a pending call started with click-to-call. */
  pendingCall?: Call;
  /** Set when logging a call that was not started from the app. */
  leadId?: string;
  leadName: string;
}

@Component({
  selector: 'app-call-log-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Log call with {{ data.leadName }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline">
          <mat-label>Outcome</mat-label>
          <mat-select formControlName="outcome">
            @for (o of outcomes; track o) {
              <mat-option [value]="o">{{ o }}</mat-option>
            }
          </mat-select>
          @if (form.controls.outcome.invalid && form.controls.outcome.touched) {
            <mat-error>Choose an outcome.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Duration (minutes)</mat-label>
          <input matInput type="number" min="0" max="1440" formControlName="minutes" />
          <mat-hint>Leave as 0 if unknown.</mat-hint>
        </mat-form-field>

        @if (!data.pendingCall) {
          <mat-form-field appearance="outline">
            <mat-label>When did the call start?</mat-label>
            <input matInput type="datetime-local" formControlName="startedAt" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="3" formControlName="notes"></textarea>
        </mat-form-field>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (warning()) {
          <p class="warning" role="status">{{ warning() }}</p>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="ref.close()">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .content { display: flex; flex-direction: column; min-width: 320px; }
    .error { color: #b3261e; }
    .warning { color: #8a5a00; }
  `],
})
export class CallLogDialogComponent {
  readonly data = inject<CallLogDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<CallLogDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly calls = inject(CallService);

  readonly outcomes = CALL_OUTCOMES;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly warning = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    outcome: [this.data.pendingCall?.outcome ?? ('' as string), [Validators.required]],
    minutes: [this.data.pendingCall ? Math.round((this.data.pendingCall.durationSec ?? 0) / 60) : 0, [Validators.min(0), Validators.max(1440)]],
    startedAt: [toLocalInput(new Date())],
    notes: [this.data.pendingCall?.notes ?? ''],
  });

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();
    const durationSec = Math.round(Number(raw.minutes) * 60);
    const outcome = raw.outcome as (typeof CALL_OUTCOMES)[number];

    const request = this.data.pendingCall
      ? this.calls.update(this.data.pendingCall.id, { outcome, durationSec, notes: raw.notes })
      : this.calls.create({
          leadId: this.data.leadId,
          outcome,
          durationSec,
          notes: raw.notes,
          startedAt: new Date(raw.startedAt).toISOString(),
        });

    request.subscribe({
      next: (call) => {
        this.saving.set(false);
        if (call.warning) {
          this.warning.set(call.warning);
          setTimeout(() => this.ref.close(true), 1800);
        } else {
          this.ref.close(true);
        }
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err instanceof HttpErrorResponse && err.error?.error ? err.error.error : 'Could not save the call. Please try again.');
      },
    });
  }
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
