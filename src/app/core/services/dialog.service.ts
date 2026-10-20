import { Injectable, signal } from '@angular/core';
import { SimSignature } from '../models';

export interface ConfirmOptions {
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  tone?: 'danger' | 'primary';
}

export interface PromptOptions {
  title: string;
  message?: string;
  label: string;
  required?: boolean;
  confirmText?: string;
  tone?: 'danger' | 'primary';
}

export interface SignOptions {
  title: string;
  statement: string;
  signerId: string;
  signerName: string;
  confirmText?: string;
}

export type ActiveDialog =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (v: string | null) => void }
  | { kind: 'sign'; options: SignOptions; resolve: (v: SimSignature | null) => void };

/** Promise-based dialogs rendered by the single DialogHost in the app shell. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly active = signal<ActiveDialog | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => this.open({ kind: 'confirm', options, resolve }));
  }

  prompt(options: PromptOptions): Promise<string | null> {
    return new Promise(resolve => this.open({ kind: 'prompt', options, resolve }));
  }

  /** Prototype signature simulation. Not a legally binding electronic signature. */
  sign(options: SignOptions): Promise<SimSignature | null> {
    return new Promise(resolve => this.open({ kind: 'sign', options, resolve }));
  }

  close(): void {
    this.active.set(null);
  }

  private open(dialog: ActiveDialog): void {
    const prev = this.active();
    if (prev) this.cancel(prev);
    this.active.set(dialog);
  }

  private cancel(d: ActiveDialog): void {
    if (d.kind === 'confirm') d.resolve(false);
    else d.resolve(null);
  }
}
