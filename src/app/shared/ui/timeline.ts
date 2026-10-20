import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReviewEntry } from '../../core/models';
import { Icon } from '../icons';

export interface TimelineItem {
  id?: string;
  at: string;
  title: string;
  subtitle?: string;
  link?: string;
}

@Component({
  selector: 'app-activity-timeline',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-timeline.html',
})
export class ActivityTimeline {
  readonly items = input.required<TimelineItem[]>();
  readonly emptyText = input('No activity yet.');
}

@Component({
  selector: 'app-approval-history',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './approval-history.html',
})
export class ApprovalHistory {
  readonly entries = input.required<ReviewEntry[]>();
  readonly emptyText = input('No review actions yet.');

  icon(action: string): string {
    const a = action.toLowerCase();
    if (a.includes('reject') || a.includes('return')) return 'circle-x';
    if (a.includes('change')) return 'message-square';
    if (a.includes('approv') || a.includes('sign')) return 'badge-check';
    if (a.includes('share') || a.includes('submit')) return 'send';
    return 'message-square';
  }
}
