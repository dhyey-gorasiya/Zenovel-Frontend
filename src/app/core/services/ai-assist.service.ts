import { Injectable, inject } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { DataStore } from '../data/data-store.service';
import { FileMeta, Project, ProtocolSummaryItem, RiskItem } from '../models';

export interface AiContext {
  project: Project;
  protocolDocument: FileMeta | null;
  protocolVersionNo: string;
  referenceProductInfo: string;
  regulatoryGuideline: string;
}

export interface AiResult<T> {
  items: T[];
  warnings: string[];
  generatedAt: string;
}

const MISSING = '[Not available in the project record — enter from the protocol]';
const ref = (section: string) => `Refer protocol Section No. ${section} (simulated reference — verify against the protocol)`;

/**
 * SIMULATED AI. Produces deterministic placeholder content from the project record only.
 * No protocol text is read and no AI service is called. Replace with a real integration later.
 */
@Injectable({ providedIn: 'root' })
export class AiAssistService {
  private readonly data = inject(DataStore);

  warnings(ctx: AiContext): string[] {
    const w: string[] = [];
    if (!ctx.protocolDocument) w.push('No protocol document uploaded. Content below is based only on the project record.');
    else w.push(`"${ctx.protocolDocument.name}" was not analysed — the prototype cannot read documents. Section numbers are placeholders.`);
    if (!ctx.protocolVersionNo) w.push('Protocol version number is missing (Step 1).');
    if (!ctx.regulatoryGuideline) w.push('Regulatory guideline is missing (Step 1).');
    if (ctx.project.studyType === 'BA/BE' && !ctx.referenceProductInfo) w.push('BA/BE study: reference product information is missing.');
    if (ctx.project.studyType === 'BA/BE') w.push('BA/BE study: washout period, sampling schedule and bioanalytical method must be confirmed from the protocol.');
    if (ctx.project.blinding === 'Blind') w.push('Blinded study: unblinding procedures and blinded/unblinded role separation must be confirmed from the protocol.');
    if (ctx.project.studyType === 'Clinical Trial') w.push('Clinical trial: primary/secondary endpoints and SAE reporting timelines must be confirmed from the protocol.');
    return w;
  }

  generateProtocolSummary(ctx: AiContext, variant: number): Observable<AiResult<ProtocolSummaryItem>> {
    const p = ctx.project;
    const item = (heading: string, summary: string, section: string): ProtocolSummaryItem => ({
      id: this.data.localId('PS'),
      heading,
      summary,
      sourceSection: ref(section),
      aiGenerated: true,
    });
    const common = [
      item('Study Title', p.protocolTitle || MISSING, '1'),
      item('Protocol Number / Version', `${p.protocolNo}${ctx.protocolVersionNo ? `, version ${ctx.protocolVersionNo}` : ' — version ' + MISSING}`, '1'),
      item('Sponsor and CRO', `${p.sponsor.name} / ${p.cro.name}`, '1'),
    ];
    const specific =
      p.studyType === 'BA/BE'
        ? [
            item('Study Design', `${p.blinding} bioavailability/bioequivalence study. ${variant % 2 ? 'Number of periods and sequences' : 'Crossover design details'}: ${MISSING}`, '6.1'),
            item('Investigational and Reference Products', ctx.referenceProductInfo || MISSING, '7'),
            item('Washout Period', MISSING, '6.2'),
            item('Pharmacokinetic Sampling Schedule', MISSING, '9.1'),
            item('Bioanalytical Method', MISSING, '10'),
            item('Safety Assessments', MISSING, '11'),
          ]
        : [
            item('Study Design', `${p.blinding === 'Blind' ? 'Blinded' : 'Open-label'} clinical trial. ${variant % 2 ? 'Randomisation scheme' : 'Arms and allocation'}: ${MISSING}`, '6'),
            item('Objectives and Endpoints', MISSING, '3'),
            item('Study Population', MISSING, '5'),
            item('Blinding and Unblinding', p.blinding === 'Blind' ? MISSING : 'Open-label — not applicable', '6.3'),
            item('Visit Schedule', MISSING, '8'),
            item('Safety Reporting (AE/SAE)', MISSING, '11'),
          ];
    return of({ items: [...common, ...specific], warnings: this.warnings(ctx), generatedAt: new Date().toISOString() }).pipe(delay(900));
  }

