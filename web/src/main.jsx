import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API='https://ram-chat.onrender.com';
function App(){
 const [status,setStatus]=React.useState('Checking server…');
 React.useEffect(()=>{fetch(`${API}/health`).then(r=>r.json()).then(d=>setStatus(d.ok?'Server connected ✓':'Server error')).catch(()=>setStatus('Server unavailable'));},[]);
 return <div className="app"><header><div className="logo">R</div><div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div></header><main><section className="card"><h2>Welcome to Ram Chat</h2><p>Your messaging app is ready.</p><div className="status">● {status}</div><button>Get Started</button></section></main></div>
}
createRoot(document.getElementById('root')).render(<App/>);
