import React, { useState } from 'react';
import { login } from './services/api';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login(username, password);
      if (data.access_token) {
        localStorage.setItem('jwt', data.access_token);
        onLogin();
      } else {
        setError(data.msg || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.message || 'Network error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', justifyContent: 'center', background: '#e6f7fa' }}>
      <img src="/logo512.png" alt='Logo' style={{ width: 128, marginBottom: 32 }} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
        <input placeholder='Username' value={username} onChange={e => setUsername(e.target.value)} required />
        <input placeholder='Password' type='password' value={password} onChange={e => setPassword(e.target.value)} required />
        <button type='submit'>Login</button>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </form>
    </div>
  );
} 