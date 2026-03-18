import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-grid-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-300">GRID LEVELS</h3>
        <span class="text-xs text-gray-500" *ngIf="spacing">
          Spacing: ${{ spacing | number:'1.2-2' }}
        </span>
      </div>

      <!-- Mid Price -->
      <div class="text-center mb-3 py-2 bg-gold/10 rounded" *ngIf="midPrice">
        <span class="text-gold font-bold">◆ Mid: {{ midPrice | number:'1.2-2' }}</span>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- Buy Levels -->
        <div>
          <div class="text-xs text-green-400 font-semibold mb-2">BUY ({{ buyLevels.length }})</div>
          <div *ngFor="let level of buyLevels; let i = index"
               class="text-xs py-1 px-2 mb-1 rounded bg-green-900/20 text-green-300 flex justify-between">
            <span>{{ level | number:'1.2-2' }}</span>
            <span class="text-gray-600">L{{ i + 1 }}</span>
          </div>
        </div>

        <!-- Sell Levels -->
        <div>
          <div class="text-xs text-red-400 font-semibold mb-2">SELL ({{ sellLevels.length }})</div>
          <div *ngFor="let level of sellLevels; let i = index"
               class="text-xs py-1 px-2 mb-1 rounded bg-red-900/20 text-red-300 flex justify-between">
            <span>{{ level | number:'1.2-2' }}</span>
            <span class="text-gray-600">L{{ i + 1 }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class GridPanelComponent {
  @Input() buyLevels: number[] = [];
  @Input() sellLevels: number[] = [];
  @Input() midPrice: number = 0;
  @Input() spacing: number = 0;
}
