import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../core/auth.service';
import { Task, TaskSummary, dayRanges, taskLeadName } from '../../core/task.models';
import { TaskService } from '../../core/task.service';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, MatButtonModule, MatCardModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly tasks = inject(TaskService);

  readonly summary = signal<TaskSummary | null>(null);
  readonly dueList = signal<Task[]>([]);

  ngOnInit(): void {
    const ranges = dayRanges();
    this.tasks.summary(ranges).subscribe({ next: (s) => this.summary.set(s) });
    // Overdue and today's tasks, most urgent first.
    this.tasks.list({ bucket: 'overdue', limit: 5 }).subscribe({
      next: (page) => this.dueList.update((list) => [...page.items, ...list]),
    });
    this.tasks.list({ bucket: 'today', limit: 5, ...ranges }).subscribe({
      next: (page) => this.dueList.update((list) => [...list, ...page.items]),
    });
  }

  leadName(task: Task): string {
    return taskLeadName(task);
  }

  complete(task: Task): void {
    this.tasks.update(task.id, { status: 'done' }).subscribe({
      next: () => {
        this.dueList.update((list) => list.filter((t) => t.id !== task.id));
        this.tasks.summary(dayRanges()).subscribe({ next: (s) => this.summary.set(s) });
      },
    });
  }
}
