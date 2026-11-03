import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-admin-placeholder',
  imports: [MatCardModule],
  template: `
    <h1>Admin</h1>
    <mat-card>
      <mat-card-content>
        <p>User management and team settings will be added here.</p>
      </mat-card-content>
    </mat-card>
  `,
})
export class AdminPlaceholderComponent {}
