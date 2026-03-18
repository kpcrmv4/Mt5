import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../../services/websocket.service';
import { ApiService } from '../../services/api.service';
import { StatsCardComponent } from '../../components/stats-card/stats-card.component';
import { AiRegimeComponent } from '../../components/ai-regime/ai-regime.component';
import { NewsShieldComponent } from '../../components/news-shield/news-shield.component';
import { GridPanelComponent } from '../../components/grid-panel/grid-panel.component';
import { OrderTableComponent } from '../../components/order-table/order-table.component';
import {
  RealtimeUpdate, Performance, Price, GridStatus,
  AiAnalysis, NewsShieldStatus, Indicators
} from '../../models/trading.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, StatsCardComponent, AiRegimeComponent,
    NewsShieldComponent, GridPanelComponent, OrderTableComponent,
  ],
  template: `
    <div class="p-4 space-y-4">
      <!-- Top Bar: Price + Controls -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div>
            <span class="text-xs text-gray-500">XAU/USD</span>
            <div class="text-2xl font-bold text-gold">
              {{ price?.mid | number:'1.2-2' }}
            </div>
          </div>
          <div class="text-sm" *ngIf="price">
            <span class="text-gray-500">Bid:</span> {{ price.bid | number:'1.2-2' }}
            <span class="text-gray-500 ml-2">Ask:</span> {{ price.ask | number:'1.2-2' }}
            <span class="text-gray-500 ml-2">Spread:</span> {{ price.spread | number:'1.2-2' }}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button (click)="toggleTrading()" class="px-4 py-1.5 rounded text-sm font-medium"
                  [class]="gridRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'">
            {{ gridRunning ? 'Stop' : 'Start' }}
          </button>
          <button (click)="emergencyClose()" class="px-4 py-1.5 rounded text-sm font-medium bg-red-900 hover:bg-red-800">
            Close All
          </button>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <app-stats-card label="Balance" [value]="'$' + (performance?.balance | number:'1.2-2')" color="gold"></app-stats-card>
        <app-stats-card label="Win Rate"
          [value]="(performance?.winRate | number:'1.1-1') + '%'"
          [subtitle]="performance?.wins + 'W / ' + performance?.losses + 'L'"
          [color]="(performance?.winRate || 0) >= 60 ? 'profit' : 'default'">
        </app-stats-card>
        <app-stats-card label="Profit Factor" [value]="performance?.profitFactor | number:'1.2-2'" color="default"></app-stats-card>
        <app-stats-card label="Open Positions" [value]="positions.length" color="default"></app-stats-card>
        <app-stats-card label="Max Drawdown"
          [value]="(performance?.maxDrawdown | number:'1.2-2') + '%'"
          [color]="(performance?.maxDrawdown || 0) > 5 ? 'loss' : 'profit'">
        </app-stats-card>
      </div>

      <!-- Main Grid: AI + News + Grid Levels -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <app-ai-regime
          [regime]="regime"
          [analysis]="aiAnalysis"
          [indicators]="indicators">
        </app-ai-regime>

        <app-news-shield [status]="newsStatus"></app-news-shield>

        <app-grid-panel
          [buyLevels]="buyLevels"
          [sellLevels]="sellLevels"
          [midPrice]="price?.mid || 0"
          [spacing]="gridSpacing">
        </app-grid-panel>
      </div>

      <!-- Orders & Positions -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <app-order-table title="Open Positions" [items]="positions" [showProfit]="true"></app-order-table>
        <app-order-table title="Pending Orders" [items]="orders" [showTpSl]="true"></app-order-table>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private sub: Subscription | null = null;

  price: Price | null = null;
  performance: Performance | null = null;
  positions: any[] = [];
  orders: any[] = [];
  regime = 'Neutral';
  aiAnalysis: AiAnalysis | null = null;
  newsStatus: NewsShieldStatus | null = null;
  indicators: Indicators | null = null;
  buyLevels: number[] = [];
  sellLevels: number[] = [];
  gridSpacing = 0;
  gridRunning = false;

  constructor(
    private ws: WebSocketService,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    this.sub = this.ws.updates$.subscribe((update) => {
      if (!update) return;
      this.applyUpdate(update);
    });

    // Initial load via REST
    this.api.getStatus().subscribe((status) => {
      if (status.performance) this.performance = status.performance;
      if (status.grid) {
        this.gridRunning = status.grid.running;
        this.regime = status.grid.regime;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  applyUpdate(update: RealtimeUpdate): void {
    this.price = update.price;
    this.positions = update.positions || [];
    this.orders = update.orders || [];

    if (update.account) {
      this.performance = {
        ...this.performance,
        balance: update.account.balance,
        equity: update.account.equity,
        profit: update.account.profit,
      } as Performance;
    }

    if (update.grid) {
      this.gridRunning = update.grid.running;
      this.regime = update.grid.regime;
      if (update.grid.grid) {
        this.buyLevels = update.grid.grid.buyLevels || [];
        this.sellLevels = update.grid.grid.sellLevels || [];
        this.gridSpacing = update.grid.grid.spacing || 0;
        this.indicators = update.grid.grid.indicators || null;
      }
    }

    if (update.newsShield) this.newsStatus = update.newsShield;
    if (update.aiRegime) this.aiAnalysis = update.aiRegime;
  }

  toggleTrading(): void {
    if (this.gridRunning) {
      this.api.stopTrading().subscribe(() => (this.gridRunning = false));
    } else {
      this.api.startTrading().subscribe(() => (this.gridRunning = true));
    }
  }

  emergencyClose(): void {
    if (confirm('Close ALL positions? This cannot be undone.')) {
      this.api.closeAll().subscribe();
    }
  }
}
