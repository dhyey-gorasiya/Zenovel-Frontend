import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icons';

export interface Step {
  label: string;
  invalid?: boolean;
}

/** Multi-step form progress indicator. Steps are clickable so users can jump back and edit. */
@Component({
  selector: 'app-stepper',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stepper.html',
})
export class Stepper {
  readonly steps = input.required<Step[]>();
  readonly current = input.required<number>();
  readonly select = output<number>();
}
