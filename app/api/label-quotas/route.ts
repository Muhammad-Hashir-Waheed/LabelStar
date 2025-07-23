import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
  }

  const { user_id, total_labels_allowed } = await req.json();
  const { data, error } = await supabase.from('label_quotas').upsert([
    { user_id, total_labels_allowed }
  ], { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ quota: data });
}

export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  let query = supabase.from('label_quotas').select('*');
  if (user_id) query = query.eq('user_id', user_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ quotas: data });
} 