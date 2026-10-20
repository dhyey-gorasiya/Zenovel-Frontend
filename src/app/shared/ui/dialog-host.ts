import { ChangeDetectionStrategy, Component, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../core/services/dialog.service';
import { Icon } from '../icons';
import { Modal } from './modal';
import { SignaturePad } from './signature-pad';

/** Renders the confirmation / prompt / signature dialogs requested through DialogService. */
@Component({
  selector: 'app-dialog-host',
  imports: [Modal, FormsModule, SignaturePad, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog-host.html',
})
export class DialogHost {
  protected readonly dialogs = inject(DialogService);
  private readonly pad = viewChild<SignaturePad>('pad');
  protected text = '';
  protected readonly touched = signal(false);

  constructor() {
    effect(() => {
      this.dialogs.active();
      this.text = '';
      this.touched.set(false);
    });
  }

  cancel(): void {
    const d = this.dialogs.active();
    this.dialogs.close();
    if (d?.kind === 'confirm') d.resolve(false);
    else d?.resolve(null);
  }

  resolveConfirm(v: boolean): void {
    const d = this.dialogs.active();
    if (d?.kind !== 'confirm') return;
    this.dialogs.close();
    d.resolve(v);
  }

  resolvePrompt(required: boolean): void {
    const d = this.dialogs.active();
    if (d?.kind !== 'prompt') return;
    this.touched.set(true);
    if (required && !this.text.trim()) return;
    this.dialogs.close();
    d.resolve(this.text.trim());
  }

  resolveSign(): void {
    const d = this.dialogs.active();
    const pad = this.pad();
    if (d?.kind !== 'sign' || !pad) return;
    this.touched.set(true);
    if (!pad.valid()) return;
    this.dialogs.close();
    d.resolve({ userId: d.options.signerId, typedName: pad.typedName().trim(), at: new Date().toISOString() });
  }
}
