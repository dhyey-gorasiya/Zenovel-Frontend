import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'review';

const TONES: Record<string, Tone> = {
  Active: 'ok', Approved: 'ok', Authorized: 'ok', Acknowledged: 'ok', Completed: 'info', 'HOD Approved': 'review',
  Planning: 'muted', Draft: 'muted', 'Not Submitted': 'muted', 'Not Requested': 'muted', 'Not Sent': 'muted', Planned: 'muted', Cancelled: 'muted',
  'On Hold': 'warn', Pending: 'warn', 'In PM Review': 'warn', 'Pending HOD Approval': 'warn', 'In Review': 'review', Notified: 'review',
  'Changes Requested': 'danger', Rejected: 'danger', Declined: 'danger',
  High: 'danger', Medium: 'warn', Low: 'ok',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status-badge.html',
})
export class StatusBadge {
  readonly status = input.required<string>();
  readonly label = input('');
  readonly tone = computed<Tone>(() => TONES[this.status()] ?? 'review');
}

export const statusTone = (status: string): string => 'zn-badge-' + (TONES[status] ?? 'review');
