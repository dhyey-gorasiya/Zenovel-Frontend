import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from '../icons';

const ICONS = { success: 'circle-check', error: 'circle-x', info: 'info', warn: 'triangle-alert' } as const;
const TONES = { success: 'zn-notice-ok', error: 'zn-notice-danger', info: 'zn-notice-info', warn: 'zn-notice-warn' } as const;

@Component({
  selector: 'app-toast-host',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-host.html',
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
  protected readonly icons = ICONS;
  protected readonly tones = TONES;
}
