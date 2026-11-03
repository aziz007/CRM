import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LEAD_STATUSES, Lead, LeadPage, assigneeName } from '../../core/lead.models';
import { LeadService } from '../../core/lead.service';

@Component({
  selector: 'app-lead-list',
  imports: [DatePipe, 
    FormsModule, ReactiveFormsModule, RouterLink,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatPaginatorModule, MatSelectModule, MatTableModule,
  ],
  templateUrl: './lead-list.component.html',
  styleUrl: './lead-list.component.scss',
})
export class LeadListComponent implements OnInit {
  private readonly leads = inject(LeadService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  readonly statuses = LEAD_STATUSES;
  readonly columns = ['name', 'phone', 'location', 'budget', 'status', 'assignedTo', 'updated'];
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<LeadPage | null>(null);
  readonly assigneeName = assigneeName;

  readonly search = new FormControl('', { nonNullable: true });
  status = '';
  country = '';
  page = 1;
  limit = 20;

  ngOnInit(): void {
    this.search.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.page = 1;
        this.load();
      });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads
      .list({
        search: this.search.value.trim(),
        status: this.status,
        country: this.country,
        page: this.page,
        limit: this.limit,
        sort: 'updated',
      })
      .subscribe({
        next: (page) => {
          this.data.set(page);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load leads. Please try again.');
          this.loading.set(false);
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

  open(lead: Lead): void {
    this.router.navigate(['/leads', lead.id]);
  }

  budget(lead: Lead): string {
    if (lead.budgetMin == null && lead.budgetMax == null) return '';
    const fmt = (n: number) => n.toLocaleString('en-US');
    const range = lead.budgetMin != null && lead.budgetMax != null
      ? `${fmt(lead.budgetMin)} – ${fmt(lead.budgetMax)}`
      : fmt((lead.budgetMax ?? lead.budgetMin) as number);
    return `${lead.currency} ${range}`;
  }
}
