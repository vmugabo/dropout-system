import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const { error, user } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else onLogin(user);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)' }}>
      <div style={{ background: '#fff', padding: 48, borderRadius: 16, boxShadow: '0 4px 32px #0002', minWidth: 380, maxWidth: 420, width: '100%' }}>
        <h1 style={{ textAlign: 'center', color: '#1976d2', marginBottom: 16, fontSize: 32, fontWeight: 800, letterSpacing: 1 }}>Welcome to Komeza Wige</h1>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: 32, fontSize: 18 }}>Please log in to continue</p>
        <form onSubmit={handleLogin}>
          <h2 style={{ textAlign: 'center', color: '#1976d2', marginBottom: 24 }}>Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
            style={{ width: '100%', marginBottom: 16, padding: 12, borderRadius: 6, border: '1px solid #bbb', fontSize: 16 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
            style={{ width: '100%', marginBottom: 16, padding: 12, borderRadius: 6, border: '1px solid #bbb', fontSize: 16 }}
      />
          <button type="submit" style={{ width: '100%', padding: 12, borderRadius: 6, background: '#1976d2', color: '#fff', fontWeight: 700, fontSize: 18, border: 'none', cursor: 'pointer', marginBottom: 8 }}>Login</button>
          {error && <div style={{ color: '#c62828', marginTop: 10, textAlign: 'center' }}>{error}</div>}
    </form>
      </div>
    </div>
  );
}
