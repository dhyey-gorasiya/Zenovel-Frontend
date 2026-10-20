import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { LocalStorageService } from '../data/local-storage.service';

type Theme = 'light' | 'dark';
const KEY = 'zen.v2.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(LocalStorageService);
  private readonly doc = inject(DOCUMENT);
  readonly theme = signal<Theme>(this.storage.get<Theme>(KEY) === 'dark' ? 'dark' : 'light');

  constructor() {
    effect(() => {
      const t = this.theme();
      this.doc.documentElement.classList.toggle('dark', t === 'dark');
      this.storage.write(KEY, t);
    });
  }

  toggle(): void {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }
}
