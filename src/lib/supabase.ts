import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!client && supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

export async function syncUserProfile(userId: string, profileData: {
  username: string;
  email: string;
  avatar: string;
  streak: number;
  analyzedCount: number;
  lastActiveDate: string | null;
}) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (existing) {
    const { data: result, error } = await sb
      .from('profiles')
      .update({
        username: profileData.username,
        email: profileData.email,
        avatar: profileData.avatar,
        streak: profileData.streak,
        analyzed_count: profileData.analyzedCount,
        last_active_date: profileData.lastActiveDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();
    return error ? null : result;
  } else {
    const { data: result, error } = await sb
      .from('profiles')
      .insert({
        id: userId,
        username: profileData.username,
        email: profileData.email,
        avatar: profileData.avatar,
        streak: profileData.streak,
        analyzed_count: profileData.analyzedCount,
        last_active_date: profileData.lastActiveDate,
      })
      .select()
      .single();
    return error ? null : result;
  }
}

export async function syncUserSettings(userId: string, settings: Record<string, unknown>) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: existing } = await sb
    .from('user_settings')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const { data, error } = await sb
      .from('user_settings')
      .update({
        settings_json: settings,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();
    return error ? null : data;
  } else {
    const { data, error } = await sb
      .from('user_settings')
      .insert({
        user_id: userId,
        settings_json: settings,
      })
      .select()
      .single();
    return error ? null : data;
  }
}

export async function fetchUserSettings(userId: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('user_settings')
    .select('settings_json')
    .eq('user_id', userId)
    .single();

  return error ? null : (data?.settings_json as Record<string, unknown> ?? null);
}
