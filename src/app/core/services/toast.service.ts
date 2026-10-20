import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warn';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message, 6000);
  }

  info(message: string): void {
    this.show('info', message);
  }

  warn(message: string): void {
    this.show('warn', message, 6000);
  }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private show(kind: ToastKind, message: string, ms = 4000): void {
    const id = ++this.seq;
    this.toasts.update(list => [...list.slice(-3), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
