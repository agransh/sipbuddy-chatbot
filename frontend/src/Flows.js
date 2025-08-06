import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4000';
const CATEGORIES = ['Beer','Wine','RTD'];

export function SingleSlider({ min, max, value, onChange }) {
  return (
    <div className="slider-container">
      <div className="slider-value">${value}</div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(+e.target.value)}
      />
    </div>
  );
}

export function MyselfFlow() {
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState([]);
  const [budget, setBudget] = useState(500);
  const [customBudget, setCustomBudget] = useState('');
  const [recs, setRecs] = useState({});
  const [categoryTags, setCategoryTags] = useState({});
  const [selectedTags, setSelectedTags] = useState({});
  const [activeTab, setActiveTab] = useState('');

  // Fallback tags for testing
  const fallbackTags = {
    'Beer': ['Lager', 'IPA', 'Stout', 'Wheat Beer', 'Light Beer', 'Pilsner'],
    'Wine': ['Chardonnay', 'Pinot Noir', 'Cabernet Sauvignon', 'Pinot Grigio', 'Merlot', 'Sauvignon Blanc', 'Prosecco'],
    'RTD': ['Hard Seltzer', 'Vodka Mix', 'Margarita', 'Mojito', 'Flavored Malt']
  };

  const toggleCat = c =>
    setCats(prev => {
      const next = prev.includes(c) ? prev.filter(x=>x!==c) : [...prev,c];
      
      // Fetch tags for new categories
      if (next.length > 0) {
        fetchCategoryTags(next);
      }
      
      return next;
    });

  // Fetch tags for categories
  const fetchCategoryTags = async (categories) => {
    console.log('🏷️ Fetching tags for categories:', categories);
    
    // First set fallback tags immediately
    const fallbackCategoryTags = {};
    categories.forEach(category => {
      fallbackCategoryTags[category] = fallbackTags[category] || [];
    });
    setCategoryTags(fallbackCategoryTags);
    console.log('🎯 Set fallback tags:', fallbackCategoryTags);

    // Then try to fetch real tags from API
    const tagPromises = categories.map(async (category) => {
      try {
        const response = await fetch(`${API_BASE}/api/category-tags/${category}`);
        const data = await response.json();
        console.log(`📦 API Tags for ${category}:`, data.tags);
        return { category, tags: data.tags && data.tags.length > 0 ? data.tags : fallbackTags[category] || [] };
      } catch (error) {
        console.error(`Failed to fetch tags for ${category}:`, error);
        return { category, tags: fallbackTags[category] || [] };
      }
    });

    const results = await Promise.all(tagPromises);
    const newCategoryTags = {};
    results.forEach(({ category, tags }) => {
      newCategoryTags[category] = tags;
    });
    console.log('🎯 Setting final categoryTags:', newCategoryTags);
    setCategoryTags(newCategoryTags);
  };

  const toggleTag = (category, tag) => {
    console.log(`🏷️ Toggling tag "${tag}" for category "${category}"`);
    setSelectedTags(prev => {
      const currentTags = prev[category] || [];
      const newTags = currentTags.includes(tag) 
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag];
      
      const newState = {
        ...prev,
        [category]: newTags
      };
      
      console.log(`🎯 Updated selectedTags for ${category}:`, newTags);
      return newState;
    });
  };

  const showRecs = async () => {
    const maxSpend = customBudget?+customBudget:budget;
    const out = {};
    await Promise.all(cats.map(async c => {
      try {
        // Build query string with selected tags
        const tags = selectedTags[c] || [];
        const tagsParam = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
        const url = `${API_BASE}/api/recommendations?category=${c}&maxPrice=${maxSpend}&limit=5${tagsParam}`;
        
        console.log(`🔍 Fetching recommendations for ${c} with tags [${tags.join(', ')}] from: ${url}`);
        const res = await fetch(url);
        console.log(`📡 Response status for ${c}:`, res.status);
        const data = await res.json();
        console.log(`📦 Response data for ${c}:`, data);
        out[c] = Array.isArray(data) ? data : [];
      } catch (error) {
        console.error(`Failed to fetch recommendations for ${c}:`, error);
        out[c] = [];
      }
    }));
    setRecs(out);
    // Set the first category as the active tab
    if (cats.length > 0) {
      setActiveTab(cats[0]);
    }
    setStep(4);
  };

  const swapOne = async (cat, idx) => {
    try {
      const maxSpend = customBudget?+customBudget:budget;
      // Build query string with selected tags
      const tags = selectedTags[cat] || [];
      const tagsParam = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
      const url = `${API_BASE}/api/recommendations?category=${cat}&maxPrice=${maxSpend}&limit=1${tagsParam}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const [newItem] = data;
        setRecs(prev=>({
          ...prev,
          [cat]: Array.isArray(prev[cat]) ? prev[cat].map((x,i)=>i===idx?newItem:x) : [newItem]
        }));
      }
    } catch (error) {
      console.error(`Failed to swap recommendation for ${cat}:`, error);
    }
  };

  const swapAll = showRecs;

  return (
    <div className="flow">
      {/* Step Indicator */}
      <div className="step-indicator">
        <div 
          className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}
          onClick={() => setStep(1)}
        >
          <div className="step-number">{step > 1 ? '' : '1'}</div>
          <span className="step-text">Categories</span>
        </div>
        <div 
          className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}
          onClick={() => cats.length && setStep(2)}
          style={{ cursor: cats.length ? 'pointer' : 'not-allowed', opacity: cats.length ? 1 : 0.6 }}
        >
          <div className="step-number">{step > 2 ? '' : '2'}</div>
          <span className="step-text">Budget</span>
        </div>
        <div 
          className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}
          onClick={() => cats.length && setStep(3)}
          style={{ cursor: cats.length ? 'pointer' : 'not-allowed', opacity: cats.length ? 1 : 0.6 }}
        >
          <div className="step-number">{step > 3 ? '' : '3'}</div>
          <span className="step-text">Preferences</span>
        </div>
        <div 
          className={`step ${step >= 4 ? 'active' : ''}`}
          onClick={() => recs && Object.keys(recs).length && setStep(4)}
          style={{ cursor: recs && Object.keys(recs).length ? 'pointer' : 'not-allowed', opacity: recs && Object.keys(recs).length ? 1 : 0.6 }}
        >
          <div className="step-number">4</div>
          <span className="step-text">Results</span>
        </div>
      </div>

      {step===1 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
              🍷 What would you like to drink?
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
              Select the categories that interest you
            </p>
          </div>
          
          <div className="bubble-group">
            {CATEGORIES.map(c=>(
              <button
                key={c}
                className={cats.includes(c)?'bubble selected':'bubble'}
                onClick={()=>toggleCat(c)}
                style={{ position: 'relative' }}
              >
                {c === 'Beer' && '🍺'} {c === 'Wine' && '🍷'} {c === 'RTD' && '🥤'} {c}
                {cats.includes(c) && (
                  <span style={{ 
                    position: 'absolute', 
                    top: '-8px', 
                    right: '-8px', 
                    background: 'var(--success)', 
                    color: 'white', 
                    borderRadius: '50%', 
                    width: '20px', 
                    height: '20px', 
                    fontSize: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
          
          <button 
            className="btn" 
            disabled={!cats.length} 
            onClick={()=>setStep(2)}
            style={{ width: '100%', fontSize: '1.1rem' }}
          >
            Continue to Budget →
          </button>
        </>
      )}

      {step===2 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
              💰 What's your budget?
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
              Set your spending limit for recommendations
            </p>
          </div>

          {/* Budget Display */}
          <div className="budget-display">
            <span className="currency">$</span>
            <span className="amount">{customBudget || budget}</span>
            <span className="label">Budget</span>
          </div>

          <SingleSlider min={0} max={1000} value={budget} onChange={setBudget} />
          
          <div className="floating-label">
            <input
              type="number"
              placeholder=" "
              value={customBudget}
              onChange={e=>setCustomBudget(e.target.value)}
              min="0"
              step="50"
            />
            <label>💎 Custom Budget (Over $1,000)</label>
          </div>
          
          <button 
            className="btn" 
            onClick={() => setStep(3)}
            style={{ 
              width: '100%', 
              fontSize: '1.1rem',
              marginTop: '1rem'
            }}
          >
            Continue to Preferences →
          </button>
        </>
      )}

      {step===3 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
              🎯 Choose Your Preferences
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
              Select specific types you prefer (optional)
            </p>
          </div>

          {cats.map(c=>(
            <div key={c} style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ 
                color: c === 'Beer' ? '#D97706' : c === 'Wine' ? '#DC2626' : '#2563EB',
                marginBottom: '0.75rem',
                fontSize: '1.1rem',
                fontWeight: '600'
              }}>
                {c === 'Beer' && '🍺'} {c === 'Wine' && '🍷'} {c === 'RTD' && '🥤'} {c} Types:
              </h4>
              
              {/* Category Tags */}
              {categoryTags[c] && categoryTags[c].length > 0 ? (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.75rem' 
                }}>
                  {categoryTags[c].map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(c, tag)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        borderRadius: '8px',
                        border: '2px solid',
                        borderColor: selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '#D97706' : c === 'Wine' ? '#DC2626' : '#2563EB')
                          : (c === 'Beer' ? '#F59E0B' : c === 'Wine' ? '#EF4444' : '#3B82F6'),
                        backgroundColor: selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '#FEF3C7' : c === 'Wine' ? '#FEE2E2' : '#DBEAFE')
                          : (c === 'Beer' ? '#FFFBEB' : c === 'Wine' ? '#FEF2F2' : '#EFF6FF'),
                        color: selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '#92400E' : c === 'Wine' ? '#991B1B' : '#1E40AF')
                          : (c === 'Beer' ? '#D97706' : c === 'Wine' ? '#DC2626' : '#2563EB'),
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        boxShadow: selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '0 4px 12px rgba(217, 119, 6, 0.3)' : 
                             c === 'Wine' ? '0 4px 12px rgba(220, 38, 38, 0.3)' : 
                             '0 4px 12px rgba(37, 99, 235, 0.3)')
                          : (c === 'Beer' ? '0 2px 8px rgba(245, 158, 11, 0.2)' : 
                             c === 'Wine' ? '0 2px 8px rgba(239, 68, 68, 0.2)' : 
                             '0 2px 8px rgba(59, 130, 246, 0.2)'),
                        transform: selectedTags[c]?.includes(tag) ? 'translateY(-1px)' : 'translateY(0)',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: '1rem',
                  textAlign: 'center',
                  color: 'var(--gray-500)',
                  fontStyle: 'italic'
                }}>
                  Loading {c.toLowerCase()} types...
                </div>
              )}
            </div>
          ))}
          
          <button 
            className="btn" 
            onClick={showRecs}
            style={{ 
              width: '100%', 
              fontSize: '1.1rem',
              background: 'var(--success)',
              marginTop: '1.5rem'
            }}
          >
            🎯 Get My Recommendations
          </button>
        </>
      )}

      {step===4 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
              ✨ Your Perfect Recommendations
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
              Curated just for you based on your preferences
            </p>
          </div>
          
          {/* Back and New Recommendations Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <button 
              className="btn" 
              onClick={() => setStep(3)}
              style={{ 
                flex: '1',
                minWidth: '140px',
                background: 'var(--gray-600)',
                fontSize: '0.95rem'
              }}
            >
              ← Back to Preferences
            </button>
            <button 
              className="btn" 
              onClick={swapAll}
              style={{ 
                flex: '1',
                minWidth: '140px',
                background: 'var(--accent)',
                fontSize: '0.95rem'
              }}
            >
              🔄 New Recommendations
            </button>
          </div>
          
          {/* Category Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginBottom: '1.5rem',
            borderBottom: '2px solid var(--gray-200)',
            paddingBottom: '0.5rem'
          }}>
            {Object.keys(recs).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                  background: activeTab === cat ? 'var(--primary)' : 'var(--gray-100)',
                  color: activeTab === cat ? 'white' : 'var(--gray-700)',
                  fontWeight: activeTab === cat ? '600' : '500',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                  transform: activeTab === cat ? 'translateY(-2px)' : 'none',
                  boxShadow: activeTab === cat ? 'var(--shadow-md)' : 'none'
                }}
              >
                {cat === 'Beer' && '🍺'} {cat === 'Wine' && '🍷'} {cat === 'RTD' && '🥤'} {cat}
              </button>
            ))}
          </div>

          {/* Active Category Content */}
          <div className="recommend-scroll">
            {activeTab && recs[activeTab] && (
              <div className="recommend-cat">
                <h4 style={{ marginBottom: '1rem' }}>
                  {activeTab === 'Beer' && '🍺'} {activeTab === 'Wine' && '🍷'} {activeTab === 'RTD' && '🥤'} {activeTab} Recommendations
                </h4>
                <div className="cards">
                  {Array.isArray(recs[activeTab]) ? recs[activeTab].map((item,idx)=>(
                    <div key={item.id} className="card">
                      <img src={item.img} alt={item.name} />
                      {item.storeUrl ? (
                        <a 
                          href={item.storeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--primary)',
                            textDecoration: 'underline',
                            fontWeight: '600',
                            fontSize: '1rem'
                          }}
                        >
                          {item.name}
                        </a>
                      ) : (
                        <p>{item.name}</p>
                      )}
                      <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', margin: '0.25rem 0' }}>
                        Size: {item.size || 'Standard'}
                      </p>
                      <p>${item.price}</p>
                      <button className="btn small" onClick={()=>swapOne(activeTab,idx)}>
                        🔄 Swap
                      </button>
                    </div>
                  )) : (
                    <div style={{ 
                      padding: '2rem', 
                      textAlign: 'center', 
                      color: 'var(--gray-500)',
                      background: 'var(--gray-50)',
                      borderRadius: 'var(--radius-lg)',
                      border: '2px dashed var(--gray-200)'
                    }}>
                      No recommendations available
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PartyFlow() {
  const [step, setStep] = useState(1);
  const [guests, setGuests] = useState('');
  const [hours, setHours] = useState('');
  const [cats, setCats] = useState([]);
  const [splits, setSplits] = useState({});
  const [results, setResults] = useState(null);
  const [recs, setRecs] = useState({});
  const [categoryTags, setCategoryTags] = useState({});
  const [selectedTags, setSelectedTags] = useState({});
  const [activeTab, setActiveTab] = useState('');

  // Fallback tags for testing
  const fallbackTags = {
    'Beer': ['Lager', 'IPA', 'Stout', 'Wheat Beer', 'Light Beer', 'Pilsner'],
    'Wine': ['Chardonnay', 'Pinot Noir', 'Cabernet Sauvignon', 'Pinot Grigio', 'Merlot', 'Sauvignon Blanc', 'Prosecco'],
    'RTD': ['Hard Seltzer', 'Vodka Mix', 'Margarita', 'Mojito', 'Flavored Malt']
  };

  // Fetch tags for categories
  const fetchCategoryTags = async (categories) => {
    console.log('🏷️ Fetching tags for categories:', categories);
    
    // First set fallback tags immediately
    const fallbackCategoryTags = {};
    categories.forEach(category => {
      fallbackCategoryTags[category] = fallbackTags[category] || [];
    });
    setCategoryTags(fallbackCategoryTags);
    console.log('🎯 Set fallback tags:', fallbackCategoryTags);

    // Then try to fetch real tags from API
    const tagPromises = categories.map(async (category) => {
      try {
        const response = await fetch(`${API_BASE}/api/category-tags/${category}`);
        const data = await response.json();
        console.log(`📦 API Tags for ${category}:`, data.tags);
        return { category, tags: data.tags && data.tags.length > 0 ? data.tags : fallbackTags[category] || [] };
      } catch (error) {
        console.error(`Failed to fetch tags for ${category}:`, error);
        return { category, tags: fallbackTags[category] || [] };
      }
    });

    const results = await Promise.all(tagPromises);
    const newCategoryTags = {};
    results.forEach(({ category, tags }) => {
      newCategoryTags[category] = tags;
    });
    console.log('🎯 Setting final categoryTags:', newCategoryTags);
    setCategoryTags(newCategoryTags);
  };

  const toggleCat = c =>
    setCats(prev=>{
      const next = prev.includes(c)?prev.filter(x=>x!==c):[...prev,c];
      const base = next.length?Math.floor(100/next.length):100;
      const fresh = {};
      next.forEach((cat,i)=>{
        fresh[cat] = i===next.length-1?100-base*(next.length-1):base;
      });
      setSplits(fresh);
      
      // Fetch tags for new categories
      if (next.length > 0) {
        fetchCategoryTags(next);
      }
      
      return next;
    });

  const toggleTag = (category, tag) => {
    console.log(`🏷️ Toggling tag "${tag}" for category "${category}"`);
    setSelectedTags(prev => {
      const currentTags = prev[category] || [];
      const newTags = currentTags.includes(tag) 
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag];
      
      const newState = {
        ...prev,
        [category]: newTags
      };
      
      console.log(`🎯 Updated selectedTags for ${category}:`, newTags);
      return newState;
    });
  };

  const updateSplit = (catChanged,value) => {
    value = Math.max(0,Math.min(100,value));
    const others = cats.filter(c=>c!==catChanged);
    const rem = 100-value;
    const base = others.length?Math.floor(rem/others.length):0;
    const newSplits = {[catChanged]:value};
    others.forEach((c,i)=>{
      newSplits[c] = i===others.length-1?rem-base*(others.length-1):base;
    });
    setSplits(newSplits);
  };

  const compute = async()=>{
    const g = parseInt(guests,10)||0;
    const h = parseInt(hours,10)||0;
    const total = g*h*2; // Total drinks needed (2 drinks per person per hour)
    const out={};
    cats.forEach(c=>{
      const pct = (splits[c]||0)/100;
      const categoryDrinks = total * pct;
      
      if(c==='Beer') {
        // Assuming 12-pack of 12oz cans/bottles (most common for parties)
        out.Beer = {
          quantity: Math.ceil(categoryDrinks/12),
          unit: '12-packs',
          size: '12 oz cans/bottles',
          totalServings: Math.ceil(categoryDrinks)
        };
      }
      if(c==='Wine') {
        // Assuming 750ml bottles (5 servings per bottle)
        out.Wine = {
          quantity: Math.ceil(categoryDrinks/5),
          unit: 'bottles',
          size: '750ml bottles',
          totalServings: Math.ceil(categoryDrinks)
        };
      }
      if(c==='RTD') {
        // Assuming 12-pack of 12oz cans (RTDs are typically sold in 12-packs)
        out.RTD = {
          quantity: Math.ceil(categoryDrinks/12),
          unit: '12-packs',
          size: '12 oz cans',
          totalServings: Math.ceil(categoryDrinks)
        };
      }
    });
    const recOut={};
    await Promise.all(cats.map(async c=>{
      try {
        // Build query string with selected tags
        const tags = selectedTags[c] || [];
        const tagsParam = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
        const url = `${API_BASE}/api/recommendations?category=${c}&maxPrice=10000&limit=3${tagsParam}`;
        
        console.log(`🔍 Fetching recommendations for ${c} with tags [${tags.join(', ')}] from: ${url}`);
        const res = await fetch(url);
        console.log(`📡 Response status for ${c}:`, res.status);
        const data = await res.json();
        console.log(`📦 Response data for ${c}:`, data);
        recOut[c] = Array.isArray(data) ? data : [];
      } catch (error) {
        console.error(`Failed to fetch recommendations for ${c}:`, error);
        recOut[c] = [];
      }
    }));
    setResults(out);
    setRecs(recOut);
    // Set the first category as the active tab
    if (cats.length > 0) {
      setActiveTab(cats[0]);
    }
    setStep(4);
  };

  const swapOne = async(cat,idx)=>{
    try {
      // Build query string with selected tags
      const tags = selectedTags[cat] || [];
      const tagsParam = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
      const url = `${API_BASE}/api/recommendations?category=${cat}&maxPrice=10000&limit=1${tagsParam}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const [newItem] = data;
        setRecs(prev=>({
          ...prev,
          [cat]: Array.isArray(prev[cat]) ? prev[cat].map((x,i)=>i===idx?newItem:x) : [newItem]
        }));
      }
    } catch (error) {
      console.error(`Failed to swap recommendation for ${cat}:`, error);
    }
  };

  const swapAll = compute;

  // Auto-fetch tags when reaching step 3 with categories selected
  useEffect(() => {
    if (step === 3 && cats.length > 0 && Object.keys(categoryTags).length === 0) {
      console.log('🎯 Auto-fetching tags for step 3 with categories:', cats);
      fetchCategoryTags(cats);
    }
  }, [step, cats]);

  return (
    <div className="flow">
      {/* Step Indicator */}
      <div className="step-indicator">
        <div 
          className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}
          onClick={() => setStep(1)}
        >
          <div className="step-number">{step > 1 ? '' : '1'}</div>
          <span className="step-text">Party Size</span>
        </div>
        <div 
          className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}
          onClick={() => guests && hours && setStep(2)}
          style={{ cursor: guests && hours ? 'pointer' : 'not-allowed', opacity: guests && hours ? 1 : 0.6 }}
        >
          <div className="step-number">{step > 2 ? '' : '2'}</div>
          <span className="step-text">Drinks</span>
        </div>
        <div 
          className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}
          onClick={() => guests && hours && cats.length && setStep(3)}
          style={{ cursor: guests && hours && cats.length ? 'pointer' : 'not-allowed', opacity: guests && hours && cats.length ? 1 : 0.6 }}
        >
          <div className="step-number">{step > 3 ? '' : '3'}</div>
          <span className="step-text">Split</span>
        </div>
        <div 
          className={`step ${step >= 4 ? 'active' : ''}`}
          onClick={() => results && setStep(4)}
          style={{ cursor: results ? 'pointer' : 'not-allowed', opacity: results ? 1 : 0.6 }}
        >
          <div className="step-number">4</div>
          <span className="step-text">Results</span>
        </div>
      </div>

      {step===1&&(
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
              🎉 Party Planning
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
              Tell us about your party so we can calculate the perfect quantities
            </p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <div className="floating-label">
                <input 
                  type="number" 
                  placeholder=" " 
                  value={guests} 
                  onChange={e=>setGuests(e.target.value)}
                  min="1"
                  max="1000"
                />
                <label>👥 Number of Guests</label>
              </div>
            </div>
            
            <div className="form-group">
              <div className="floating-label">
                <input 
                  type="number" 
                  placeholder=" " 
                  value={hours} 
                  onChange={e=>setHours(e.target.value)}
                  min="1"
                  max="24"
                />
                <label>⏰ Duration (Hours)</label>
              </div>
            </div>
          </div>



          <button 
            className="btn" 
            disabled={!(+guests>=1&&+hours>=1)} 
            onClick={()=>setStep(2)}
            style={{ width: '100%', fontSize: '1.1rem' }}
          >
            Continue to Drink Selection →
          </button>
        </>
      )}
      
      {step===2&&(
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
              🍷 Choose Your Drinks
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
              Select the types of drinks you want at your party
            </p>
          </div>
          
          <div className="bubble-group">
            {CATEGORIES.map(c=>(
              <button 
                key={c} 
                className={cats.includes(c)?'bubble selected':'bubble'} 
                onClick={()=>toggleCat(c)}
                style={{ position: 'relative' }}
              >
                {c === 'Beer' && '🍺'} {c === 'Wine' && '🍷'} {c === 'RTD' && '🥤'} {c}
                {cats.includes(c) && (
                  <span style={{ 
                    position: 'absolute', 
                    top: '-8px', 
                    right: '-8px', 
                    background: 'var(--success)', 
                    color: 'white', 
                    borderRadius: '50%', 
                    width: '20px', 
                    height: '20px', 
                    fontSize: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
          
          <button 
            className="btn" 
            disabled={!cats.length} 
            onClick={()=>setStep(3)}
            style={{ width: '100%', fontSize: '1.1rem' }}
          >
            Continue to Split Percentages →
          </button>
        </>
      )}
      
      {step===3&&(
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
              📊 Split Percentages
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
              How should we divide the drinks? (Must total 100%)
            </p>
          </div>

          <div style={{ 
            padding: '1rem',
            background: 'linear-gradient(135deg, var(--gray-50) 0%, var(--white) 100%)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1.5rem',
            border: '1px solid var(--gray-200)'
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', textAlign: 'center', marginBottom: '0.5rem' }}>
              Total: {Object.values(splits).reduce((sum, val) => sum + (val || 0), 0)}%
            </div>
            <div style={{ 
              height: '8px', 
              background: 'var(--gray-200)', 
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              display: 'flex'
            }}>
              {Object.entries(splits).map(([cat, percentage]) => (
                <div 
                  key={cat}
                  style={{ 
                    width: `${percentage}%`, 
                    background: cat === 'Beer' ? '#FCD34D' : cat === 'Wine' ? '#F87171' : '#60A5FA',
                    transition: 'var(--transition)'
                  }}
                />
              ))}
            </div>
          </div>

          {cats.map(c=>(
            <div key={c} style={{ marginBottom: '1.5rem' }}>
              <div className="split-row">
                <label style={{ color: c === 'Beer' ? '#D97706' : c === 'Wine' ? '#DC2626' : '#2563EB' }}>
                  {c}:
                </label>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={splits[c]||''} 
                  onChange={e=>updateSplit(c,+e.target.value)}
                  style={{ borderColor: c === 'Beer' ? '#FCD34D' : c === 'Wine' ? '#F87171' : '#60A5FA' }}
                />
                <span>%</span>
              </div>
              
              {/* Category Tags */}
              {categoryTags[c] && categoryTags[c].length > 0 && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  marginLeft: '0.5rem',
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.75rem' 
                }}>
                  {categoryTags[c].map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(c, tag)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        borderRadius: '8px',
                        border: '2px solid',
                        borderColor: selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '#D97706' : c === 'Wine' ? '#DC2626' : '#2563EB')
                          : (c === 'Beer' ? '#F59E0B' : c === 'Wine' ? '#EF4444' : '#3B82F6'),
                        backgroundColor: selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '#FEF3C7' : c === 'Wine' ? '#FEE2E2' : '#DBEAFE')
                          : (c === 'Beer' ? '#FFFBEB' : c === 'Wine' ? '#FEF2F2' : '#EFF6FF'),
                        color: selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '#92400E' : c === 'Wine' ? '#991B1B' : '#1E40AF')
                          : (c === 'Beer' ? '#D97706' : c === 'Wine' ? '#DC2626' : '#2563EB'),
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        boxShadow: selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '0 4px 12px rgba(217, 119, 6, 0.3)' : 
                             c === 'Wine' ? '0 4px 12px rgba(220, 38, 38, 0.3)' : 
                             '0 4px 12px rgba(37, 99, 235, 0.3)')
                          : (c === 'Beer' ? '0 2px 8px rgba(245, 158, 11, 0.2)' : 
                             c === 'Wine' ? '0 2px 8px rgba(239, 68, 68, 0.2)' : 
                             '0 2px 8px rgba(59, 130, 246, 0.2)'),
                        transform: selectedTags[c]?.includes(tag) ? 'translateY(-1px)' : 'translateY(0)',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '0 6px 16px rgba(217, 119, 6, 0.4)' : 
                             c === 'Wine' ? '0 6px 16px rgba(220, 38, 38, 0.4)' : 
                             '0 6px 16px rgba(37, 99, 235, 0.4)')
                          : (c === 'Beer' ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 
                             c === 'Wine' ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 
                             '0 4px 12px rgba(59, 130, 246, 0.3)');
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = selectedTags[c]?.includes(tag) ? 'translateY(-1px)' : 'translateY(0)';
                        e.target.style.boxShadow = selectedTags[c]?.includes(tag) 
                          ? (c === 'Beer' ? '0 4px 12px rgba(217, 119, 6, 0.3)' : 
                             c === 'Wine' ? '0 4px 12px rgba(220, 38, 38, 0.3)' : 
                             '0 4px 12px rgba(37, 99, 235, 0.3)')
                          : (c === 'Beer' ? '0 2px 8px rgba(245, 158, 11, 0.2)' : 
                             c === 'Wine' ? '0 2px 8px rgba(239, 68, 68, 0.2)' : 
                             '0 2px 8px rgba(59, 130, 246, 0.2)');
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          <button 
            className="btn" 
            onClick={compute}
            style={{ 
              width: '100%', 
              fontSize: '1.1rem',
              background: 'var(--success)',
              marginTop: '1rem'
            }}
          >
            🎯 Calculate & Get Recommendations
          </button>
        </>
      )}
      
      {step===4&&results&&(
        <>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '0.5rem' }}>
              🎯 Your Party Recommendations
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
              Based on {guests} guests for {hours} hours
            </p>
          </div>

          {/* Back and New Recommendations Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <button 
              className="btn" 
              onClick={() => setStep(3)}
              style={{ 
                flex: '1',
                minWidth: '140px',
                background: 'var(--gray-600)',
                fontSize: '0.95rem'
              }}
            >
              ← Back to Settings
            </button>
            <button 
              className="btn" 
              onClick={swapAll}
              style={{ 
                flex: '1',
                minWidth: '140px',
                background: 'var(--accent)',
                fontSize: '0.95rem'
              }}
            >
              🔄 New Recommendations
            </button>
          </div>

          <div className="results">
            <h4>📊 Quantities Needed</h4>
            <div style={{ 
              display: 'grid', 
              gap: '1rem', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              marginBottom: '1rem'
            }}>
              {Object.entries(results).map(([c, info])=>(
                <div key={c} style={{
                  padding: '1rem',
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--gray-200)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-800)' }}>
                    {info.quantity} {info.unit}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--gray-600)', margin: '0.25rem 0' }}>
                    of {c} ({info.size})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                    {info.totalServings} total servings
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Category Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginBottom: '1.5rem',
            borderBottom: '2px solid var(--gray-200)',
            paddingBottom: '0.5rem'
          }}>
            {Object.keys(recs).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                  background: activeTab === cat ? 'var(--primary)' : 'var(--gray-100)',
                  color: activeTab === cat ? 'white' : 'var(--gray-700)',
                  fontWeight: activeTab === cat ? '600' : '500',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                  transform: activeTab === cat ? 'translateY(-2px)' : 'none',
                  boxShadow: activeTab === cat ? 'var(--shadow-md)' : 'none'
                }}
              >
                {cat === 'Beer' && '🍺'} {cat === 'Wine' && '🍷'} {cat === 'RTD' && '🥤'} {cat}
              </button>
            ))}
          </div>

          {/* Active Category Content */}
          <div className="recommend-scroll">
            {activeTab && recs[activeTab] && (
              <div className="recommend-cat">
                <h5 style={{ marginBottom: '1rem' }}>
                  {activeTab === 'Beer' && '🍺'} {activeTab === 'Wine' && '🍷'} {activeTab === 'RTD' && '🥤'} {activeTab} Recommendations
                </h5>
                <div className="cards">
                  {Array.isArray(recs[activeTab]) ? recs[activeTab].map((item,idx)=>(
                    <div key={item.id} className="card">
                      <img src={item.img} alt={item.name}/>
                      {item.storeUrl ? (
                        <a 
                          href={item.storeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--primary)',
                            textDecoration: 'underline',
                            fontWeight: '600',
                            fontSize: '1rem'
                          }}
                        >
                          {item.name}
                        </a>
                      ) : (
                        <p>{item.name}</p>
                      )}
                      <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', margin: '0.25rem 0' }}>
                        Size: {item.size || 'Standard'}
                      </p>
                      <p>${item.price}</p>
                      <button className="btn small" onClick={()=>swapOne(activeTab,idx)}>
                        🔄 Swap
                      </button>
                    </div>
                  )) : (
                    <div style={{ 
                      padding: '2rem', 
                      textAlign: 'center', 
                      color: 'var(--gray-500)',
                      background: 'var(--gray-50)',
                      borderRadius: 'var(--radius-lg)',
                      border: '2px dashed var(--gray-200)'
                    }}>
                      No recommendations available
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
