import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { RealtimeUpdate } from '../models/trading.models';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket: Socket | null = null;
  private updateSubject = new BehaviorSubject<RealtimeUpdate | null>(null);
  private connectedSubject = new BehaviorSubject<boolean>(false);

  get updates$(): Observable<RealtimeUpdate | null> {
    return this.updateSubject.asObservable();
  }

  get connected$(): Observable<boolean> {
    return this.connectedSubject.asObservable();
  }

  connect(url = 'http://localhost:3000'): void {
    if (this.socket) return;

    this.socket = io(url);

    this.socket.on('connect', () => {
      this.connectedSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      this.connectedSubject.next(false);
    });

    this.socket.on('update', (data: RealtimeUpdate) => {
      this.updateSubject.next(data);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
