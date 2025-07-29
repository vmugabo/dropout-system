import { supabase } from '../supabaseClient';

export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profile')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}
