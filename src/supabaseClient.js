import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Debug logging
console.log('Supabase config:', { 
  url: supabaseUrl ? 'Set' : 'Missing', 
  key: supabaseKey ? 'Set' : 'Missing' 
});

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables:', {
    REACT_APP_SUPABASE_URL: !!supabaseUrl,
    REACT_APP_SUPABASE_ANON_KEY: !!supabaseKey
  });
}

export const supabase = createClient(supabaseUrl, supabaseKey);
