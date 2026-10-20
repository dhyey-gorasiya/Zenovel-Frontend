import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { BLINDING_TYPES, PROJECT_STATUSES, STUDY_TYPES } from '../../../core/config/domain.config';
import { Project } from '../../../core/models';
import { ProjectService } from '../../../core/services/project.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { DataTable } from '../../../shared/data-table/data-table';
import { TableAction, TableColumn } from '../../../shared/data-table/data-table.models';
import { Icon } from '../../../shared/icons';
import { FilterBar, FilterDef, matches, toOptions } from '../../../shared/ui/filter-bar';
import { PageHeader } from '../../../shared/ui/page-header';
import { ProjectUiActions } from '../project-ui-actions';

@Component({
  imports: [DataTable, FilterBar, PageHeader, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-list.html',
})
export class ProjectList {
  private readonly router = inject(Router);
  private readonly projects = inject(ProjectService);
  private readonly users = inject(UserDirectoryService);
  private readonly ui = inject(ProjectUiActions);
  protected readonly roles = inject(DemoRoleService);

  protected readonly search = signal('');
  protected readonly filterValues = signal<Record<string, string>>({});

  protected readonly filters = computed<FilterDef[]>(() => [
    { key: 'status', label: 'Status', options: toOptions(PROJECT_STATUSES) },
    { key: 'studyType', label: 'Study type', options: toOptions(STUDY_TYPES) },
    { key: 'blinding', label: 'Blinding', options: toOptions(BLINDING_TYPES) },
    { key: 'sponsor', label: 'Sponsor', options: toOptions([...new Set(this.projects.visible().map(p => p.sponsor.name))].sort()) },
  ]);

  protected readonly rows = computed(() => {
    const f = this.filterValues();
    const q = this.search();
    return this.projects.visible().filter(
      p =>
        (!f['status'] || p.status === f['status']) &&
        (!f['studyType'] || p.studyType === f['studyType']) &&
        (!f['blinding'] || p.blinding === f['blinding']) &&
        (!f['sponsor'] || p.sponsor.name === f['sponsor']) &&
        matches(q, p.id, p.name, p.protocolNo, p.protocolTitle, p.zenovelProjectNo, p.sponsor.name, p.cro.name, this.users.name(p.projectManagerId)),
    );
  });

  protected readonly columns: TableColumn<Project>[] = [
    { key: 'id', label: 'Project ID', type: 'link', link: p => `/projects/${p.id}` },
    { key: 'name', label: 'Project Name', type: 'strong' },
    { key: 'protocolNo', label: 'Protocol No.' },
    { key: 'protocolTitle', label: 'Protocol Title', type: 'muted', value: p => (p.protocolTitle.length > 48 ? p.protocolTitle.slice(0, 48) + '…' : p.protocolTitle) },
    { key: 'studyType', label: 'Study Type', value: p => `${p.studyType} · ${p.blinding}` },
    { key: 'sponsor', label: 'Sponsor', value: p => p.sponsor.name },
    { key: 'cro', label: 'CRO', value: p => p.cro.name },
    { key: 'pm', label: 'Project Manager', value: p => this.users.name(p.projectManagerId) },
    { key: 'status', label: 'Status', type: 'badge' },
    { key: 'updatedAt', label: 'Last Updated', type: 'muted', value: p => p.updatedAt.slice(0, 10) },
  ];

  protected readonly actions: TableAction<Project>[] = [
    { label: 'View', icon: 'view', onClick: p => this.router.navigate(['/projects', p.id]) },
    { label: 'Edit', icon: 'edit', show: () => this.roles.can('project.manage'), onClick: p => this.router.navigate(['/projects', p.id, 'edit']) },
    { label: 'Delete', icon: 'delete', show: () => this.roles.can('project.manage'), onClick: p => this.ui.delete(p) },
  ];

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const status = q.get('status');
      if (status) this.filterValues.set({ status });
    });
  }
}
