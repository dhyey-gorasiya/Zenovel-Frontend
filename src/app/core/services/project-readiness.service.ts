import { Injectable, inject } from '@angular/core';
import { DataStore } from '../data/data-store.service';

/**
 * Approval gates for a project's downstream work:
 * Monitoring Plan finally approved (HOD + sponsor) → Training & Delegation →
 * HOD/VP-authorized delegation → Monitor Assignments and Monitoring Reports.
 * Gates apply to creating new records only; existing records stay viewable and editable.
 */
@Injectable({ providedIn: 'root' })
export class ProjectReadinessService {
  private readonly data = inject(DataStore);

  planApproved(projectId: string | null | undefined): boolean {
    return !!projectId && this.data.plans.items().some(p => p.projectId === projectId && p.status === 'Approved');
  }

  delegationAuthorized(projectId: string | null | undefined): boolean {
    return !!projectId && this.data.delegations.items().some(d => d.projectId === projectId && d.authorization === 'Authorized');
  }

  canDelegate(projectId: string | null | undefined): boolean {
    return this.planApproved(projectId);
  }

  /** Monitor Assignments and Monitoring Reports share the same gate. */
  canAssign(projectId: string | null | undefined): boolean {
    return this.planApproved(projectId) && this.delegationAuthorized(projectId);
  }

  /** Short label for a locked project in pickers; empty when unlocked. */
  delegateLockHint(projectId: string | null | undefined): string {
    return this.canDelegate(projectId) ? '' : 'Locked · Monitoring Plan not finally approved';
  }

  assignLockHint(projectId: string | null | undefined): string {
    if (!this.planApproved(projectId)) return 'Locked · Monitoring Plan not finally approved';
    return this.delegationAuthorized(projectId) ? '' : 'Locked · no HOD/VP-authorized delegation';
  }

  delegateBlockReason(projectId: string | null | undefined): string {
    return this.canDelegate(projectId) ? '' : 'Training & Delegation unlocks once the Monitoring Plan for this project is finally approved (HOD approval and sponsor sign-off).';
  }

  assignBlockReason(projectId: string | null | undefined): string {
    if (!this.planApproved(projectId)) return 'Monitor Assignments and Monitoring Reports unlock once the Monitoring Plan is finally approved and a Training & Delegation record is authorized by HOD/VP.';
    if (!this.delegationAuthorized(projectId)) return 'Monitor Assignments and Monitoring Reports unlock once a Training & Delegation record for this project is authorized by HOD/VP.';
    return '';
  }
}
