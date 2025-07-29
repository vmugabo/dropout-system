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
  
  // Show user-friendly error
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #f44336;
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    text-align: center;
    font-family: Arial, sans-serif;
  `;
  errorDiv.innerHTML = `
    <h2>🚨 Configuration Error</h2>
    <p><strong>Missing Supabase environment variables!</strong></p>
    <p>Please add the following environment variables to your Amplify app:</p>
    <ul style="text-align: left; max-width: 500px; margin: 20px auto;">
      <li><code>REACT_APP_SUPABASE_URL</code> - Your Supabase project URL</li>
      <li><code>REACT_APP_SUPABASE_ANON_KEY</code> - Your Supabase anon key</li>
    </ul>
    <p>Go to: Amplify Console → App Settings → Environment Variables</p>
    <button onclick="window.location.reload()" style="
      padding: 10px 20px;
      background: white;
      color: #f44336;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      margin-top: 20px;
    ">Reload After Adding Variables</button>
  `;
  document.body.appendChild(errorDiv);
  
  // Return a dummy client to prevent crashes
  return createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
