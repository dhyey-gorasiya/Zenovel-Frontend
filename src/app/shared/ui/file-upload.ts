import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FileMeta } from '../../core/models';
import { FileContentStore } from '../../core/services/file-content-store.service';
import { Icon } from '../icons';
import { DocumentPreview } from './document-preview';

/**
 * Prototype file upload: the form value holds file metadata (name, size, type); the contents are kept
 * in this browser's IndexedDB for preview only and are not uploaded anywhere.
 */
@Component({
  selector: 'app-file-upload',
  imports: [Icon, DecimalPipe, DocumentPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FileUpload), multi: true }],
  templateUrl: './file-upload.html',
})
export class FileUpload implements ControlValueAccessor {
  private readonly store = inject(FileContentStore);

  readonly label = input('Upload document');
  readonly accept = input('.pdf,.doc,.docx');
  readonly maxMb = input(20);

  protected readonly value = signal<FileMeta | null>(null);
  protected readonly disabled = signal(false);
  protected readonly dragging = signal(false);
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly previewing = signal(false);
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
    void this.accept_(input.files?.[0]);
    input.value = '';
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    if (!this.disabled()) void this.accept_(e.dataTransfer?.files?.[0]);
  }

  clear(): void {
    this.set(null);
  }

  private async accept_(file: File | undefined): Promise<void> {
    if (!file || this.saving()) return;
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
    const meta: FileMeta = { name: file.name, size: file.size, type: file.type || 'application/octet-stream', uploadedAt: new Date().toISOString() };
    this.saving.set(true);
    try {
      if (this.store.supported) meta.contentId = await this.store.save(file);
      this.set(meta);
    } catch {
      this.set(meta);
      this.error.set('The file was attached, but its contents could not be stored in this browser, so it cannot be previewed.');
    } finally {
      this.saving.set(false);
    }
  }

  private set(v: FileMeta | null): void {
    this.error.set('');
    this.previewing.set(false);
    this.value.set(v);
    this.onChange(v);
    this.onTouched();
  }
}
