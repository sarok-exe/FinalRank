import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { isValidUsername, isValidEmail, sanitizeDisplay } from './validator';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!client && supabaseUrl !== '' && supabaseAnonKey !== '') {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return supabaseUrl !== '' && supabaseAnonKey !== '';
}

export async function syncUserProfile(userId: string, profileData: {
  username: string;
  email: string;
  avatar: string;
  analyzedCount: number;
  lastActiveDate: string | null;
}): Promise<unknown> {
  if (!isValidUsername(profileData.username)) throw new Error('Invalid username');
  if (profileData.email && !isValidEmail(profileData.email)) throw new Error('Invalid email');

  const sb = getSupabase();
  if (!sb) return null;

  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (existing) {
    const { data: result, error } = (await sb
      .from('profiles')
      .update({
        username: profileData.username,
        email: profileData.email,
        avatar: profileData.avatar,
        analyzed_count: profileData.analyzedCount,
        last_active_date: profileData.lastActiveDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()) as { data: unknown; error: unknown };
    return error != null ? null : result;
  } else {
    const { data: result, error } = (await sb
      .from('profiles')
      .insert({
        id: userId,
        username: profileData.username,
        email: profileData.email,
        avatar: profileData.avatar,
        analyzed_count: profileData.analyzedCount,
        last_active_date: profileData.lastActiveDate,
      })
      .select()
      .single()) as { data: unknown; error: unknown };
    return error != null ? null : result;
  }
}

export async function syncUserSettings(userId: string, settings: Record<string, unknown>): Promise<unknown> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: existing } = await sb
    .from('user_settings')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const { data, error } = (await sb
      .from('user_settings')
      .update({
        settings_json: settings,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single()) as { data: unknown; error: unknown };
    return error != null ? null : data;
  } else {
    const { data, error } = (await sb
      .from('user_settings')
      .insert({
        user_id: userId,
        settings_json: settings,
      })
      .select()
      .single()) as { data: unknown; error: unknown };
    return error != null ? null : data;
  }
}

export async function fetchUserSettings(userId: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = (await sb
    .from('user_settings')
    .select('settings_json')
    .eq('user_id', userId)
    .single()) as { data: unknown; error: unknown };

  return error != null ? null : (data as { settings_json?: Record<string, unknown> }).settings_json ?? null;
}
