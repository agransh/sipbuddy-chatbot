import React, { useState, useEffect } from 'react';
import { MyselfFlow, PartyFlow } from './Flows';
import './App.css';

export default function ChatPanel({ onClose }) {
  const [flow, setFlow] = useState(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 20);
    return () => clearTimeout(t);
  }, []);

  const resetFlow = () => {
    setFlow(null);
  };

  return (
    <div className={`chat-panel ${animate ? 'open' : ''}`}>
      <div className="chat-header">
        <h3>🍷 SipBuddy</h3>
        <button className="close-btn" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </div>
      <div className="chat-body">
        {!flow ? (
          <div className="flow">
            <div className="text-center mb-8">
              <h2 className="font-bold" style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--gray-800)' }}>
                🎉 Welcome to SipBuddy!
              </h2>
              <p style={{ color: 'var(--gray-600)', fontSize: '1rem', lineHeight: '1.6' }}>
                Let me help you find the perfect drinks for any occasion. Choose your experience below:
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                className="btn flow-btn" 
                onClick={() => setFlow('myself')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.75rem',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '2rem' }}>🍷</span>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>Just casual sipping</div>
                  <div style={{ fontSize: '0.9rem', opacity: '0.8' }}>Personal recommendations for relaxing</div>
                </div>
              </button>
              
              <button 
                className="btn flow-btn" 
                onClick={() => setFlow('party')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.75rem',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '2rem' }}>🎉</span>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>Throwing a party</div>
                  <div style={{ fontSize: '0.9rem', opacity: '0.8' }}>Calculate quantities & get recommendations</div>
                </div>
              </button>
            </div>
            
            <div style={{ 
              marginTop: '2rem', 
              padding: '1.5rem', 
              background: 'linear-gradient(135deg, var(--gray-50) 0%, var(--white) 100%)', 
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--gray-200)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', textAlign: 'center' }}>
                ✨ <strong>AI-powered recommendations</strong> based on your preferences, budget, and occasion
              </div>
            </div>
          </div>
        ) : (
          <div className="flow">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-start',
              marginBottom: '0.5rem',
              marginTop: '-0.5rem'
            }}>
              <button 
                className="btn small" 
                onClick={resetFlow}
                style={{ 
                  background: 'var(--gray-500)',
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem'
                }}
              >
                ← Back
              </button>
            </div>
            {flow === 'myself' ? <MyselfFlow /> : <PartyFlow />}
          </div>
        )}
      </div>
    </div>
  );
}
