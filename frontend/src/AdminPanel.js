import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4000';

export default function AdminPanel({ onClose }) {
  const [items, setItems] = useState([]);
  const [weights, setWeights] = useState({ promotion:1, hot:1, aging:1, new:1 });
  const [weightInputs, setWeightInputs] = useState({ promotion:'', hot:'', aging:'', new:'' });
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    fetch(`${API_BASE}/api/admin/items`)
      .then(r => r.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(error => {
        console.error('Failed to fetch items:', error);
        setItems([]);
      });
    fetch(`${API_BASE}/api/admin/weights`)
      .then(r => r.json())
      .then(rows => {
        const weightsData = Array.isArray(rows) ? Object.fromEntries(rows.map(r => [r.key,r.value])) : { promotion:1, hot:1, aging:1, new:1 };
        setWeights(weightsData);
        
        // Convert weights to percentages for display
        const total = Object.values(weightsData).reduce((sum, val) => sum + val, 0);
        const inputData = {};
        Object.keys(weightsData).forEach(key => {
          inputData[key] = Math.round((weightsData[key] / total) * 100).toString();
        });
        setWeightInputs(inputData);
      })
      .catch(error => {
        console.error('Failed to fetch weights:', error);
        setWeights({ promotion:1.5, hot:1.3, aging:1.0, new:1.2 });
        // Convert to percentages that total 100%
        const total = 1.5 + 1.3 + 1.0 + 1.2; // 5.0
        setWeightInputs({ 
          promotion: Math.round((1.5/total) * 100).toString(), 
          hot: Math.round((1.3/total) * 100).toString(), 
          aging: Math.round((1.0/total) * 100).toString(), 
          new: Math.round((1.2/total) * 100).toString() 
        });
      });
  }, []);

  const updateWeight = (keyChanged, value) => {
    value = Math.max(0, Math.min(100, value));
    const weightKeys = ['promotion', 'hot', 'aging', 'new'];
    const others = weightKeys.filter(k => k !== keyChanged);
    const remaining = 100 - value;
    const base = others.length ? Math.floor(remaining / others.length) : 0;
    
    const newWeightInputs = { [keyChanged]: value.toString() };
    const newWeights = { [keyChanged]: value / 100 };
    
    others.forEach((k, i) => {
      const percentage = i === others.length - 1 ? remaining - base * (others.length - 1) : base;
      newWeightInputs[k] = percentage.toString();
      newWeights[k] = percentage / 100;
    });
    
    setWeightInputs(newWeightInputs);
    setWeights(newWeights);
  };

  const saveItem = async idx => {
    const it = items[idx];
    await fetch(`${API_BASE}/api/admin/item/${it.code_num}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promotion:    it.promotion,
        hot:          it.hot,
        first_seen:   it.first_seen,
        last_purchase:it.last_purchase
      })
    });
  };

  const saveWeights = async () => {
    await fetch(`${API_BASE}/api/admin/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weights)
    });
  };

  return (
    <div className={`admin-panel ${animate ? 'open' : ''}`}>
      <div className="admin-header">
        <h3>⚙️ Admin Dashboard</h3>
        <button className="close-btn" onClick={onClose} aria-label="Close admin panel">
          ✕
        </button>
      </div>
      <div className="admin-body">
        <div className="admin-section">
          <h4>📊 Recommendation Weights</h4>
          <div style={{ 
            padding: '0.75rem',
            background: 'linear-gradient(135deg, var(--gray-50) 0%, var(--white) 100%)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1rem',
            border: '1px solid var(--gray-200)'
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', textAlign: 'center', marginBottom: '0.5rem' }}>
              Total: {Object.values(weightInputs).reduce((sum, val) => sum + (parseInt(val) || 0), 0)}%
            </div>
          </div>
          {['promotion','hot','aging','new'].map(k=>(
            <div key={k} className="weight-row">
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '100px' }}>
                <label>{k}:</label>
                <small style={{ 
                  color: 'var(--gray-500)', 
                  fontSize: '0.75rem', 
                  fontStyle: 'italic',
                  marginTop: '2px'
                }}>
                  {k === 'promotion' && 'Items on special'}
                  {k === 'hot' && 'Popular picks'}
                  {k === 'aging' && 'Time since restock'}
                  {k === 'new' && 'Recently added'}
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number" 
                  step="1"
                  min="0"
                  max={100}
                  placeholder="0"
                  value={weightInputs[k]}
                  onChange={e => {
                    const value = e.target.value;
                    const numValue = value === '' ? 0 : parseInt(value) || 0;
                    updateWeight(k, numValue);
                  }}
                />
                <span style={{ color: 'var(--gray-600)', fontWeight: '600' }}>%</span>
              </div>
            </div>
          ))}
          <button className="btn" onClick={saveWeights}>💾 Save Weights</button>
        </div>

        <div className="admin-section">
          <h4>📋 Item Settings</h4>
          <div className="table-container">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Code</th><th>Name</th>
                  <th>Promo</th><th>Hot</th>
                  <th>First Seen</th><th>Last Purchase</th>
                  <th>Save</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(items) ? items.map((it,i)=>(
                  <tr key={it.code_num}>
                    <td>{it.code_num}</td>
                    <td>{it.name}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!it.promotion}
                        onChange={e=>{
                          const v=e.target.checked?1:0;
                          setItems(a=>{ const c=[...a]; c[i].promotion=v; return c; });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!it.hot}
                        onChange={e=>{
                          const v=e.target.checked?1:0;
                          setItems(a=>{ const c=[...a]; c[i].hot=v; return c; });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={it.first_seen?.slice(0,10)||''}
                        onChange={e=>{
                          const v=e.target.value;
                          setItems(a=>{ const c=[...a]; c[i].first_seen=v; return c; });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={it.last_purchase?.slice(0,10)||''}
                        onChange={e=>{
                          const v=e.target.value;
                          setItems(a=>{ const c=[...a]; c[i].last_purchase=v; return c; });
                        }}
                      />
                    </td>
                    <td>
                      <button className="btn small" onClick={()=>saveItem(i)}>💾</button>
                    </td>
                  </tr>
                )) : <tr><td colSpan="7">No items available</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
