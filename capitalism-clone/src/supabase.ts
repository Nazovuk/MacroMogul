import { createClient } from '@supabase/supabase-js';

// These should be moved to .env for production
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * MacroMogul Persistence Service
 * Handles cloud-sync for user profiles and save states.
 */
export const persistenceService = {
  async saveGame(userId: string, slotId: string, gameState: any) {
    const { data, error } = await supabase
      .from('saves')
      .upsert({ 
        user_id: userId, 
        slot_id: slotId, 
        data: gameState,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    return data;
  },

  async loadGame(userId: string, slotId: string) {
    const { data, error } = await supabase
      .from('saves')
      .select('data')
      .eq('user_id', userId)
      .eq('slot_id', slotId)
      .single();
    
    if (error) throw error;
    return data?.data;
  }
};
