import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { Icon } from '../icons';

@Component({
  selector: 'app-pagination',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagination.html',
})
export class Pagination {
  readonly total = input.required<number>();
  readonly page = model(0);
  readonly size = model(10);
  readonly sizes = input([10, 20, 50]);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly start = computed(() => (this.total() ? this.page() * this.size() + 1 : 0));
  readonly end = computed(() => Math.min(this.total(), (this.page() + 1) * this.size()));

  onSize(v: string): void {
    this.size.set(Number(v) || 10);
    this.page.set(0);
  }
}
