import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  const { user_id, label_data, tracking_number } = await req.json();
  const { data, error } = await supabase.from('shipping_labels').insert([{ 
    user_id, 
    label_data, 
    tracking_number,
    status: 'generated'
  }]) as { data: any[] | null, error: any };
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Label not created' }, { status: 500 });
  return NextResponse.json({ label: data[0] });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  let query = supabase.from('shipping_labels').select('*').order('created_at', { ascending: false });
  if (user_id) query = query.eq('user_id', user_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ labels: data });
} 