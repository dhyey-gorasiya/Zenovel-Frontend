import { DestroyRef, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { debounceTime } from 'rxjs';

const PREFIX = 'zen.v2.draft.';

/**
 * Keeps unsaved form values in sessionStorage so users don't lose work when they
 * navigate away (e.g. to check a project) and come back within the same tab.
 */
@Injectable({ providedIn: 'root' })
export class FormDraftService {
  restore<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  track(key: string, control: AbstractControl, destroyRef: DestroyRef): void {
    control.valueChanges.pipe(debounceTime(400), takeUntilDestroyed(destroyRef)).subscribe(() => {
      if (!control.dirty) return;
      try {
        sessionStorage.setItem(PREFIX + key, JSON.stringify(control.getRawValue()));
      } catch {
        /* storage unavailable */
      }
    });
  }

  clear(key: string): void {
    try {
      sessionStorage.removeItem(PREFIX + key);
    } catch {
      /* storage unavailable */
    }
  }
}
