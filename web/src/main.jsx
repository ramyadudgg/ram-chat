import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = 'https://ram-chat.onrender.com';

function App() {
  const [status, setStatus] = React.useState('Checking server…');
  const [started, setStarted] = React.useState(false);
  const [mode, setMode] = React.useState('login');

  React.useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.json())
      .then(d => setStatus(d.ok ? 'Server connected ✓' : 'Server error'))
      .catch(() => setStatus('Server unavailable'));
  }, []);

  if (started) {
    return (
      <div className="app">
        <header>
          <div className="logo">R</div>
          <div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div>
        </header>
        <main>
          <section className="card">
            <h2>{mode === 'login' ? 'Login to Ram Chat' : 'Create your account'}</h2>
            <p>{mode === 'login' ? 'Enter your details to continue.' : 'Create your Ram Chat account.'}</p>
            <input type="email" placeholder="Email" />
            <input type="password" placeholder="Password" />
            <button type="button" onClick={() => alert('Authentication will be connected next.') }>
              {mode === 'login' ? 'Login' : 'Sign Up'}
            </button>
            <button className="secondary" type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Create new account' : 'Already have an account? Login'}
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header><div className="logo">R</div><div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div></header>
      <main><section className="card">
        <h2>Welcome to Ram Chat</h2>
        <p>Your messaging app is ready.</p>
        <div className="status">● {status}</div>
        <button type="button" onClick={() => setStarted(true)}>Get Started</button>
      </section></main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
