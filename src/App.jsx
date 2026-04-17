import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const inp = { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px', color: '#111', background: '#fff' }
const sel = { padding: '11px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px', color: '#111', background: '#fff' }
const btn = { fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #ccc', background: '#f5f5f5', color: '#111', cursor: 'pointer' }
const btnDark = { fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer' }
const btnRed = { fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #fca5a5', color: '#dc2626', background: '#fef2f2', cursor: 'pointer' }

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

  const Header = () => (
    <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 16px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span onClick={() => { setPage('home'); setSelectedWant(null) }} style={{ fontSize: '22px', fontWeight: '800', cursor: 'pointer', color: '#111', letterSpacing: '-1px' }}>Offr</span>
        {!user && <span style={{ fontSize: '13px', color: '#888' }}>See it. Got it. Offr it.</span>}
        {user && page === 'want' && (
          <button onClick={() => setPage('home')} style={{ ...btn, fontSize: '13px' }}>← Back</button>
        )}
        {user && page !== 'want' && (
          <button onClick={handleLogout} style={{ ...btn, fontSize: '12px' }}>Log out</button>
        )}
      </div>
    </div>
  )

  const BottomNav = () => {
    if (!user) return null
    return (
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', display: 'flex', zIndex: 10, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button onClick={() => { setPage('home'); setSelectedWant(null) }} style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <svg width="22" height="22" fill="none" stroke={page === 'home' || page === 'want' ? '#111' : '#aaa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span style={{ fontSize: '10px', color: page === 'home' || page === 'want' ? '#111' : '#aaa', fontWeight: page === 'home' || page === 'want' ? '600' : '400' }}>Home</span>
        </button>
        <button onClick={() => setPage('post')} style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <div style={{ width: '36px', height: '36px', background: '#111', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '-18px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <span style={{ fontSize: '10px', color: page === 'post' ? '#111' : '#aaa', fontWeight: page === 'post' ? '600' : '400' }}>Post</span>
        </button>
        <button onClick={() => setPage('mylistings')} style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', position: 'relative' }}>
          <svg width="22" height="22" fill="none" stroke={page === 'mylistings' ? '#111' : '#aaa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {myNewOffers > 0 && <span style={{ position: 'absolute', top: '8px', right: 'calc(50% - 18px)', background: '#dc2626', color: '#fff', fontSize: '9px', fontWeight: '700', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{myNewOffers}</span>}
          <span style={{ fontSize: '10px', color: page === 'mylistings' ? '#111' : '#aaa', fontWeight: page === 'mylistings' ? '600' : '400' }}>Mine</span>
        </button>
      </div>
    )
  }

  const pageStyle = { minHeight: '100vh', background: '#f9f9f7', fontFamily: 'sans-serif', paddingBottom: user ? '70px' : '0' }
  const inner = { maxWidth: '680px', margin: '0 auto', padding: '16px' }

  if (page === 'want' && selectedWant) {
    return (
      <div style={pageStyle}>
        <Header />
        <div style={inner}>
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111', flex: 1, paddingRight: '12px' }}>{selectedWant.title}</h2>
              <span style={{ background: selectedWant.status === 'filled' ? '#f0f0f0' : '#f0fdf4', color: selectedWant.status === 'filled' ? '#888' : '#16a34a', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0 }}>
                {selectedWant.status === 'filled' ? 'FILLED' : 'WANT'}
              </span>
            </div>
            {selectedWant.description && <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#555', lineHeight: '1.6' }}>{selectedWant.description}</p>}
            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#888', flexWrap: 'wrap' }}>
              {selectedWant.budget && <span>💰 {selectedWant.budget}</span>}
              {selectedWant.location && <span>📍 {selectedWant.location}</span>}
              {selectedWant.category && <span>🏷 {selectedWant.category}</span>}
            </div>
            {user && user.id === selectedWant.user_id && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                {selectedWant.status !== 'filled' && (
                  <button onClick={() => markFilled(selectedWant.id)} style={{ ...btn, borderColor: '#16a34a', color: '#16a34a', background: '#f0fdf4' }}>Mark as filled</button>
                )}
                <button onClick={() => { deleteWant(selectedWant.id); setPage('home') }} style={btnRed}>Delete</button>
              </div>
            )}
          </div>

          {user && selectedWant.status !== 'filled' ? (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 14px', color: '#111' }}>Submit an offer</h3>
              <input placeholder="Your price e.g. $250" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
              <textarea placeholder="Describe what you have — condition, how to arrange pickup..." value={offerMessage} onChange={e => setOfferMessage(e.target.value)} rows={3} style={{ ...inp, marginBottom: '14px', resize: 'vertical' }} />
              <button onClick={submitOffer} disabled={!offerMessage || submittingOffer} style={{ ...btnDark, width: '100%', padding: '12px', fontSize: '14px', opacity: !offerMessage || submittingOffer ? 0.5 : 1 }}>
                {submittingOffer ? 'Submitting...' : 'Submit offer'}
              </button>
            </div>
          ) : !user ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px', marginBottom: '16px', fontSize: '14px', color: '#92400e' }}>
              Log in to submit an offer
            </div>
          ) : selectedWant.status === 'filled' ? (
            <div style={{ background: '#f5f5f5', borderRadius: '12px', padding: '16px', marginBottom: '16px', fontSize: '14px', color: '#888' }}>
              This listing has been filled
            </div>
          ) : null}

          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 12px', color: '#111' }}>Offers {offers.length > 0 && `(${offers.length})`}</h3>
          {offers.length === 0 && <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '24px 0' }}>No offers yet — be the first!</p>}
          {offers.map(offer => (
            <div key={offer.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>{offer.seller_email}</span>
                {offer.price && <span style={{ fontSize: '15px', fontWeight: '700', color: '#111' }}>{offer.price}</span>}
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: '1.5' }}>{offer.message}</p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#aaa' }}>{new Date(offer.created_at).toLocaleDateString('en-NZ')}</p>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    )
  }

  if (page === 'post') {
    return (
      <div style={pageStyle}>
        <Header />
        <div style={inner}>
          {!user ? (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '24px' }}>
              <p style={{ fontSize: '15px', color: '#555', textAlign: 'center', margin: '0 0 16px' }}>Log in to post a listing</p>
              <button onClick={() => setPage('login')} style={{ ...btnDark, width: '100%', padding: '12px', fontSize: '14px' }}>Log in</button>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '700', margin: '0 0 16px', color: '#111' }}>Post what you're after</h2>
              <input placeholder="What are you after? e.g. Road bike under $300" value={title} onChange={e => setTitle(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
              <input placeholder="More details (optional)" value={description} onChange={e => setDescription(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
              <input placeholder="Max budget e.g. $300" value={budget} onChange={e => setBudget(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
              <select value={location} onChange={e => setLocation(e.target.value)} style={{ ...sel, width: '100%', marginBottom: '10px' }}>
                <option value="">Location</option>
                {locations.filter(l => l !== 'All').map(l => <option key={l}>{l}</option>)}
              </select>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...sel, width: '100%', marginBottom: '16px' }}>
                <option value="">Category (optional)</option>
                {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={postWant} disabled={!title || posting} style={{ ...btnDark, width: '100%', padding: '13px', fontSize: '15px', opacity: !title || posting ? 0.5 : 1 }}>
                {posting ? 'Posting...' : 'Post it'}
              </button>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    )
  }

  if (page === 'mylistings') {
    return (
      <div style={pageStyle}>
        <Header />
        <div style={inner}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#111' }}>My listings</h2>
            <span style={{ fontSize: '13px', color: '#888' }}>{myWants.length} listing{myWants.length !== 1 ? 's' : ''}</span>
          </div>
          {myWants.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '16px', border: '1px solid #eee' }}>
              <p style={{ fontSize: '15px', margin: '0 0 6px', color: '#555' }}>No listings yet</p>
              <p style={{ fontSize: '13px', margin: '0 0 20px', color: '#999' }}>Tap + to post your first listing</p>
              <button onClick={() => setPage('post')} style={{ ...btnDark, padding: '10px 24px' }}>Post something</button>
            </div>
          )}
          {myWants.map(want => (
            <div key={want.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '12px', color: '#111' }}>{want.title}</h3>
                <span style={{ background: want.status === 'filled' ? '#f0f0f0' : offerCounts[want.id] ? '#f0fdf4' : '#f5f5f5', color: want.status === 'filled' ? '#888' : offerCounts[want.id] ? '#16a34a' : '#888', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0 }}>
                  {want.status === 'filled' ? 'Filled' : offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers'}
                </span>
              </div>
              {want.description && <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#555' }}>{want.description}</p>}
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888', marginBottom: '12px', flexWrap: 'wrap' }}>
                {want.budget && <span>💰 {want.budget}</span>}
                {want.location && <span>📍 {want.location}</span>}
                {want.category && <span>{want.category}</span>}
                <span style={{ marginLeft: 'auto' }}>{new Date(want.created_at).toLocaleDateString('en-NZ')}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => openWant(want)} style={btn}>View offers →</button>
                {want.status !== 'filled' && <button onClick={() => markFilled(want.id)} style={{ ...btn, borderColor: '#16a34a', color: '#16a34a', background: '#f0fdf4' }}>Mark filled</button>}
                <button onClick={() => deleteWant(want.id)} style={btnRed}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!user && (page === 'login' || page === 'home')) {
    return (
      <div style={pageStyle}>
        <Header />
        <div style={inner}>
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 6px', color: '#111' }}>{authMode === 'login' ? 'Welcome back' : 'Join Offr'}</h2>
            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 20px' }}>{authMode === 'login' ? 'Log in to post and manage your listings' : 'Sign up free — post what you want, get offers'}</p>
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ ...inp, marginBottom: '10px' }} />
            <input placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} type="password" style={{ ...inp, marginBottom: '16px' }} />
            {authError && <p style={{ fontSize: '13px', color: authError.includes('Check') ? '#16a34a' : '#dc2626', margin: '0 0 12px' }}>{authError}</p>}
            <button onClick={handleAuth} disabled={authLoading} style={{ ...btnDark, width: '100%', padding: '13px', marginBottom: '14px', fontSize: '15px' }}>
              {authLoading ? 'Please wait...' : authMode === 'login' ? 'Log in' : 'Sign up free'}
            </button>
            <p style={{ fontSize: '13px', color: '#888', margin: 0, textAlign: 'center' }}>
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError('') }} style={{ color: '#111', fontWeight: '600', cursor: 'pointer' }}>
                {authMode === 'login' ? 'Sign up free' : 'Log in'}
              </span>
            </p>
          </div>

          <input placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ ...sel, flex: 1 }}>
              <option value="">All locations</option>
              {locations.map(l => <option key={l}>{l}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...sel, flex: 1 }}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#111' }}>Recent listings</h2>
            {filteredWants.length > 0 && <span style={{ fontSize: '13px', color: '#888' }}>{filteredWants.length} listing{filteredWants.length !== 1 ? 's' : ''}</span>}
          </div>
          {loading && <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>Loading...</p>}
          {!loading && filteredWants.length === 0 && <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>No listings found</p>}
          {filteredWants.map(want => (
            <div key={want.id} onClick={() => openWant(want)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '16px', marginBottom: '10px', cursor: 'pointer', opacity: want.status === 'filled' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '12px', color: '#111', textAlign: 'left' }}>{want.title}</h3>
                <span style={{ background: want.status === 'filled' ? '#f0f0f0' : '#f0fdf4', color: want.status === 'filled' ? '#888' : '#16a34a', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0 }}>
                  {want.status === 'filled' ? 'FILLED' : 'WANT'}
                </span>
              </div>
              {want.description && <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#555', textAlign: 'left' }}>{want.description}</p>}
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888', flexWrap: 'wrap' }}>
                {want.budget && <span>💰 {want.budget}</span>}
                {want.location && <span>📍 {want.location}</span>}
                {want.category && <span>{want.category}</span>}
                <span style={{ marginLeft: 'auto' }}>{new Date(want.created_at).toLocaleDateString('en-NZ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', color: offerCounts[want.id] ? '#111' : '#999', fontWeight: offerCounts[want.id] ? '600' : '400' }}>
                  {offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers yet'}
                </span>
                <span style={{ fontSize: '12px', color: '#111', fontWeight: '500' }}>View →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <Header />
      <div style={inner}>
        <input placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ ...sel, flex: 1 }}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...sel, flex: 1 }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#111' }}>Recent listings</h2>
          {filteredWants.length > 0 && <span style={{ fontSize: '13px', color: '#888' }}>{filteredWants.length} listing{filteredWants.length !== 1 ? 's' : ''}</span>}
        </div>
        {loading && <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>Loading...</p>}
        {!loading && filteredWants.length === 0 && <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>No listings found</p>}
        {filteredWants.map(want => (
          <div key={want.id} onClick={() => openWant(want)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '16px', marginBottom: '10px', cursor: 'pointer', opacity: want.status === 'filled' ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '12px', color: '#111', textAlign: 'left' }}>{want.title}</h3>
              <span style={{ background: want.status === 'filled' ? '#f0f0f0' : '#f0fdf4', color: want.status === 'filled' ? '#888' : '#16a34a', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0 }}>
                {want.status === 'filled' ? 'FILLED' : 'WANT'}
              </span>
            </div>
            {want.description && <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#555', textAlign: 'left' }}>{want.description}</p>}
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888', flexWrap: 'wrap' }}>
              {want.budget && <span>💰 {want.budget}</span>}
              {want.location && <span>📍 {want.location}</span>}
              {want.category && <span>{want.category}</span>}
              <span style={{ marginLeft: 'auto' }}>{new Date(want.created_at).toLocaleDateString('en-NZ')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <span style={{ fontSize: '12px', color: offerCounts[want.id] ? '#111' : '#999', fontWeight: offerCounts[want.id] ? '600' : '400' }}>
                {offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers yet'}
              </span>
              <span style={{ fontSize: '12px', color: '#111', fontWeight: '500' }}>View →</span>
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  )
}

export default App