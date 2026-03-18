import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TradingConfig, AiAnalysis, NewsShieldStatus } from '../models/trading.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/trading/status`);
  }

  getPositions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/trading/positions`);
  }

  getOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/trading/orders`);
  }

  getHistory(days = 7): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/trading/history?days=${days}`);
  }

  getPerformance(): Observable<any> {
    return this.http.get(`${this.baseUrl}/trading/performance`);
  }

  getPrice(): Observable<any> {
    return this.http.get(`${this.baseUrl}/trading/price`);
  }

  startTrading(): Observable<any> {
    return this.http.post(`${this.baseUrl}/trading/start`, {});
  }

  stopTrading(): Observable<any> {
    return this.http.post(`${this.baseUrl}/trading/stop`, {});
  }

  closeAll(): Observable<any> {
    return this.http.post(`${this.baseUrl}/trading/close-all`, {});
  }

  getConfig(): Observable<TradingConfig> {
    return this.http.get<TradingConfig>(`${this.baseUrl}/config`);
  }

  updateConfig(updates: Record<string, any>): Observable<any> {
    return this.http.put(`${this.baseUrl}/config`, updates);
  }

  getAiStatus(): Observable<{ lastAnalysis: AiAnalysis; regime: string }> {
    return this.http.get<any>(`${this.baseUrl}/config/ai-status`);
  }

  forceAiAnalysis(): Observable<AiAnalysis> {
    return this.http.post<AiAnalysis>(`${this.baseUrl}/config/ai-analyze`, {});
  }

  getNewsStatus(): Observable<NewsShieldStatus> {
    return this.http.get<NewsShieldStatus>(`${this.baseUrl}/config/news-status`);
  }

  forceNewsCheck(): Observable<NewsShieldStatus> {
    return this.http.post<NewsShieldStatus>(`${this.baseUrl}/config/news-check`, {});
  }
}
