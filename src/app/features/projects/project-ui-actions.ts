import { Injectable, inject } from '@angular/core';
import { Project } from '../../core/models';
import { DialogService } from '../../core/services/dialog.service';
import { ProjectService } from '../../core/services/project.service';
import { ToastService } from '../../core/services/toast.service';

/** Shared confirm-then-delete flow used by the project list and detail pages. */
@Injectable({ providedIn: 'root' })
export class ProjectUiActions {
  private readonly projects = inject(ProjectService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  async delete(p: Project): Promise<boolean> {
    const deps = this.projects.dependents(p.id);
    const details = deps.total
      ? [
          `${deps.plans} monitoring plan(s)`,
          `${deps.delegations} delegation record(s)`,
          `${deps.assignments} monitor assignment(s)`,
          `${deps.reports} monitoring report(s)`,
        ].filter(x => !x.startsWith('0 '))
      : undefined;
    const ok = await this.dialogs.confirm({
      title: `Delete ${p.name}?`,
      message: deps.total
        ? `This project has ${deps.total} dependent record(s). Cascade-delete policy: deleting the project permanently removes all of the following linked records as well.`
        : 'This project has no linked records. This cannot be undone.',
      details,
      confirmText: deps.total ? `Delete project and ${deps.total} record(s)` : 'Delete project',
      tone: 'danger',
    });
    if (!ok) return false;
    this.projects.delete(p.id);
    this.toast.success(`Project ${p.id} deleted.`);
    return true;
  }
}
