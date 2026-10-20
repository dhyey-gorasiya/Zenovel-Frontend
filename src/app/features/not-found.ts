import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorState } from '../shared/ui/states';

@Component({
  imports: [ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.html',
})
export class NotFound {}
