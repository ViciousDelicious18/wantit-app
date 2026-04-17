import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const theme = {
  bg: '#FAFAF8',
  white: '#FFFFFF',
  ink: '#111110',
  inkLight: '#6B6B68',
  inkFaint: '#A8A8A4',
  border: '#E8E8E4',
  borderHover: '#C8C8C4',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  red: '#DC2626',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300;1,9..40,400&family=DM+Serif+Display:ital@0;1&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }

  body { background: ${theme.bg}; font-family: 'DM Sans', sans-serif; color: ${theme.ink}; }

  ::placeholder { color: ${theme.inkFaint}; }

  input, textarea, select {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1.5px solid ${theme.border};
    background: ${theme.white};
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: ${theme.ink};
    outline: none;
    transition: border-color 0.15s ease;
    appearance: none;
  }
  input:focus, textarea:focus, select:focus { border-color: ${theme.ink}; }

  button { font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.15s ease; }

  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 500;
    border: 1.5px solid ${theme.border}; background: ${theme.white}; color: ${theme.ink};
  }
  .btn:hover { border-color: ${theme.borderHover}; background: ${theme.bg}; }

  .btn-dark {
    background: ${theme.ink}; color: ${theme.white}; border: 1.5px solid ${theme.ink};
  }
  .btn-dark:hover { background: #2a2a28; border-color: #2a2a28; }

  .btn-green {
    background: ${theme.greenBg}; color: ${theme.green}; border: 1.5px solid ${theme.greenBorder};
  }
  .btn-green:hover { background: #dcfce7; }

  .btn-red {
    background: ${theme.redBg}; color: ${theme.red}; border: 1.5px solid ${theme.redBorder};
  }
  .btn-red:hover { background: #fee2e2; }

  .card {
    background: ${theme.white};
    border: 1.5px solid ${theme.border};
    border-radius: 16px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .card-hover:hover {
    border-color: ${theme.borderHover};
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    cursor: pointer;
  }

  .badge {
    display: inline-flex; align-items: center;
    padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
  }
  .badge-want { background: ${theme.greenBg}; color: ${theme.green}; }
  .badge-filled { background: #F5F5F3; color: ${theme.inkFaint}; }

  .tag {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; color: ${theme.inkLight};
  }

  .divider { height: 1px; background: ${theme.border}; }

  .nav-btn {
    flex: 1; padding: 10px 0; background: none; border: none;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
  }
  .nav-label { font-size: 10px; font-weight: 500; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.3s ease forwards; }

  .stagger-1 { animation-delay: 0.05s; opacity: 0; }
  .stagger-2 { animation-delay: 0.1s; opacity: 0; }
  .stagger-3 { animation-delay: 0.15s; opacity: 0; }
`

function App() {
  const [wants, setWants] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [selectedWant, setSelectedWant] = useState(null)
  const [offers, setOffers] = useState([])
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [submittingOffer, setSubmittingOffer] = useState(false)
  const [filterLocation, setFilterLocation] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [offerCounts, setOfferCounts] = useState({})
  const [page, setPage] = useState('home')
  const [search, setSearch] = useState('')
  const [seenOffers, setSeenOffers] = useState(() => JSON.parse(localStorage.getItem('seenOffers') || '{}'))

  const categories = ['All', 'Electronics', 'Sport & Outdoors', 'Vehicles', 'Furniture', 'Clothing', 'Tools', 'Music', 'Other']
  const locations = ['All', 'Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin', 'Other']

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    fetchWants()
  }, [])

  async function fetchWants() {
    const { data } = await supabase.from('wants').select('*').order('created_at', { ascending: false })
    if (data) { setWants(data); fetchOfferCounts() }
    setLoading(false)
  }

  async function fetchOfferCounts() {
    const { data } = await supabase.from('offers').select('want_id')
    if (data) {
      const counts = {}
      data.forEach(o => { counts[o.want_id] = (counts[o.want_id] || 0) + 1 })
      setOfferCounts(counts)
    }
  }

  async function fetchOffers(wantId) {
    const { data } = await supabase.from('offers').select('*').eq('want_id', wantId).order('created_at', { ascending: false })
    if (data) setOffers(data)
  }

  async function handleAuth() {
    setAuthLoading(true)
    setAuthError('')
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthError(error.message)
      else setAuthError('Check your email to confirm your account!')
    }
    setAuthLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setPage('home')
  }

  async function postWant() {
    if (!title || !user) return
    setPosting(true)
    const { data } = await supabase.from('wants').insert([{ title, description, budget, location, category, user_id: user.id, user_email: user.email }]).select()
    if (data) { setWants([data[0], ...wants]); setOfferCounts({ ...offerCounts, [data[0].id]: 0 }) }
    setTitle(''); setDescription(''); setBudget(''); setLocation(''); setCategory('')
    setPosting(false)
    setPage('home')
  }

  async function deleteWant(wantId) {
    await supabase.from('wants').delete().eq('id', wantId)
    setWants(wants.filter(w => w.id !== wantId))
    if (selectedWant?.id === wantId) { setSelectedWant(null); setPage('home') }
  }

  async function markFilled(wantId) {
    await supabase.from('wants').update({ status: 'filled' }).eq('id', wantId)
    setWants(wants.map(w => w.id === wantId ? { ...w, status: 'filled' } : w))
    if (selectedWant?.id === wantId) setSelectedWant({ ...selectedWant, status: 'filled' })
  }

  async function submitOffer() {
    if (!offerMessage || !user) return
    setSubmittingOffer(true)
    await supabase.from('offers').insert([{ want_id: selectedWant.id, seller_email: user.email, price: offerPrice, message: offerMessage }])
    setOfferPrice('')
    setOfferMessage('')
    fetchOffers(selectedWant.id)
    setOfferCounts({ ...offerCounts, [selectedWant.id]: (offerCounts[selectedWant.id] || 0) + 1 })
    setSubmittingOffer(false)
  }

  function openWant(want) {
    setSelectedWant(want)
    setOffers([])
    fetchOffers(want.id)
    setPage('want')
    if (want.user_id === user?.id) {
      const updated = { ...seenOffers, [want.id]: offerCounts[want.id] || 0 }
      setSeenOffers(updated)
      localStorage.setItem('seenOffers', JSON.stringify(updated))
    }
  }

  const filteredWants = wants.filter(w => {
    const locMatch = !filterLocation || filterLocation === 'All' || w.location === filterLocation
    const catMatch = !filterCategory || filterCategory === 'All' || w.category === filterCategory
    const searchMatch = !search || w.title.toLowerCase().includes(search.toLowerCase()) || (w.description || '').toLowerCase().includes(search.toLowerCase())
    return locMatch && catMatch && searchMatch
  })

  const myWants = wants.filter(w => w.user_id === user?.id)
  const myNewOffers = myWants.reduce((sum, w) => {
    const current = offerCounts[w.id] || 0
    const seen = seenOffers[w.id] || 0
    return sum + Math.max(0, current - seen)
  }, 0)

  const pageStyle = {
    minHeight: '100vh',
    background: theme.bg,
    fontFamily: "'DM Sans', sans-serif",
    paddingBottom: user ? '72px' : '0',
  }

  const inner = { maxWidth: '640px', margin: '0 auto', padding: '20px 16px' }

  const Header = () => (
    <div style={{ background: 'rgba(250,250,248,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${theme.border}`, padding: '0 16px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          onClick={() => { setPage('home'); setSelectedWant(null) }}
          style={{ fontFamily: "'DM Serif Display', serif", fontSize: '24px', cursor: 'pointer', color: theme.ink, letterSpacing: '-0.5px', fontStyle: 'italic' }}
        >
          Offr
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!user && <span style={{ fontSize: '13px', color: theme.inkFaint, letterSpacing: '0.01em' }}>See it. Want it. Offr it.</span>}
          {user && page === 'want' && (
            <button className="btn" onClick={() => setPage('home')} style={{ gap: '6px' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          )}
          {user && page !== 'want' && (
            <button className="btn" onClick={handleLogout} style={{ fontSize: '12px' }}>Log out</button>
          )}
        </div>
      </div>
    </div>
  )

  const BottomNav = () => {
    if (!user) return null
    return (
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(250,250,248,0.92)', backdropFilter: 'blur(16px)', borderTop: `1px solid ${theme.border}`, display: 'flex', zIndex: 10, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button className="nav-btn" onClick={() => { setPage('home'); setSelectedWant(null) }}>
          <svg width="20" height="20" fill="none" stroke={page === 'home' || page === 'want' ? theme.ink : theme.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="nav-label" style={{ color: page === 'home' || page === 'want' ? theme.ink : theme.inkFaint }}>Browse</span>
        </button>
        <button className="nav-btn" onClick={() => setPage('post')} style={{ position: 'relative' }}>
          <div style={{ width: '40px', height: '40px', background: theme.ink, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '-20px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <span className="nav-label" style={{ color: page === 'post' ? theme.ink : theme.inkFaint }}>Post</span>
        </button>
        <button className="nav-btn" onClick={() => setPage('mylistings')} style={{ position: 'relative' }}>
          <svg width="20" height="20" fill="none" stroke={page === 'mylistings' ? theme.ink : theme.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {myNewOffers > 0 && (
            <span style={{ position: 'absolute', top: '8px', right: 'calc(50% - 20px)', background: theme.red, color: '#fff', fontSize: '9px', fontWeight: '700', minWidth: '16px', height: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{myNewOffers}</span>
          )}
          <span className="nav-label" style={{ color: page === 'mylistings' ? theme.ink : theme.inkFaint }}>Mine</span>
        </button>
      </div>
    )
  }

  const WantCard = ({ want, index = 0 }) => (
    <div
      className={`card card-hover fade-up stagger-${Math.min(index + 1, 3)}`}
      onClick={() => openWant(want)}
      style={{ padding: '18px 20px', marginBottom: '10px', opacity: want.status === 'filled' ? 0.55 : 1 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: theme.ink, flex: 1, paddingRight: '14px', lineHeight: '1.4' }}>{want.title}</h3>
        <span className={`badge ${want.status === 'filled' ? 'badge-filled' : 'badge-want'}`}>
          {want.status === 'filled' ? 'Filled' : 'Want'}
        </span>
      </div>
      {want.description && (
        <p style={{ fontSize: '13px', color: theme.inkLight, lineHeight: '1.55', marginBottom: '12px' }}>{want.description}</p>
      )}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {want.budget && <span className="tag">💰 {want.budget}</span>}
        {want.location && <span className="tag">📍 {want.location}</span>}
        {want.category && <span className="tag">{want.category}</span>}
      </div>
      <div className="divider" style={{ marginBottom: '12px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: offerCounts[want.id] ? theme.green : theme.inkFaint, fontWeight: offerCounts[want.id] ? '600' : '400' }}>
          {offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers yet'}
        </span>
        <span style={{ fontSize: '12px', color: theme.inkFaint }}>{new Date(want.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  )

  // WANT DETAIL PAGE
  if (page === 'want' && selectedWant) {
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        <Header />
        <div style={inner}>
          <div className="card fade-up" style={{ padding: '24px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.ink, flex: 1, paddingRight: '14px', lineHeight: '1.3', fontFamily: "'DM Serif Display', serif" }}>{selectedWant.title}</h2>
              <span className={`badge ${selectedWant.status === 'filled' ? 'badge-filled' : 'badge-want'}`}>
                {selectedWant.status === 'filled' ? 'Filled' : 'Want'}
              </span>
            </div>
            {selectedWant.description && (
              <p style={{ fontSize: '14px', color: theme.inkLight, lineHeight: '1.65', marginBottom: '16px' }}>{selectedWant.description}</p>
            )}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: user && user.id === selectedWant.user_id ? '20px' : '0' }}>
              {selectedWant.budget && <span className="tag" style={{ fontSize: '13px' }}>💰 {selectedWant.budget}</span>}
              {selectedWant.location && <span className="tag" style={{ fontSize: '13px' }}>📍 {selectedWant.location}</span>}
              {selectedWant.category && <span className="tag" style={{ fontSize: '13px' }}>🏷 {selectedWant.category}</span>}
            </div>
            {user && user.id === selectedWant.user_id && (
              <>
                <div className="divider" style={{ margin: '20px 0 16px' }} />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedWant.status !== 'filled' && (
                    <button className="btn btn-green" onClick={() => markFilled(selectedWant.id)}>
                      ✓ Mark as filled
                    </button>
                  )}
                  <button className="btn btn-red" onClick={() => { deleteWant(selectedWant.id); setPage('home') }}>Delete</button>
                </div>
              </>
            )}
          </div>

          {user && selectedWant.status !== 'filled' ? (
            <div className="card fade-up" style={{ padding: '24px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: theme.ink }}>Make an offer</h3>
              <input placeholder="Your price — e.g. $250" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} style={{ marginBottom: '10px' }} />
              <textarea placeholder="Describe what you have — condition, photos, pickup..." value={offerMessage} onChange={e => setOfferMessage(e.target.value)} rows={3} style={{ marginBottom: '14px', resize: 'vertical' }} />
              <button
                className="btn btn-dark"
                onClick={submitOffer}
                disabled={!offerMessage || submittingOffer}
                style={{ width: '100%', padding: '13px', fontSize: '14px', opacity: !offerMessage || submittingOffer ? 0.45 : 1 }}
              >
                {submittingOffer ? 'Submitting…' : 'Submit offer'}
              </button>
            </div>
          ) : !user ? (
            <div style={{ background: theme.amberBg, border: `1.5px solid ${theme.amberBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '14px', fontSize: '13px', color: theme.amber }}>
              Log in to submit an offer on this listing.
            </div>
          ) : selectedWant.status === 'filled' ? (
            <div style={{ background: '#F5F5F3', borderRadius: '12px', padding: '16px', marginBottom: '14px', fontSize: '13px', color: theme.inkFaint, textAlign: 'center' }}>
              This listing has been filled
            </div>
          ) : null}

          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: theme.ink }}>
              Offers{offers.length > 0 ? ` (${offers.length})` : ''}
            </span>
          </div>

          {offers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.inkFaint, fontSize: '13px' }}>
              No offers yet
            </div>
          )}

          {offers.map((offer, i) => (
            <div key={offer.id} className={`card fade-up stagger-${Math.min(i + 1, 3)}`} style={{ padding: '16px 20px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: theme.inkLight, fontWeight: '500' }}>{offer.seller_email}</span>
                {offer.price && <span style={{ fontSize: '16px', fontWeight: '700', color: theme.ink }}>{offer.price}</span>}
              </div>
              <p style={{ fontSize: '13px', color: theme.inkLight, lineHeight: '1.55', marginBottom: '10px' }}>{offer.message}</p>
              <span style={{ fontSize: '11px', color: theme.inkFaint }}>{new Date(offer.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    )
  }

  // POST PAGE
  if (page === 'post') {
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        <Header />
        <div style={inner}>
          {!user ? (
            <div className="card fade-up" style={{ padding: '32px', textAlign: 'center' }}>
              <p style={{ fontSize: '15px', color: theme.inkLight, marginBottom: '20px' }}>Log in to post a listing</p>
              <button className="btn btn-dark" onClick={() => setPage('login')} style={{ padding: '12px 28px', fontSize: '14px' }}>Log in</button>
            </div>
          ) : (
            <div className="card fade-up" style={{ padding: '28px' }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', marginBottom: '6px', color: theme.ink }}>What are you after?</h2>
              <p style={{ fontSize: '13px', color: theme.inkFaint, marginBottom: '24px' }}>Post your listing and let sellers come to you.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Title — e.g. Road bike under $300" value={title} onChange={e => setTitle(e.target.value)} />
                <textarea placeholder="More details (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
                <input placeholder="Max budget — e.g. $300" value={budget} onChange={e => setBudget(e.target.value)} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={location} onChange={e => setLocation(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Location</option>
                    {locations.filter(l => l !== 'All').map(l => <option key={l}>{l}</option>)}
                  </select>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Category</option>
                    {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  className="btn btn-dark"
                  onClick={postWant}
                  disabled={!title || posting}
                  style={{ padding: '14px', fontSize: '15px', marginTop: '6px', opacity: !title || posting ? 0.45 : 1 }}
                >
                  {posting ? 'Posting…' : 'Post listing'}
                </button>
              </div>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    )
  }

  // MY LISTINGS PAGE
  if (page === 'mylistings') {
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        <Header />
        <div style={inner}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }} className="fade-up">
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', color: theme.ink, fontStyle: 'italic' }}>My listings</h2>
            <span style={{ fontSize: '12px', color: theme.inkFaint }}>{myWants.length} listing{myWants.length !== 1 ? 's' : ''}</span>
          </div>

          {myWants.length === 0 && (
            <div className="card fade-up" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: '15px', color: theme.inkLight, marginBottom: '6px' }}>No listings yet</p>
              <p style={{ fontSize: '13px', color: theme.inkFaint, marginBottom: '24px' }}>Tap + to post your first listing</p>
              <button className="btn btn-dark" onClick={() => setPage('post')} style={{ padding: '10px 24px' }}>Post something</button>
            </div>
          )}

          {myWants.map((want, i) => (
            <div key={want.id} className={`card fade-up stagger-${Math.min(i + 1, 3)}`} style={{ padding: '18px 20px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '14px', color: theme.ink, lineHeight: '1.4' }}>{want.title}</h3>
                <span style={{
                  background: want.status === 'filled' ? '#F5F5F3' : offerCounts[want.id] ? theme.greenBg : '#F5F5F3',
                  color: want.status === 'filled' ? theme.inkFaint : offerCounts[want.id] ? theme.green : theme.inkFaint,
                  fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0
                }}>
                  {want.status === 'filled' ? 'Filled' : offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers'}
                </span>
              </div>
              {want.description && <p style={{ fontSize: '13px', color: theme.inkLight, marginBottom: '10px', lineHeight: '1.5' }}>{want.description}</p>}
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {want.budget && <span className="tag">💰 {want.budget}</span>}
                {want.location && <span className="tag">📍 {want.location}</span>}
                {want.category && <span className="tag">{want.category}</span>}
              </div>
              <div className="divider" style={{ marginBottom: '14px' }} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => openWant(want)} style={{ fontSize: '12px' }}>View offers →</button>
                {want.status !== 'filled' && <button className="btn btn-green" onClick={() => markFilled(want.id)} style={{ fontSize: '12px' }}>✓ Mark filled</button>}
                <button className="btn btn-red" onClick={() => deleteWant(want.id)} style={{ fontSize: '12px' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    )
  }

  // AUTH / HOME (logged out)
  if (!user && (page === 'login' || page === 'home')) {
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        <Header />
        <div style={inner}>
          <div className="card fade-up" style={{ padding: '32px', marginBottom: '24px' }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '24px', marginBottom: '6px', color: theme.ink, fontStyle: 'italic' }}>
              {authMode === 'login' ? 'Welcome back' : 'Join Offr'}
            </h2>
            <p style={{ fontSize: '13px', color: theme.inkFaint, marginBottom: '24px' }}>
              {authMode === 'login' ? 'Log in to post and manage your listings' : 'Post what you want, let sellers come to you'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" />
              <input placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} type="password" />
            </div>
            {authError && (
              <p style={{ fontSize: '13px', color: authError.includes('Check') ? theme.green : theme.red, marginBottom: '14px', fontWeight: '500' }}>{authError}</p>
            )}
            <button className="btn btn-dark" onClick={handleAuth} disabled={authLoading} style={{ width: '100%', padding: '14px', fontSize: '14px', marginBottom: '16px' }}>
              {authLoading ? 'Please wait…' : authMode === 'login' ? 'Log in' : 'Create account'}
            </button>
            <p style={{ fontSize: '13px', color: theme.inkFaint, textAlign: 'center' }}>
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span
                onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError('') }}
                style={{ color: theme.ink, fontWeight: '600', cursor: 'pointer' }}
              >
                {authMode === 'login' ? 'Sign up free' : 'Log in'}
              </span>
            </p>
          </div>

          <div style={{ marginBottom: '20px' }} className="fade-up stagger-1">
            <input placeholder="Search listings…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ flex: 1 }}>
                <option value="">All locations</option>
                {locations.map(l => <option key={l}>{l}</option>)}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ flex: 1 }}>
                <option value="">All categories</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }} className="fade-up stagger-2">
            <span style={{ fontSize: '13px', fontWeight: '600', color: theme.ink }}>Recent listings</span>
            {filteredWants.length > 0 && <span style={{ fontSize: '12px', color: theme.inkFaint }}>{filteredWants.length} listing{filteredWants.length !== 1 ? 's' : ''}</span>}
          </div>

          {loading && <p style={{ color: theme.inkFaint, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Loading…</p>}
          {!loading && filteredWants.length === 0 && <p style={{ color: theme.inkFaint, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No listings found</p>}
          {filteredWants.map((want, i) => <WantCard key={want.id} want={want} index={i} />)}
        </div>
      </div>
    )
  }

  // HOME (logged in)
  return (
    <div style={pageStyle}>
      <style>{styles}</style>
      <Header />
      <div style={inner}>
        <div style={{ marginBottom: '20px' }} className="fade-up">
          <input placeholder="Search listings…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: '10px' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ flex: 1 }}>
              <option value="">All locations</option>
              {locations.map(l => <option key={l}>{l}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ flex: 1 }}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }} className="fade-up stagger-1">
          <span style={{ fontSize: '13px', fontWeight: '600', color: theme.ink }}>Recent listings</span>
          {filteredWants.length > 0 && <span style={{ fontSize: '12px', color: theme.inkFaint }}>{filteredWants.length} listing{filteredWants.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading && <p style={{ color: theme.inkFaint, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Loading…</p>}
        {!loading && filteredWants.length === 0 && <p style={{ color: theme.inkFaint, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No listings found</p>}
        {filteredWants.map((want, i) => <WantCard key={want.id} want={want} index={i} />)}
      </div>
      <BottomNav />
    </div>
  )
}

export default App