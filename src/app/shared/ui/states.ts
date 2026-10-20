import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../icons';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.html',
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly message = input('');
  readonly icon = input('inbox');
}

@Component({
  selector: 'app-loading-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-state.html',
})
export class LoadingState {
  readonly message = input('Loading…');
}

@Component({
  selector: 'app-error-state',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-state.html',
})
export class ErrorState {
  readonly title = input('Something went wrong');
  readonly message = input('');
  readonly backLink = input('');
  readonly backLabel = input('Go back');
}
