import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const btn = { fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #ccc', background: '#f5f5f5', color: '#111', cursor: 'pointer' }
const btnDark = { fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer' }
const btnRed = { fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #fca5a5', color: '#dc2626', background: '#fef2f2', cursor: 'pointer' }
const inp = { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px', color: '#111', background: '#fff' }
const sel = { padding: '11px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px', color: '#111', background: '#fff' }

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
    <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 20px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span onClick={() => { setPage('home'); setSelectedWant(null) }} style={{ fontSize: '20px', fontWeight: '700', cursor: 'pointer', color: '#111' }}>Offr</span>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setPage('mylistings')} style={{ ...btn, ...(page === 'mylistings' ? { background: '#111', color: '#fff', borderColor: '#111' } : {}), position: 'relative' }}>
              My listings
              {myNewOffers > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#dc2626', color: '#fff', fontSize: '10px', fontWeight: '700', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{myNewOffers}</span>
              )}
            </button>
            <button onClick={handleLogout} style={btn}>Log out</button>
          </div>
        ) : (
          <span style={{ fontSize: '13px', color: '#888' }}>See it. Got it. Offr it.</span>
        )}
      </div>
    </div>
  )

  if (page === 'want' && selectedWant) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'sans-serif' }}>
        <Header />
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111' }}>{selectedWant.title}</h2>
              <span style={{ background: selectedWant.status === 'filled' ? '#f0f0f0' : '#f0fdf4', color: selectedWant.status === 'filled' ? '#888' : '#16a34a', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>
                {selectedWant.status === 'filled' ? 'FILLED' : 'WANT'}
              </span>
            </div>
            {selectedWant.description && <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#555' }}>{selectedWant.description}</p>}
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#888', flexWrap: 'wrap' }}>
              {selectedWant.budget && <span>Budget: {selectedWant.budget}</span>}
              {selectedWant.location && <span>Location: {selectedWant.location}</span>}
              {selectedWant.category && <span>Category: {selectedWant.category}</span>}
            </div>
            {user && user.id === selectedWant.user_id && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                {selectedWant.status !== 'filled' && (
                  <button onClick={() => markFilled(selectedWant.id)} style={{ ...btn, borderColor: '#16a34a', color: '#16a34a', background: '#f0fdf4' }}>Mark as filled</button>
                )}
                <button onClick={() => { deleteWant(selectedWant.id); setPage('home') }} style={btnRed}>Delete listing</button>
              </div>
            )}
          </div>

          {user && selectedWant.status !== 'filled' ? (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: '#111' }}>Submit an offer</h3>
              <input placeholder="Your price e.g. $250" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
              <textarea placeholder="Describe what you have — condition, photos available, how to arrange pickup..." value={offerMessage} onChange={e => setOfferMessage(e.target.value)} rows={3} style={{ ...inp, marginBottom: '16px', resize: 'vertical' }} />
              <button onClick={submitOffer} disabled={!offerMessage || submittingOffer} style={{ ...btnDark, opacity: !offerMessage || submittingOffer ? 0.5 : 1 }}>
                {submittingOffer ? 'Submitting...' : 'Submit offer'}
              </button>
            </div>
          ) : !user ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px', marginBottom: '24px', fontSize: '14px', color: '#92400e' }}>
              Log in to submit an offer on this want
            </div>
          ) : selectedWant.status === 'filled' ? (
            <div style={{ background: '#f0f0f0', borderRadius: '12px', padding: '16px', marginBottom: '24px', fontSize: '14px', color: '#888' }}>
              This want has been filled — no longer accepting offers
            </div>
          ) : null}

          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: '#111' }}>Offers {offers.length > 0 && `(${offers.length})`}</h3>
          {offers.length === 0 && <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '32px 0' }}>No offers yet — be the first!</p>}
          {offers.map(offer => (
            <div key={offer.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '18px 20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>{offer.seller_email}</span>
                {offer.price && <span style={{ fontSize: '14px', fontWeight: '700', color: '#111' }}>{offer.price}</span>}
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: '1.5' }}>{offer.message}</p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#aaa' }}>{new Date(offer.created_at).toLocaleDateString('en-NZ')}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (page === 'mylistings') {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'sans-serif' }}>
        <Header />
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#111' }}>My listings</h2>
            <span style={{ fontSize: '13px', color: '#888' }}>{myWants.length} listing{myWants.length !== 1 ? 's' : ''}</span>
          </div>
          {myWants.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '16px', border: '1px solid #eee' }}>
              <p style={{ fontSize: '15px', margin: '0 0 8px', color: '#555' }}>No listings yet</p>
              <p style={{ fontSize: '13px', margin: '0 0 20px', color: '#999' }}>Post your first want from the home page</p>
              <button onClick={() => setPage('home')} style={btnDark}>Go to home</button>
            </div>
          )}
          {myWants.map(want => (
            <div key={want.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '18px 20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '12px', color: '#111' }}>{want.title}</h3>
                <span style={{ background: want.status === 'filled' ? '#f0f0f0' : offerCounts[want.id] ? '#f0fdf4' : '#f5f5f5', color: want.status === 'filled' ? '#888' : offerCounts[want.id] ? '#16a34a' : '#888', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>
                  {want.status === 'filled' ? 'Filled' : offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers'}
                </span>
              </div>
              {want.description && <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555' }}>{want.description}</p>}
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                {want.budget && <span>Budget: {want.budget}</span>}
                {want.location && <span>{want.location}</span>}
                {want.category && <span>{want.category}</span>}
                <span style={{ marginLeft: 'auto' }}>{new Date(want.created_at).toLocaleDateString('en-NZ')}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => openWant(want)} style={btn}>View offers →</button>
                {want.status !== 'filled' && <button onClick={() => markFilled(want.id)} style={{ ...btn, borderColor: '#16a34a', color: '#16a34a', background: '#f0fdf4' }}>Mark as filled</button>}
                <button onClick={() => deleteWant(want.id)} style={btnRed}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'sans-serif' }}>
      <Header />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 20px' }}>
        {!user ? (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '32px', maxWidth: '400px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 6px', color: '#111' }}>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px' }}>{authMode === 'login' ? 'Log in to post and manage your wants' : 'Sign up to start posting wants'}</p>
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ ...inp, marginBottom: '10px' }} />
            <input placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} type="password" style={{ ...inp, marginBottom: '16px' }} />
            {authError && <p style={{ fontSize: '13px', color: authError.includes('Check') ? '#16a34a' : '#dc2626', margin: '0 0 12px' }}>{authError}</p>}
            <button onClick={handleAuth} disabled={authLoading} style={{ ...btnDark, width: '100%', padding: '11px', marginBottom: '16px', fontSize: '14px' }}>
              {authLoading ? 'Please wait...' : authMode === 'login' ? 'Log in' : 'Sign up'}
            </button>
            <p style={{ fontSize: '13px', color: '#888', margin: 0, textAlign: 'center' }}>
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError('') }} style={{ color: '#111', fontWeight: '500', cursor: 'pointer' }}>
                {authMode === 'login' ? 'Sign up' : 'Log in'}
              </span>
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: '#111' }}>Post what you're after</h2>
            <input placeholder="What are you after? e.g. Road bike under $300" value={title} onChange={e => setTitle(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
            <input placeholder="More details (optional)" value={description} onChange={e => setDescription(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input placeholder="Max budget e.g. $300" value={budget} onChange={e => setBudget(e.target.value)} style={{ ...inp, flex: 1 }} />
              <select value={location} onChange={e => setLocation(e.target.value)} style={{ ...sel, flex: 1 }}>
                <option value="">Location</option>
                {locations.filter(l => l !== 'All').map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...sel, width: '100%', marginBottom: '16px' }}>
              <option value="">Category (optional)</option>
              {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
            </select>
            <button onClick={postWant} disabled={!title || posting} style={{ ...btnDark, opacity: !title || posting ? 0.5 : 1 }}>
              {posting ? 'Posting...' : 'Post want'}
            </button>
          </div>
        )}

        <input placeholder="Search wants..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: '12px' }} />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ ...sel, flex: 1 }}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...sel, flex: 1 }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#111' }}>Recent wants</h2>
          {filteredWants.length > 0 && <span style={{ fontSize: '13px', color: '#888' }}>{filteredWants.length} listing{filteredWants.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading && <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>Loading...</p>}
        {!loading && filteredWants.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: '15px', margin: '0 0 4px', color: '#555' }}>No wants found</p>
            <p style={{ fontSize: '13px', margin: 0, color: '#999' }}>Try changing your search or filters</p>
          </div>
        )}

        {filteredWants.map(want => (
          <div key={want.id} onClick={() => openWant(want)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '18px 20px', marginBottom: '12px', cursor: 'pointer', opacity: want.status === 'filled' ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '12px', color: '#111' }}>{want.title}</h3>
              <span style={{ background: want.status === 'filled' ? '#f0f0f0' : '#f0fdf4', color: want.status === 'filled' ? '#888' : '#16a34a', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>
                {want.status === 'filled' ? 'FILLED' : 'WANT'}
              </span>
            </div>
            {want.description && <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555' }}>{want.description}</p>}
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888', flexWrap: 'wrap' }}>
              {want.budget && <span>Budget: {want.budget}</span>}
              {want.location && <span>Location: {want.location}</span>}
              {want.category && <span>{want.category}</span>}
              <span style={{ marginLeft: 'auto' }}>{new Date(want.created_at).toLocaleDateString('en-NZ')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <span style={{ fontSize: '12px', color: offerCounts[want.id] ? '#111' : '#999', fontWeight: offerCounts[want.id] ? '600' : '400' }}>
                {offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers yet'}
              </span>
              <span style={{ fontSize: '12px', color: '#111', fontWeight: '500' }}>View offers →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App