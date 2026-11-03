export const CALL_OUTCOMES = [
  'No Answer', 'Busy', 'Voicemail', 'Wrong Number', 'Not Interested',
  'Callback Requested', 'Interested', 'Appointment Set', 'Other',
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export interface Call {
  id: string;
  lead: { id: string; firstName: string; lastName: string; phone: string; country: string } | string;
  agent: { id: string; name: string } | string;
  phone: string;
  direction: 'outbound' | 'inbound';
  startedAt: string;
  durationSec: number;
  outcome: CallOutcome | null;
  notes: string;
  status: 'pending' | 'logged';
  source: 'app' | 'device_import';
  verificationStatus: 'unverified' | 'verified';
  possibleDuplicate: boolean;
  warning?: string;
}

export interface CallPage {
  items: Call[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ImportSummary {
  received: number;
  verified: number;
  created: number;
  skippedUnknownNumber: number;
  skippedInvalid: number;
}

export interface CallInput {
  leadId?: string;
  direction?: 'outbound' | 'inbound';
  startedAt?: string;
  durationSec?: number;
  outcome?: CallOutcome | null;
  notes?: string;
}
