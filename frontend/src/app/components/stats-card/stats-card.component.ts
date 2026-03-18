import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="text-xs text-gray-400 mb-1">{{ label }}</div>
      <div class="text-lg font-bold" [class]="valueClass">{{ displayValue }}</div>
      <div *ngIf="subtitle" class="text-xs text-gray-500 mt-1">{{ subtitle }}</div>
    </div>
  `,
})
export class StatsCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() subtitle = '';
  @Input() color: 'default' | 'profit' | 'loss' | 'gold' = 'default';

  get displayValue(): string {
    return String(this.value);
  }

  get valueClass(): string {
    switch (this.color) {
      case 'profit': return 'text-profit';
      case 'loss': return 'text-loss';
      case 'gold': return 'text-gold';
      default: return 'text-white';
    }
  }
}
