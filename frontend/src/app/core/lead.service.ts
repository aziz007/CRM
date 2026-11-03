import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { Activity, AssignableUser, Lead, LeadPage, LeadQuery } from './lead.models';

export type LeadInput = Partial<Omit<Lead, 'id' | 'assignedTo' | 'createdAt' | 'updatedAt'>> & { assignedTo?: string };

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);
  private readonly base = `${this.apiBase}/leads`;

  list(query: LeadQuery): Observable<LeadPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<LeadPage>(this.base, { params });
  }

  get(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.base}/${id}`);
  }

  create(input: LeadInput): Observable<Lead> {
    return this.http.post<Lead>(this.base, input);
  }

  update(id: string, input: LeadInput): Observable<Lead> {
    return this.http.patch<Lead>(`${this.base}/${id}`, input);
  }

  archive(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  activities(id: string): Observable<{ items: Activity[] }> {
    return this.http.get<{ items: Activity[] }>(`${this.base}/${id}/activities`);
  }

  addNote(id: string, note: string): Observable<Activity> {
    return this.http.post<Activity>(`${this.base}/${id}/activities`, { note });
  }

  /** Active users for assignment (admin only on the server, which returns contact details). */
  assignableUsers(): Observable<{ items: AssignableUser[] }> {
    return this.http.get<{ items: AssignableUser[] }>(`${this.apiBase}/users`);
  }
}
