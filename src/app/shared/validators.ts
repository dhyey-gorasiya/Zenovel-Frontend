import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Group validator: `end` must be on/after `start` (works for ISO dates and HH:mm times). Sets the error on the end control. */
export const rangeValidator = (startKey: string, endKey: string, message: string): ValidatorFn => (group: AbstractControl): ValidationErrors | null => {
  const start = group.get(startKey);
  const end = group.get(endKey);
  if (!start || !end) return null;
  const invalid = !!start.value && !!end.value && end.value < start.value;
  const errors = { ...(end.errors ?? {}) };
  if (invalid) errors['range'] = message;
  else delete errors['range'];
  end.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: false });
  return invalid ? { range: message } : null;
};

/** Comma-separated list of email addresses. Empty is allowed (combine with required if needed). */
export const emailListValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  if (!v) return null;
  return v.split(',').map(s => s.trim()).filter(Boolean).every(s => EMAIL.test(s)) ? null : { emailList: true };
};

/** Stricter email check than Angular's built-in (requires a dot in the domain). */
export const emailValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  return !v || EMAIL.test(v) ? null : { email: true };
};

export const splitEmails = (v: string): string[] => v.split(',').map(s => s.trim()).filter(Boolean);
