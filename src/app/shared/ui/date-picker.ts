import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let seq = 0;

/** Native date (or time) input wrapped as a form control, with optional min/max. Values are ISO `YYYY-MM-DD` / `HH:mm`. */
@Component({
  selector: 'app-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePicker), multi: true }],
  templateUrl: './date-picker.html',
})
export class DatePicker implements ControlValueAccessor {
  readonly type = input<'date' | 'time'>('date');
  readonly min = input('');
  readonly max = input('');
  readonly inputId = input(`zn-date-${++seq}`);
  readonly ariaLabel = input('');

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
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

  onInput(v: string): void {
    this.value.set(v);
    this.onChange(v);
  }
}
