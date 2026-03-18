import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiAnalysis, Indicators } from '../../models/trading.models';

@Component({
  selector: 'app-ai-regime',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-300">AI REGIME</h3>
        <span class="badge-blue" *ngIf="aiEnabled">AI Auto</span>
      </div>

      <!-- Regime Badge -->
      <div class="flex items-center gap-2 mb-3">
        <span class="text-2xl">{{ regimeIcon }}</span>
        <div>
          <div class="font-bold" [class]="regimeColor">{{ regime }}</div>
          <div class="text-xs text-gray-500" *ngIf="analysis">
            Trend: {{ analysis.trend }} • Confidence: {{ (analysis.confidence * 100) | number:'1.0-0' }}%
          </div>
        </div>
      </div>

      <!-- Indicators -->
      <div class="grid grid-cols-2 gap-2 text-xs" *ngIf="indicators">
        <div class="flex justify-between">
          <span class="text-gray-400">RSI(14)</span>
          <span [class]="rsiColor">{{ indicators.rsi }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">ATR Ratio</span>
          <span>{{ indicators.atrRatio }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">EMA(20)</span>
          <span>{{ indicators.emaFast | number:'1.2-2' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">EMA(50)</span>
          <span>{{ indicators.emaSlow | number:'1.2-2' }}</span>
        </div>
      </div>

      <!-- Reasoning -->
      <div class="mt-3 text-xs text-gray-500 border-t border-gray-700 pt-2" *ngIf="analysis?.reasoning">
        {{ analysis.reasoning }}
      </div>
    </div>
  `,
})
export class AiRegimeComponent {
  @Input() regime = 'Neutral';
  @Input() analysis: AiAnalysis | null = null;
  @Input() indicators: Indicators | null = null;
  @Input() aiEnabled = true;

  get regimeIcon(): string {
    const icons: Record<string, string> = {
      'Strong Uptrend': '🟢',
      'Mild Uptrend': '🔵',
      'Neutral': '⚪',
      'Mild Downtrend': '🟡',
      'Strong Downtrend': '🔴',
      'High Volatility': '⚡',
    };
    return icons[this.regime] || '⚪';
  }

  get regimeColor(): string {
    const colors: Record<string, string> = {
      'Strong Uptrend': 'text-green-400',
      'Mild Uptrend': 'text-blue-400',
      'Neutral': 'text-gray-300',
      'Mild Downtrend': 'text-yellow-400',
      'Strong Downtrend': 'text-red-400',
      'High Volatility': 'text-purple-400',
    };
    return colors[this.regime] || 'text-gray-300';
  }

  get rsiColor(): string {
    if (!this.indicators) return '';
    if (this.indicators.rsi > 70) return 'text-red-400';
    if (this.indicators.rsi < 30) return 'text-green-400';
    return 'text-gray-300';
  }
}
