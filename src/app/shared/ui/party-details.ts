import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PartyDetails as Party } from '../../core/models';

/** Name, contact line and address of a CRO / sponsor. */
@Component({
  selector: 'app-party-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (party(); as p) {
      <span class="font-medium">{{ p.name || '—' }}</span>
      @if (contact()) { <span class="block text-xs text-ink-soft">{{ contact() }}</span> }
      @if (p.address) { <span class="block text-xs text-ink-soft">{{ p.address }}</span> }
    } @else {
      —
    }
  `,
})
export class PartyDetails {
  readonly party = input<Party | null | undefined>();

  protected readonly contact = computed(() => {
    const p = this.party();
    return p ? [p.contactPerson, p.email, p.phone].filter(Boolean).join(' · ') : '';
  });
}
