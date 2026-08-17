import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { supabase } from './supabase';

const API = 'https://ram-chat.onrender.com';

function App() {
  const [status, setStatus] = React.useState('Checking server…');
  const [started, setStarted] = React.useState(false);
  const [mode, setMode] = React.useState('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.json())
      .then(d => setStatus(d.ok ? 'Server connected ✓' : 'Server error'))
      .catch(() => setStatus('Server unavailable'));
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      if (!email || !password) throw new Error('Email aur password dono bharen.');
      if (password.length < 6) throw new Error('Password kam se kam 6 characters ka ho.');
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        setMessage('Account ban gaya. Email verification ke baad Login karein.');
      } else {
        setMessage('Login successful ✓');
      }
    } catch (err) {
      setMessage(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (user) {
    return <div className="app"><header><div className="logo">R</div><div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div></header><main><section className="card">
      <h2>Welcome to Ram Chat 🎉</h2><p>{user.email}</p><div className="status">● Account connected ✓</div>
      <p>Chat system is ready for the next step.</p><button type="button" onClick={logout}>Logout</button>
    </section></main></div>;
  }

  if (started) {
    return <div className="app"><header><div className="logo">R</div><div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div></header><main><section className="card">
      <h2>{mode === 'login' ? 'Login to Ram Chat' : 'Create your account'}</h2>
      <p>{mode === 'login' ? 'Enter your details to continue.' : 'Create your Ram Chat account.'}</p>
      <form onSubmit={submit}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        <button type="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Sign Up'}</button>
      </form>
      {message && <div className="status">{message}</div>}
      <button className="secondary" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Create new account' : 'Already have an account? Login'}</button>
    </section></main></div>;
  }

  return <div className="app"><header><div className="logo">R</div><div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div></header><main><section className="card">
    <h2>Welcome to Ram Chat</h2><p>Your messaging app is ready.</p><div className="status">● {status}</div>
    <button id="get-started" type="button" onClick={() => setStarted(true)}>Get Started</button>
  </section></main></div>;
}

createRoot(document.getElementById('root')).render(<App />);
