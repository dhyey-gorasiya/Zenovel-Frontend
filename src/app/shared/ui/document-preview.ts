import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FileMeta } from '../../core/models';
import { FileContentStore } from '../../core/services/file-content-store.service';
import { Icon } from '../icons';
import { Modal } from './modal';

type PreviewKind = 'pdf' | 'image' | 'other';

/** Modal that renders a stored upload inline (PDF / image). */
@Component({
  selector: 'app-document-preview',
  imports: [Modal, Icon, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-preview.html',
})
export class DocumentPreview implements OnInit {
  private readonly store = inject(FileContentStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly file = input.required<FileMeta>();
  readonly closed = output<void>();

  protected readonly loading = signal(true);
  protected readonly url = signal<string | null>(null);
  /** `#toolbar=0` hides the browser PDF viewer's download / print toolbar. */
  protected readonly viewerUrl = computed(() => {
    const url = this.url();
    return url && this.kind() === 'pdf' ? `${url}#toolbar=0&navpanes=0` : url;
  });
  protected readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.viewerUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  protected readonly kind = computed<PreviewKind>(() => {
    const { type, name } = this.file();
    if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf';
    return type.startsWith('image/') ? 'image' : 'other';
  });

  async ngOnInit(): Promise<void> {
    this.destroyRef.onDestroy(() => this.revoke());
    const id = this.file().contentId;
    try {
      const blob = id && this.store.supported ? await this.store.load(id) : null;
      if (blob) this.url.set(URL.createObjectURL(blob));
    } catch {
      this.url.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private revoke(): void {
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
  }
}
