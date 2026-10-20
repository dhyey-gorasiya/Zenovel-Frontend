import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from '../icons';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

let seq = 0;

/** Dropdown with type-to-filter; works with reactive forms via ControlValueAccessor. */
@Component({
  selector: 'app-searchable-select',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchableSelect), multi: true }],
  host: { '(document:click)': 'onDocClick($event)', class: 'relative block' },
  templateUrl: './searchable-select.html',
})
export class SearchableSelect implements ControlValueAccessor {
  private readonly el = inject(ElementRef<HTMLElement>);
  readonly options = input.required<SelectOption[]>();
  readonly placeholder = input('Select…');
  readonly allowEmpty = input(true);
  readonly inputId = input(`zn-select-${++seq}`);
  readonly listId = `zn-select-list-${seq}`;

  protected readonly value = signal<string>('');
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly selected = computed(() => this.options().find(o => o.value === this.value()));
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter(o => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : this.options();
  });

  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  toggle(): void {
    this.open.update(o => !o);
    this.query.set('');
    if (this.open()) setTimeout(() => (this.el.nativeElement.querySelector('input') as HTMLInputElement | null)?.focus());
  }

  pick(o: SelectOption | null): void {
    this.value.set(o?.value ?? '');
    this.onChange(o?.value ?? '');
    this.onTouched();
    this.open.set(false);
  }

  pickFirst(): void {
    const first = this.filtered().find(o => !o.disabled);
    if (first) this.pick(first);
  }

  onDocClick(e: Event): void {
    if (this.open() && !this.el.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
