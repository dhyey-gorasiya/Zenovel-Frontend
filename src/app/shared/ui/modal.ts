import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, input, output } from '@angular/core';
import { Icon } from '../icons';

let seq = 0;

@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  templateUrl: './modal.html',
})
export class Modal {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly width = input('min(36rem, 100%)');
  readonly closed = output<void>();
  readonly titleId = `zn-modal-${++seq}`;

  constructor() {
    const el = inject(ElementRef<HTMLElement>);
    afterNextRender(() => {
      const focusable = el.nativeElement.querySelector('.zn-modal input, .zn-modal textarea, .zn-modal select') as HTMLElement | null;
      (focusable ?? (el.nativeElement.querySelector('.zn-modal button') as HTMLElement | null))?.focus();
    });
  }
}
