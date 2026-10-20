import { Injectable, computed, inject } from '@angular/core';
import { DataStore } from '../data/data-store.service';
import { Role, SessionUser } from '../models';

/** Read-only lookup of people (PMs, monitors, HOD/VP, sponsors). */
@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private readonly data = inject(DataStore);

  readonly all = computed<SessionUser[]>(() => this.data.users.items().map(({ password: _p, ...u }) => u));
  readonly managers = computed(() => this.byRole('Project Manager'));
  readonly monitors = computed(() => this.byRole('Monitor'));
  readonly approvers = computed(() => this.byRole('HOD/VP'));
  readonly sponsors = computed(() => this.byRole('Sponsor'));

  get(id: string | null | undefined): SessionUser | undefined {
    return id ? this.all().find(u => u.id === id) : undefined;
  }

  name(id: string | null | undefined): string {
    return this.get(id)?.name ?? '—';
  }

  email(id: string | null | undefined): string {
    return this.get(id)?.email ?? '';
  }

  sponsorUsers(organization: string): SessionUser[] {
    return this.sponsors().filter(u => u.organization === organization);
  }

  private byRole(role: Role): SessionUser[] {
    return this.all().filter(u => u.role === role);
  }
}
