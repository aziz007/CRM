import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth.service';
import { Call, CallPage, ImportSummary } from '../../core/call.models';
import { CallService } from '../../core/call.service';
import { CallLogDialogComponent, CallLogDialogData } from './call-log-dialog.component';
import { RecordingDialogComponent, RecordingDialogData } from './recording-dialog.component';

@Component({
  selector: 'app-call-list',
  imports: [
    DatePipe, FormsModule, RouterLink,
    MatButtonModule, MatCardModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatPaginatorModule, MatSelectModule, MatTableModule,
  ],
  templateUrl: './call-list.component.html',
  styleUrl: './call-list.component.scss',
})
export class CallListComponent implements OnInit {
  private readonly calls = inject(CallService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly columns = ['when', 'lead', 'direction', 'duration', 'outcome', 'verified', 'actions'];
  readonly data = signal<CallPage | null>(null);
  readonly loading = signal(false);
  readonly importResult = signal<ImportSummary | null>(null);

  status = '';
  verification = '';
  page = 1;
  limit = 20;
  importText = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.calls.list({ status: this.status, verification: this.verification, page: this.page, limit: this.limit }).subscribe({
      next: (page) => {
        this.data.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('Could not load calls.', 'Close', { duration: 3000 });
      },
    });
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.limit = event.pageSize;
    this.load();
  }

  leadName(call: Call): string {
    return typeof call.lead === 'string' ? '' : `${call.lead.firstName} ${call.lead.lastName}`.trim();
  }

  agentName(call: Call): string {
    return typeof call.agent === 'string' ? '' : call.agent.name;
  }

  formatMinutes(seconds: number): string {
    return `${(seconds / 60).toFixed(1)} min`;
  }

  leadId(call: Call): string {
    return typeof call.lead === 'string' ? call.lead : call.lead.id;
  }

  uploadRecording(call: Call): void {
    const data: RecordingDialogData = { callId: call.id, leadName: this.leadName(call) || call.phone };
    this.dialog
      .open(RecordingDialogComponent, { data, width: '520px' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.snack.open('Recording uploaded', 'Close', { duration: 2500 });
      });
  }

  logOutcome(call: Call): void {
    this.openDialog({ pendingCall: call, leadName: this.leadName(call) });
  }

  private openDialog(data: CallLogDialogData): void {
    this.dialog
      .open(CallLogDialogComponent, { data, width: '480px' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snack.open('Call saved', 'Close', { duration: 2500 });
          this.load();
        }
      });
  }

  /**
   * Imports lines from the phone's call log, pasted as CSV:
   *   phone,startedAt,durationSec[,direction]
   * Example: +971501234567,2026-11-03T10:15:00+04:00,240,outbound
   */
  runImport(): void {
    const entries = parseCallLogCsv(this.importText);
    if (!entries.length) {
      this.snack.open('No valid lines found. Use: phone,startedAt,durationSec', 'Close', { duration: 4000 });
      return;
    }
    this.calls.importEntries(entries).subscribe({
      next: (summary) => {
        this.importResult.set(summary);
        this.importText = '';
        this.load();
      },
      error: () => this.snack.open('Import failed. Check the lines and try again.', 'Close', { duration: 4000 }),
    });
  }
}

export function parseCallLogCsv(text: string): { phone: string; startedAt: string; durationSec: number; direction?: string }[] {
  const out: { phone: string; startedAt: string; durationSec: number; direction?: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [phone, startedAt, duration, direction] = line.split(',').map((p) => p.trim());
    const started = startedAt ? new Date(startedAt) : null;
    if (!phone || !started || isNaN(started.getTime())) continue;
    out.push({
      phone,
      startedAt: started.toISOString(),
      durationSec: Math.max(0, Math.round(Number(duration) || 0)),
      direction: direction === 'inbound' ? 'inbound' : 'outbound',
    });
  }
  return out;
}
