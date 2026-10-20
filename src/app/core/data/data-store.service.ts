import { Injectable, inject, signal } from '@angular/core';
import {
  ActivityItem,
  AppNotification,
  Delegation,
  Entity,
  MonitorAssignment,
  MonitoringPlan,
  MonitoringReport,
  Project,
  SimulatedEmail,
  User,
} from '../models';
import { ENTITY_STORE_FACTORY, EntityStore, StoreIssue } from './entity-store';
import { IdService } from './id.service';
import * as seed from './seed';

const PREFIX = 'zen.v2.';

/**
 * Data-access layer: owns one store per entity. Domain services hold the business rules;
 * components never touch this directly.
 */
@Injectable({ providedIn: 'root' })
export class DataStore {
  private readonly factory = inject(ENTITY_STORE_FACTORY);
  private readonly ids = inject(IdService);

  /** Problems found while loading persisted data (shown in Settings and once at startup). */
  readonly issues = signal<StoreIssue[]>([]);

  readonly users = this.store<User>('users', seed.seedUsers);
  readonly projects = this.store<Project>('projects', seed.seedProjects);
  readonly plans = this.store<MonitoringPlan>('plans', seed.seedPlans);
  readonly delegations = this.store<Delegation>('delegations', seed.seedDelegations);
  readonly assignments = this.store<MonitorAssignment>('assignments', seed.seedAssignments);
  readonly reports = this.store<MonitoringReport>('reports', seed.seedReports);
  readonly notifications = this.store<AppNotification>('notifications', seed.seedNotifications);
  readonly activity = this.store<ActivityItem>('activity', seed.seedActivity);
  readonly emails = this.store<SimulatedEmail>('emails', seed.seedEmails);

  nextId<T extends Entity>(prefix: string, store: EntityStore<T>): string {
    return this.ids.next(prefix, store.items());
  }

  localId(prefix: string): string {
    return this.ids.local(prefix);
  }

  /** Restores the original sample dataset (Settings → Reset Demo Data). */
  resetAll(): void {
    this.ids.reset();
    [this.users, this.projects, this.plans, this.delegations, this.assignments, this.reports, this.notifications, this.activity, this.emails]
      .forEach(s => (s as EntityStore<Entity>).reset());
    this.issues.set([]);
  }

  private store<T extends Entity>(name: string, seedFn: () => T[]): EntityStore<T> {
    return this.factory.create<T>(PREFIX + name, seedFn, issue => this.issues.update(list => [...list, issue]));
  }
}
