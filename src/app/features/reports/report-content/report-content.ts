import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AppSettingsService, ReportSectionKey } from '../../../core/data/app-settings.service';
import { ReportContent } from '../../../core/models';

/** Renders the configurable (provisional) report sections. */
@Component({
  selector: 'app-report-content',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-content.html',
})
export class ReportContentView {
  protected readonly settings = inject(AppSettingsService);
  readonly content = input.required<ReportContent>();
  readonly showProvisional = input(true);

  text(key: ReportSectionKey): string {
    const v = this.content()[key];
    return typeof v === 'string' ? v : '';
  }
}
