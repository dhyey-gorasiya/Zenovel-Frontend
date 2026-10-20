import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FileMeta } from '../../core/models';
import { Icon } from '../icons';

/**
 * Prototype file upload: only file metadata (name, size, type) is stored in the browser.
 * The file contents are not persisted or uploaded anywhere.
 */
@Component({
  selector: 'app-file-upload',
  imports: [Icon, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FileUpload), multi: true }],
  templateUrl: './file-upload.html',
})
export class FileUpload implements ControlValueAccessor {
  readonly label = input('Upload document');
  readonly accept = input('.pdf,.doc,.docx');
  readonly maxMb = input(20);

  protected readonly value = signal<FileMeta | null>(null);
  protected readonly disabled = signal(false);
  protected readonly dragging = signal(false);
  protected readonly error = signal('');
  private onChange: (v: FileMeta | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: FileMeta | null): void {
    this.value.set(v ?? null);
  }
  registerOnChange(fn: (v: FileMeta | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.accept_(input.files?.[0]);
    input.value = '';
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    if (!this.disabled()) this.accept_(e.dataTransfer?.files?.[0]);
  }

  clear(): void {
    this.set(null);
  }

  private accept_(file: File | undefined): void {
    if (!file) return;
    const allowed = this.accept().split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (allowed.length && !allowed.includes(ext)) {
      this.error.set(`Unsupported file type ${ext}. Allowed: ${allowed.join(', ')}`);
      return;
    }
    if (file.size > this.maxMb() * 1024 * 1024) {
      this.error.set(`File is larger than ${this.maxMb()} MB.`);
      return;
    }
    this.set({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', uploadedAt: new Date().toISOString() });
  }

  private set(v: FileMeta | null): void {
    this.error.set('');
    this.value.set(v);
    this.onChange(v);
    this.onTouched();
  }
}
