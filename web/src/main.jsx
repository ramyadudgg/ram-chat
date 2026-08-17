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
  const [profile, setProfile] = React.useState(null);
  const [screen, setScreen] = React.useState('chats');
  const [chats, setChats] = React.useState([]);
  const [selectedChat, setSelectedChat] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [users, setUsers] = React.useState([]);
  const [text, setText] = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(d => setStatus(d.ok ? 'Server connected ✓' : 'Server error')).catch(() => setStatus('Server unavailable'));
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  React.useEffect(() => { if (user) enterChatApp(user); }, [user]);

  async function enterChatApp(currentUser) {
    const name = (currentUser.email || '').split('@')[0] || 'Ram User';
    const { data, error } = await supabase.rpc('ensure_my_profile', { p_email: currentUser.email || '', p_display_name: name, p_username: name });
    if (!error) setProfile(data);
    await loadChats();
  }

  async function loadChats() {
    setChatLoading(true);
    const { data, error } = await supabase.rpc('get_my_chats');
    if (!error) setChats(data || []); else setMessage(error.message);
    setChatLoading(false);
  }

  async function submit(e) {
    e.preventDefault(); setMessage(''); setLoading(true);
    try {
      if (!email || !password) throw new Error('Email aur password dono bharen.');
      if (password.length < 6) throw new Error('Password kam se kam 6 characters ka ho.');
      const result = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) setMessage('Account ban gaya. Email verification ke baad Login karein.'); else setMessage('Login successful ✓');
    } catch (err) { setMessage(err.message || 'Authentication failed.'); } finally { setLoading(false); }
  }

  async function logout() {
    await supabase.auth.signOut(); setUser(null); setProfile(null); setChats([]); setSelectedChat(null); setMessages([]);
  }

  async function findUsers(e) {
    const value = e.target.value; setSearch(value);
    if (value.trim().length < 2) { setUsers([]); return; }
    const { data, error } = await supabase.rpc('search_users', { p_query: value.trim() });
    if (!error) setUsers(data || []);
  }

  async function startChat(target) {
    const { data, error } = await supabase.rpc('create_direct_chat', { p_target_user: target.id });
    if (error) { setMessage(error.message); return; }
    const chat = { chat_id: data, other_user_id: target.id, other_username: target.username, other_display_name: target.display_name, other_avatar_url: target.avatar_url, last_body: '', last_created_at: null };
    setSelectedChat(chat); setScreen('chat'); setSearch(''); setUsers([]); await loadMessages(chat); await loadChats();
  }

  async function loadMessages(chat) {
    if (!chat?.chat_id) return;
    setSelectedChat(chat);
    const { data, error } = await supabase.from('messages').select('id,chat_id,sender_id,body,created_at').eq('chat_id', chat.chat_id).order('created_at', { ascending: true });
    if (!error) setMessages(data || []); else setMessage(error.message);
  }

  // Realtime subscription: keep the open chat synchronized without duplicates.
  React.useEffect(() => {
    if (!selectedChat?.chat_id) return;
    const channel = supabase.channel(`chat-${selectedChat.chat_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${selectedChat.chat_id}` }, payload => {
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        loadChats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChat?.chat_id]);

  async function sendMessage(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !selectedChat?.chat_id || !user) return;
    setText('');
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, chat_id: selectedChat.chat_id, sender_id: user.id, body, created_at: new Date().toISOString(), _optimistic: true };
    setMessages(prev => [...prev, optimistic]);
    const { data, error } = await supabase.from('messages').insert({ chat_id: selectedChat.chat_id, sender_id: user.id, body, message_type: 'text' }).select('id,chat_id,sender_id,body,created_at').single();
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(body); setMessage(error.message); return;
    }
    setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    await loadChats();
  }

  async function backToChats() {
    setSelectedChat(null); setMessages([]); setScreen('chats'); await loadChats();
  }

  if (user) return <div className="app">
    <header><div className="logo">R</div><div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div><button className="logout" onClick={logout}>Logout</button></header>
    {screen === 'chat' && selectedChat ? <main className="chat-main">
      <div className="chat-head"><button className="back" onClick={backToChats}>←</button><div><strong>{selectedChat.other_display_name || selectedChat.other_username}</strong><small>@{selectedChat.other_username}</small></div></div>
      <div className="messages">{messages.length === 0 ? <div className="empty">No messages yet. Say hello 👋</div> : messages.map(m => <div key={m.id} className={m.sender_id === user.id ? 'bubble mine' : 'bubble'}>{m.body}<small>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small></div>)}</div>
      <form className="composer" onSubmit={sendMessage}><input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…" autoFocus /><button type="submit">➤</button></form>
    </main> : <main><section className="card chat-card">
      <div className="welcome-row"><div><h2>Chats 💬</h2><p>{profile?.display_name || user.email}</p></div><button onClick={() => setScreen('new')}>＋ New Chat</button></div>
      {chatLoading ? <div className="empty">Loading chats…</div> : chats.length === 0 ? <div className="empty">No chats yet.<br/>Tap <b>＋ New Chat</b> to find a user.</div> : chats.map(c => <button className="chat-row" key={c.chat_id} onClick={() => { setScreen('chat'); loadMessages(c); }}><div className="avatar">{(c.other_display_name || '?')[0].toUpperCase()}</div><div className="chat-info"><strong>{c.other_display_name || c.other_username}</strong><span>{c.last_body || 'Start chatting'}</span></div><small>{c.last_created_at ? new Date(c.last_created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</small></button>)}
    </section></main>}
    {screen === 'new' && <div className="overlay"><section className="card new-card"><div className="welcome-row"><h2>New Chat</h2><button className="back" onClick={() => {setScreen('chats');setSearch('');setUsers([]);loadChats()}}>✕</button></div><input className="search" value={search} onChange={findUsers} placeholder="Search username or name…" autoFocus />{users.length === 0 && search.length >= 2 ? <div className="empty">No user found.</div> : users.map(u => <button className="user-row" key={u.id} onClick={() => startChat(u)}><div className="avatar">{(u.display_name || u.username || '?')[0].toUpperCase()}</div><div><strong>{u.display_name || u.username}</strong><span>@{u.username}</span></div></button>)}</section></div>}
  </div>;

  if (started) return <div className="app"><header><div className="logo">R</div><div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div></header><main><section className="card"><h2>{mode === 'login' ? 'Login to Ram Chat' : 'Create your account'}</h2><p>{mode === 'login' ? 'Enter your details to continue.' : 'Create your Ram Chat account.'}</p><form onSubmit={submit}><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Sign Up'}</button></form>{message && <div className="status">{message}</div>}<button className="secondary" type="button" onClick={() => {setMode(mode === 'login' ? 'signup' : 'login');setMessage('')}}>{mode === 'login' ? 'Create new account' : 'Already have an account? Login'}</button></section></main></div>;

  return <div className="app"><header><div className="logo">R</div><div><h1>Ram Chat</h1><p>Simple • Fast • Private</p></div></header><main><section className="card"><h2>Welcome to Ram Chat</h2><p>Your messaging app is ready.</p><div className="status">● {status}</div><button id="get-started" onClick={() => setStarted(true)}>Get Started</button></section></main></div>;
}

createRoot(document.getElementById('root')).render(<App />);
