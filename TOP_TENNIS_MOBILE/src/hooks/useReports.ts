import { useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type ReportContext = 'message' | 'profile' | 'group' | 'other';

export interface ReportInput {
  targetUserId?: string;
  context: ReportContext;
  refId?: string;
  reason: string;
  details?: string;
}

/** Standard report reasons offered to the user. */
export const REPORT_REASONS = [
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Spam or scam',
  'Inappropriate or explicit content',
  'Impersonation',
  'Other',
];

export function useReports() {
  const { user } = useAuth();

  const report = useCallback(async (input: ReportInput) => {
    if (!user?.id) throw new Error('You must be signed in to report content.');
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id,
      target_user_id: input.targetUserId ?? null,
      context: input.context,
      ref_id: input.refId ?? null,
      reason: input.reason,
      details: input.details ?? null,
    });
    if (error) throw error;
  }, [user?.id]);

  return { report };
}
