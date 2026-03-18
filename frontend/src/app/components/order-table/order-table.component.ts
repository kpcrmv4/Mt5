import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Position, Order } from '../../models/trading.models';

@Component({
  selector: 'app-order-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h3 class="text-sm font-semibold text-gray-300 mb-3">
        {{ title }}
        <span class="text-xs text-gray-500 ml-2">({{ items.length }})</span>
      </h3>

      <div class="overflow-x-auto" *ngIf="items.length > 0; else empty">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 border-b border-gray-800">
              <th class="text-left py-1 px-2">ID</th>
              <th class="text-left py-1 px-2">Type</th>
              <th class="text-right py-1 px-2">Lot</th>
              <th class="text-right py-1 px-2">Price</th>
              <th class="text-right py-1 px-2" *ngIf="showProfit">Profit</th>
              <th class="text-right py-1 px-2" *ngIf="showTpSl">TP</th>
              <th class="text-right py-1 px-2" *ngIf="showTpSl">SL</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of items" class="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td class="py-1.5 px-2 text-gray-400">{{ item.id | slice:0:8 }}</td>
              <td class="py-1.5 px-2">
                <span [class]="item.type?.includes('BUY') ? 'text-green-400' : 'text-red-400'">
                  {{ formatType(item.type) }}
                </span>
              </td>
              <td class="py-1.5 px-2 text-right">{{ item.volume }}</td>
              <td class="py-1.5 px-2 text-right">{{ (item.openPrice || item.currentPrice) | number:'1.2-2' }}</td>
              <td class="py-1.5 px-2 text-right" *ngIf="showProfit"
                  [class]="item.profit >= 0 ? 'text-profit' : 'text-loss'">
                {{ item.profit >= 0 ? '+' : '' }}{{ item.profit | number:'1.2-2' }}
              </td>
              <td class="py-1.5 px-2 text-right text-gray-500" *ngIf="showTpSl">{{ item.tp | number:'1.2-2' }}</td>
              <td class="py-1.5 px-2 text-right text-gray-500" *ngIf="showTpSl">{{ item.sl | number:'1.2-2' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #empty>
        <div class="text-center text-gray-600 py-6 text-sm">No {{ title.toLowerCase() }}</div>
      </ng-template>
    </div>
  `,
})
export class OrderTableComponent {
  @Input() title = 'Orders';
  @Input() items: any[] = [];
  @Input() showProfit = false;
  @Input() showTpSl = false;

  formatType(type: string): string {
    if (!type) return '';
    return type.replace('ORDER_TYPE_', '').replace('POSITION_TYPE_', '').replace('_', ' ');
  }
}
