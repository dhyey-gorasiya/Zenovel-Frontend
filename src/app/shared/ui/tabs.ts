import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tabs.html',
})
export class Tabs {
  readonly tabs = input.required<TabItem[]>();
  readonly active = model.required<string>();
}