  generateRisks(ctx: AiContext, variant: number): Observable<AiResult<RiskItem>> {
    const p = ctx.project;
    const risk = (description: string, category: string, s: number, l: number, d: number, mitigation: string, responsibleRole: string, milestone: string, indicators: string, escalationTriggers: string, section: string): RiskItem => ({
      id: this.data.localId('R'),
      description,
      category,
      severity: s,
      likelihood: Math.min(5, l + (variant % 2)),
      detectability: d,
      mitigation,
      responsibleRole,
      milestone,
      indicators,
      escalationTriggers,
      residualRisk: 'To be assessed after mitigation',
      sourceRef: ref(section),
      aiGenerated: true,
    });
    const items =
      p.studyType === 'BA/BE'
        ? [
            risk('Deviation from scheduled PK sampling times', 'Protocol Compliance', 4, 3, 2, 'Verify sampling logs at each period; time-synchronised clocks', 'Primary Monitor', 'P01 Dosing', 'Sampling time deviations per period', 'More than the protocol-allowed deviations in a period', '9.1'),
            risk('Sample handling or storage temperature excursion', 'Bioanalytical', 5, 2, 3, 'Review temperature logs and chain of custody', 'Secondary Monitor', 'IPBM', 'Temperature excursions logged', 'Any excursion affecting study samples', '9.3'),
            risk('Dosing errors or incorrect product administration', 'Investigational Product', 5, 2, 2, 'Witness dosing; verify randomisation and IP labels', 'Primary Monitor', 'P01 Dosing', 'Dosing discrepancies', 'Any dosing error', '7'),
            risk('Inadequate washout between periods', 'Protocol Compliance', 4, 2, 2, 'Confirm period dates against protocol washout', 'Project Manager', 'P02 Check In', 'Period interval compliance', 'Washout shorter than protocol requirement', '6.2'),
            risk('Subject eligibility not verified before check-in', 'Subject Safety', 4, 2, 3, 'Source verify eligibility at check-in', 'Primary Monitor', 'P01 Check In', 'Eligibility deviations', 'Any ineligible subject dosed', '5'),
          ]
        : [
            risk('Informed consent obtained with an outdated version', 'Informed Consent', 5, 2, 3, 'Verify ICF version control at SIV and each IMV', 'Primary Monitor', 'SIV', 'ICF version discrepancies', 'Any subject consented on an outdated version', '13'),
            risk('Delayed SAE reporting', 'Subject Safety', 5, 2, 3, 'Retrain site; review SAE logs each visit', 'Primary Monitor', 'IMV-1/IMV-2', 'SAE reporting timeliness', 'SAE reported outside protocol timeline', '11'),
            risk('Inadvertent unblinding', 'Protocol Compliance', 5, 1, 4, 'Separate blinded/unblinded monitor duties and documents', 'Project Manager', 'SIV', 'Unblinding incidents', 'Any unplanned unblinding', '6.3'),
            risk('Investigational product accountability discrepancies', 'Investigational Product', 4, 3, 2, 'Unblinded monitor reconciles IP each visit', 'Secondary Monitor', 'IMV-1/IMV-2', 'IP reconciliation variances', 'Unexplained IP variance', '7'),
            risk('Delayed data entry affecting interim review', 'Data Integrity', 3, 3, 2, 'Track data entry timelines remotely', 'Secondary Monitor', 'IMV-1/IMV-2', 'Data entry backlog', 'Backlog beyond agreed timeline', '12'),
          ];
    if (p.blinding !== 'Blind') {
      const idx = items.findIndex(r => r.category === 'Protocol Compliance' && r.description.includes('unblinding'));
      if (idx >= 0) items.splice(idx, 1);
    }
    return of({ items, warnings: this.warnings(ctx), generatedAt: new Date().toISOString() }).pipe(delay(1100));
  }
}
