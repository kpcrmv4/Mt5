import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NewsShieldStatus } from '../../models/trading.models';

@Component({
  selector: 'app-news-shield',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" [class.border-red-800]="status?.shieldActive" [class.border-green-900]="!status?.shieldActive">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-300">NEWS SHIELD</h3>
        <span [class]="status?.shieldActive ? 'badge-red' : 'badge-green'">
          {{ status?.shieldActive ? 'ACTIVE' : 'Normal' }}
        </span>
      </div>

      <div class="flex items-center gap-2 mb-2">
        <span class="text-xl">{{ impactIcon }}</span>
        <span class="text-sm font-medium" [class]="impactColor">
          {{ status?.currentImpact | uppercase }} Impact
        </span>
      </div>

      <!-- Upcoming Events -->
      <div *ngIf="status?.upcomingEvents?.length" class="mt-2 border-t border-gray-700 pt-2">
        <div class="text-xs text-gray-400 mb-1">Upcoming Events:</div>
        <div *ngFor="let event of status.upcomingEvents" class="text-xs flex justify-between py-0.5">
          <span class="text-gray-300">{{ event.event }}</span>
          <span [class]="'badge-' + (event.impact === 'high' ? 'red' : event.impact === 'medium' ? 'yellow' : 'green')">
            {{ event.impact }}
          </span>
        </div>
      </div>

      <div class="text-xs text-gray-600 mt-2" *ngIf="status?.lastCheck">
        Last check: {{ status.lastCheck | date:'HH:mm:ss' }}
      </div>
    </div>
  `,
})
export class NewsShieldComponent {
  @Input() status: NewsShieldStatus | null = null;

  get impactIcon(): string {
    const icons: Record<string, string> = {
      low: '🟢', medium: '🟡', high: '🔴', critical: '⚫',
    };
    return icons[this.status?.currentImpact || 'low'] || '🟢';
  }

  get impactColor(): string {
    const colors: Record<string, string> = {
      low: 'text-green-400', medium: 'text-yellow-400',
      high: 'text-red-400', critical: 'text-red-600',
    };
    return colors[this.status?.currentImpact || 'low'] || 'text-green-400';
  }
}
