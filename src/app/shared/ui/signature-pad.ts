import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Icon } from '../icons';

/** Prototype signature simulation: typed name + attestation checkbox. Not a legally binding e-signature. */
@Component({
  selector: 'app-signature-pad',
  imports: [FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signature-pad.html',
})
export class SignaturePad {
  readonly expectedName = input.required<string>();
  readonly statement = input.required<string>();
  readonly typedName = model('');
  readonly attested = model(false);
  readonly valid = computed(() => this.attested() && this.normalize(this.typedName()) === this.normalize(this.expectedName()));

  private normalize(s: string): string {
    return s.replace(/^dr\.?\s+/i, '').trim().toLowerCase();
  }
}
