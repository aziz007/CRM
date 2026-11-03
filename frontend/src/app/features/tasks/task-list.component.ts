import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../../core/auth.service';
import { Task, TaskBucket, TaskPage, dayRanges, taskLeadId, taskLeadName } from '../../core/task.models';
import { TaskService } from '../../core/task.service';
import { TaskDialogComponent, TaskDialogData } from './task-dialog.component';

const BUCKETS: { value: TaskBucket; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'done', label: 'Completed' },
  { value: 'all', label: 'All' },
];

@Component({
  selector: 'app-task-list',
  imports: [DatePipe, RouterLink, MatButtonModule, MatCardModule, MatDialogModule, MatPaginatorModule, MatTableModule],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
})
export class TaskListComponent implements OnInit {
  private readonly tasks = inject(TaskService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly buckets = BUCKETS;
  readonly columns = ['done', 'title', 'lead', 'due', 'priority', 'actions'];
  readonly data = signal<TaskPage | null>(null);
  readonly loading = signal(false);
  bucket: TaskBucket = 'today';
  page = 1;
  limit = 20;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.tasks.list({ bucket: this.bucket, page: this.page, limit: this.limit, ...dayRanges() }).subscribe({
      next: (page) => {
        this.data.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('Could not load tasks.', 'Close', { duration: 3000 });
      },
    });
  }

  setBucket(bucket: TaskBucket): void {
    this.bucket = bucket;
    this.page = 1;
    this.load();
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.limit = event.pageSize;
    this.load();
  }

  toggleDone(task: Task): void {
    const next = task.status === 'done' ? 'open' : 'done';
    this.tasks.update(task.id, { status: next }).subscribe({
      next: () => {
        this.snack.open(next === 'done' ? 'Task completed' : 'Task reopened', 'Close', { duration: 2000 });
        this.load();
      },
      error: () => this.snack.open('Could not update the task.', 'Close', { duration: 3000 }),
    });
  }

  edit(task?: Task): void {
    const data: TaskDialogData = task ? { task } : {};
    this.dialog
      .open(TaskDialogComponent, { data, width: '520px' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snack.open(task ? 'Task updated' : 'Task created', 'Close', { duration: 2000 });
          this.load();
        }
      });
  }

  remove(task: Task): void {
    if (!confirm(`Delete "${task.title}"?`)) return;
    this.tasks.remove(task.id).subscribe({
      next: () => this.load(),
      error: () => this.snack.open('Could not delete the task.', 'Close', { duration: 3000 }),
    });
  }

  leadId(task: Task): string | null {
    return taskLeadId(task);
  }

  leadName(task: Task): string {
    return taskLeadName(task);
  }

  assigneeName(task: Task): string {
    return typeof task.assignedTo === 'string' ? '' : task.assignedTo.name;
  }

  isOverdue(task: Task): boolean {
    return task.status === 'open' && new Date(task.dueAt).getTime() < Date.now();
  }
}
