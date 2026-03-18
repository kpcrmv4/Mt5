import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WebSocketService } from './services/websocket.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="min-h-screen bg-bg-primary">
      <!-- Header -->
      <header class="bg-bg-secondary border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-bold text-gold">GOLD UNLOCK</h1>
          <span class="text-xs text-gray-500">Grid Trading Bot • XAU/USD</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs" [class]="wsConnected ? 'text-green-400' : 'text-red-400'">
            {{ wsConnected ? '● Connected' : '○ Disconnected' }}
          </span>
        </div>
      </header>

      <!-- Content -->
      <router-outlet></router-outlet>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  wsConnected = false;

  constructor(private ws: WebSocketService) {}

  ngOnInit(): void {
    this.ws.connect();
    this.ws.connected$.subscribe((c) => (this.wsConnected = c));
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
  }
}
