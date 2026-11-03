import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { Call, CallInput, CallPage, ImportSummary } from './call.models';

@Injectable({ providedIn: 'root' })
export class CallService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/calls`;

  list(filters: { status?: string; verification?: string; page?: number; limit?: number; lead?: string }): Observable<CallPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<CallPage>(this.base, { params });
  }

  /** Records a pending call and returns the number to dial. */
  start(leadId: string): Observable<{ call: Call; dialNumber: string }> {
    return this.http.post<{ call: Call; dialNumber: string }>(`${this.base}/start`, { leadId });
  }

  create(input: CallInput): Observable<Call> {
    return this.http.post<Call>(this.base, input);
  }

  update(id: string, input: CallInput): Observable<Call> {
    return this.http.patch<Call>(`${this.base}/${id}`, input);
  }

  importEntries(entries: { phone: string; startedAt: string; durationSec?: number; direction?: string }[]): Observable<ImportSummary> {
    return this.http.post<ImportSummary>(`${this.base}/import`, { entries });
  }
}
