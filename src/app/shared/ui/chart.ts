import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild, OnDestroy } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export interface ChartDatum {
  label: string;
  value: number;
}

const PALETTE = ['#0f766e', '#14b8a6', '#f59e0b', '#6366f1', '#ef4444', '#64748b', '#22c55e'];
const MAX_TICK_LINE = 12;

/** Splits a category label into short lines so bar ticks stay horizontal instead of rotating and overlapping. */
function wrapLabel(label: string): string[] {
  return label.split(' ').reduce<string[]>((lines, word) => {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= MAX_TICK_LINE) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
    return lines;
  }, []);
}

/** Thin Chart.js wrapper (doughnut / bar). Emits the clicked segment label for drill-down navigation. */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chart.html',
})
export class ChartView implements OnDestroy {
  readonly type = input<'doughnut' | 'bar'>('doughnut');
  readonly data = input.required<ChartDatum[]>();
  readonly height = input('16rem');
  readonly ariaLabel = input('Chart');
  readonly segmentClick = output<string>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const data = this.data();
      const type = this.type();
      const el = this.canvas().nativeElement;
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--color-ink-soft').trim() || '#4a5f5a';
      this.chart?.destroy();
      this.chart = new Chart(el, {
        type,
        data: {
          labels: data.map(d => d.label),
          datasets: [{ data: data.map(d => d.value), backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: type === 'doughnut' ? 2 : 0, borderRadius: type === 'bar' ? 6 : 0 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: type === 'doughnut', position: 'right', labels: { color: ink, boxWidth: 12 } } },
          scales: type === 'bar'
            ? {
                x: {
                  ticks: {
                    color: ink,
                    maxRotation: 0,
                    callback(value) {
                      return wrapLabel(this.getLabelForValue(Number(value)));
                    },
                  },
                  grid: { display: false },
                },
                y: { beginAtZero: true, ticks: { precision: 0, color: ink } },
              }
            : undefined,
          onClick: (_e, elements) => {
            const idx = elements[0]?.index;
            if (idx !== undefined) this.segmentClick.emit(data[idx].label);
          },
          onHover: (e, elements) => {
            const target = e.native?.target as HTMLElement | undefined;
            if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
          },
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
