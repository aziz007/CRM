import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ALLOWED_AUDIO, MAX_RECORDING_MB, RecordingService } from '../../core/recording.service';

export interface RecordingDialogData {
  callId: string;
  leadName: string;
}

@Component({
  selector: 'app-recording-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Upload recording</h2>
    <mat-dialog-content class="content">
      <p class="muted">Call with {{ data.leadName }}</p>

      <div class="consent">
        <strong>Before uploading:</strong>
        <p>
          Confirm that the client was told at the start of the call that it was being recorded,
          and that they agreed. Recording without consent is a criminal offence in the UAE.
        </p>
        <mat-checkbox [(ngModel)]="consent" [disabled]="busy()">
          The client was told the call was recorded and agreed.
        </mat-checkbox>
      </div>

      <div class="file">
        <input
          type="file"
          accept="audio/*"
          (change)="onFile($event)"
          [disabled]="busy()"
          aria-label="Choose audio file"
        />
        <p class="hint">Audio files only, up to {{ maxMb }} MB.</p>
      </div>

      @if (busy()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close(false)" [disabled]="busy()">Cancel</button>
      <button mat-flat-button type="button" (click)="upload()" [disabled]="!canSubmit()">Upload</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .content { display: flex; flex-direction: column; gap: 12px; min-width: 360px; }
    .consent { background: #fef7e0; padding: 12px; border-radius: 8px; }
    .consent p { margin: 6px 0 10px; font-size: 14px; }
    .muted, .hint { color: #5f6368; font-size: 13px; margin: 4px 0; }
    .error { color: #b3261e; }
  `],
})
export class RecordingDialogComponent {
  readonly data = inject<RecordingDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<RecordingDialogComponent>);
  private readonly recordings = inject(RecordingService);

  readonly maxMb = MAX_RECORDING_MB;
  consent = false;
  file: File | null = null;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  canSubmit(): boolean {
    return !!this.file && this.consent && !this.busy();
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0] ?? null;
    this.error.set(null);
    if (!chosen) {
      this.file = null;
      return;
    }
    if (!ALLOWED_AUDIO.includes(chosen.type)) {
      this.error.set('This file type is not supported. Use MP3, M4A, WAV, OGG, WebM, AAC, 3GP or AMR.');
      this.file = null;
      input.value = '';
      return;
    }
    if (chosen.size > MAX_RECORDING_MB * 1024 * 1024) {
      this.error.set(`The file is larger than ${MAX_RECORDING_MB} MB.`);
      this.file = null;
      input.value = '';
      return;
    }
    this.file = chosen;
  }

  upload(): void {
    if (!this.canSubmit() || !this.file) return;
    this.busy.set(true);
    this.error.set(null);
    this.recordings
      .upload({ callId: this.data.callId, file: this.file, consentConfirmed: this.consent })
      .subscribe({
        next: () => this.ref.close(true),
        error: (err: unknown) => {
          this.busy.set(false);
          const message =
            err instanceof HttpErrorResponse && err.error?.error
              ? err.error.error
              : err instanceof Error
                ? err.message
                : 'Upload failed. Please try again.';
          this.error.set(message);
        },
      });
  }
}
