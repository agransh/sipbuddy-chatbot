import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import ChatPanel from './ChatPanel';
import AdminPanel from './AdminPanel';
import './App.css';

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <BrowserRouter>
      {/* Mock website header */}
      <div className="mock-website">
        <h1>My Shop</h1>
        <p>Browse our catalog, then click SipBuddy to plan your drinks.</p>
      </div>

      {/* Admin trigger (left side) */}
      <button className="admin-trigger" onClick={() => setAdminOpen(true)}>
        ⚙️ Admin
      </button>
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}

      {/* Chat trigger (right side) */}
      <button className="chat-trigger" onClick={() => setChatOpen(true)}>
        💬 Hi there, looking for the perfect drinks?
      </button>
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </BrowserRouter>
  );
}
