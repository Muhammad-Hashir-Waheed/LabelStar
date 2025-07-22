import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserTrackingAssignment {
  total_assigned: number;
  total_used: number;
  available: number;
}

/**
 * Get the current user's tracking ID assignment
 */
export async function getUserTrackingAssignment(): Promise<UserTrackingAssignment | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_tracking_assignments')
      .select('total_assigned, total_used')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error loading tracking assignment:', error);
      return null;
    }

    return {
      total_assigned: data?.total_assigned || 0,
      total_used: data?.total_used || 0,
      available: (data?.total_assigned || 0) - (data?.total_used || 0)
    };
  } catch (error) {
    console.error('Error getting user tracking assignment:', error);
    return null;
  }
}

/**
 * Consume a tracking ID for label generation
 * Returns the tracking number if successful, throws error if no tracking IDs available
 */
export async function consumeTrackingIdForLabel(labelId: string): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('consume_tracking_id_for_label', {
      user_id: user.id,
      label_id: labelId
    });

    if (error) {
      throw new Error(error.message || 'Failed to consume tracking ID');
    }

    return data;
  } catch (error) {
    console.error('Error consuming tracking ID:', error);
    throw error;
  }
}

/**
 * Check if user has available tracking IDs
 */
export async function hasAvailableTrackingIds(): Promise<boolean> {
  const assignment = await getUserTrackingAssignment();
  return assignment ? assignment.available > 0 : false;
}

/**
 * Get the number of available tracking IDs for the current user
 */
export async function getAvailableTrackingIdCount(): Promise<number> {
  const assignment = await getUserTrackingAssignment();
  return assignment ? assignment.available : 0;
}

/**
 * Format tracking number for display (add spaces for USPS format)
 */
export function formatTrackingNumber(number: string): string {
  const cleaned = number.replace(/\s/g, '');
  if (cleaned.length === 22) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)} ${cleaned.slice(12, 16)} ${cleaned.slice(16, 20)} ${cleaned.slice(20)}`;
  }
  return number;
}

/**
 * Validate USPS tracking number format
 */
export function validateTrackingNumber(number: string): boolean {
  const cleaned = number.replace(/\s/g, '');
  return cleaned.length >= 20 && cleaned.length <= 22 && /^\d+$/.test(cleaned);
} 