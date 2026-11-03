import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { DayRanges, Task, TaskBucket, TaskPage, TaskPriority, TaskSummary } from './task.models';

export interface TaskInput {
  title?: string;
  description?: string;
  dueAt?: string;
  priority?: TaskPriority;
  leadId?: string | null;
  assignedTo?: string;
  status?: 'open' | 'done' | 'cancelled';
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/tasks`;

  list(params: { bucket?: TaskBucket; status?: string; lead?: string; page?: number; limit?: number } & Partial<DayRanges>): Observable<TaskPage> {
    const map: Record<string, string> = {};
    const { bucket, status, ...rest } = params;
    if (bucket === 'done') {
      map['status'] = 'done';
    } else if (bucket === 'all') {
      map['status'] = 'all';
    } else if (bucket) {
      map['bucket'] = bucket;
    }
    if (status) map['status'] = status;
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined && value !== null && value !== '') map[key] = String(value);
    }
    let httpParams = new HttpParams({ fromObject: map });
    return this.http.get<TaskPage>(this.base, { params: httpParams });
  }

  summary(ranges: DayRanges): Observable<TaskSummary> {
    return this.http.get<TaskSummary>(`${this.base}/summary`, { params: { ...ranges } });
  }

  create(input: TaskInput): Observable<Task> {
    return this.http.post<Task>(this.base, input);
  }

  update(id: string, input: TaskInput): Observable<Task> {
    return this.http.patch<Task>(`${this.base}/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
