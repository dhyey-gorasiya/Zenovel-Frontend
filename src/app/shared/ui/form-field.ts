import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const MESSAGES: Record<string, (e: any) => string> = {
  required: () => 'This field is required.',
  email: () => 'Enter a valid email address.',
  emailList: () => 'Enter valid email addresses separated by commas.',
  minlength: e => `Enter at least ${e.requiredLength} characters.`,
  maxlength: e => `Enter no more than ${e.requiredLength} characters.`,
  min: e => `Must be at least ${e.min}.`,
  max: e => `Must be at most ${e.max}.`,
  pattern: () => 'Invalid format.',
};

export const errorMessage = (control: AbstractControl | null | undefined): string => {
  const errors = control?.errors;
  if (!errors) return '';
  const [key, value] = Object.entries(errors)[0];
  return typeof value === 'string' ? value : (MESSAGES[key]?.(value) ?? 'Invalid value.');
};

/** Label + hint + validation message wrapper for any projected input. */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'flex flex-col gap-1 min-w-0' },
  templateUrl: './form-field.html',
})
export class FormField {
  readonly label = input.required<string>();
  readonly control = input<AbstractControl | null>(null);
  readonly required = input(false);
  readonly hint = input('');
  readonly for = input('');

  message(): string {
    return errorMessage(this.control());
  }
}
