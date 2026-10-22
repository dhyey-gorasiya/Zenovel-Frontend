import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SheetSource = 'project' | 'plan' | 'manual' | '';

const SOURCE_LABELS: Record<Exclude<SheetSource, ''>, string> = {
  project: 'Fetched from Project Details',
  plan: 'Fetched from Monitoring Plan',
  manual: 'Manually enter',
};

/** One "field | value" row of a workbook-style sheet, with the field's data source shown under the value. */
@Component({
  selector: 'app-sheet-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid gap-1 border-b border-line-soft px-4 py-2.5 last:border-b-0 md:grid-cols-[18rem_1fr] md:gap-4' },
  template: `
    <div class="text-sm font-medium">
      {{ label() }}@if (required()) {<span class="text-danger"> *</span>}
    </div>
    <div class="min-w-0 text-sm">
      <ng-content />
      @if (sourceLabel()) {
        <p class="mt-1 text-[0.7rem] text-ink-soft">{{ sourceLabel() }}</p>
      }
    </div>
  `,
})
export class SheetRow {
  readonly label = input.required<string>();
  readonly source = input<SheetSource>('');
  readonly required = input(false);

  protected readonly sourceLabel = computed(() => (this.source() ? SOURCE_LABELS[this.source() as Exclude<SheetSource, ''>] : ''));
}
