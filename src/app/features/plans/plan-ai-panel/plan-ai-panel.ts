import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ProtocolSummaryItem, RiskItem } from '../../../core/models';
import { Observable } from 'rxjs';
import { AiAssistService, AiContext, AiResult } from '../../../core/services/ai-assist.service';
import { DialogService } from '../../../core/services/dialog.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { Icon } from '../../../shared/icons';
import { LoadingState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';

type Item = ProtocolSummaryItem | RiskItem;
interface Suggestion<T extends Item> {
  item: T;
  state: 'pending' | 'accepted' | 'rejected';
}

/**
 * Simulated AI assistant for the Monitoring Plan wizard. Generates deterministic placeholder suggestions;
 * nothing is applied to the form until the user accepts it, and replacing existing entries requires confirmation.
 */
@Component({
  selector: 'app-plan-ai-panel',
  imports: [FormsModule, Icon, LoadingState, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-ai-panel.html',
})
export class PlanAiPanel {
  private readonly ai = inject(AiAssistService);
  private readonly plans = inject(MonitoringPlanService);
  private readonly dialogs = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input.required<'summary' | 'risk'>();
  readonly context = input<AiContext | null>(null);
  readonly existingCount = input(0);
  readonly accepted = output<Item[]>();
  readonly replaced = output<Item[]>();

  protected readonly loading = signal(false);
  protected readonly result = signal<{ warnings: string[] } | null>(null);
  protected readonly suggestions = signal<Suggestion<Item>[]>([]);
  private variant = 0;

  protected readonly pendingCount = computed(() => this.suggestions().filter(s => s.state === 'pending').length);
  protected readonly acceptedCount = computed(() => this.suggestions().filter(s => s.state === 'accepted').length);

  isSummary(i: Item): i is ProtocolSummaryItem {
    return 'heading' in i;
  }

  rpn(r: RiskItem): number {
    return this.plans.rpn(r);
  }

  priority(r: RiskItem): string {
    return this.plans.priority(this.plans.rpn(r));
  }

  generate(): void {
    const ctx = this.context();
    if (!ctx) return;
    this.loading.set(true);
    const obs: Observable<AiResult<Item>> =
      this.mode() === 'summary' ? this.ai.generateProtocolSummary(ctx, this.variant) : this.ai.generateRisks(ctx, this.variant);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(res => {
      this.result.set({ warnings: res.warnings });
      this.suggestions.set(res.items.map(item => ({ item, state: 'pending' as const })));
      this.loading.set(false);
    });
  }

  async regenerate(): Promise<void> {
    if (this.pendingCount()) {
      const ok = await this.dialogs.confirm({ title: 'Regenerate suggestions?', message: 'Pending (not yet accepted) suggestions will be discarded. Items you already accepted stay in the plan.', confirmText: 'Regenerate' });
      if (!ok) return;
    }
    this.variant++;
    this.generate();
  }

  editSummary(i: number, summary: string): void {
    this.suggestions.update(list => list.map((s, idx) => (idx === i ? { ...s, item: { ...s.item, summary } as Item } : s)));
  }

  accept(i: number): void {
    const s = this.suggestions()[i];
    this.accepted.emit([s.item]);
    this.mark([i], 'accepted');
  }

  reject(i: number): void {
    this.mark([i], 'rejected');
  }

  acceptAll(): void {
    const idx = this.pendingIndexes();
    this.accepted.emit(idx.map(i => this.suggestions()[i].item));
    this.mark(idx, 'accepted');
  }

  async replaceAll(): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Replace existing entries?',
      message: `This removes the ${this.existingCount()} entr${this.existingCount() === 1 ? 'y' : 'ies'} currently in the plan (including anything you typed) and replaces them with the pending suggestions.`,
      confirmText: 'Replace',
      tone: 'danger',
    });
    if (!ok) return;
    const idx = this.pendingIndexes();
    this.replaced.emit(idx.map(i => this.suggestions()[i].item));
    this.mark(idx, 'accepted');
  }

  private pendingIndexes(): number[] {
    return this.suggestions().map((s, i) => (s.state === 'pending' ? i : -1)).filter(i => i >= 0);
  }

  private mark(indexes: number[], state: Suggestion<Item>['state']): void {
    this.suggestions.update(list => list.map((s, i) => (indexes.includes(i) ? { ...s, state } : s)));
  }
}
