import { useState, useEffect } from 'react'
import { supabase } from './supabase'

function App() {
  const [wants, setWants] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [location, setLocation] = useState('')
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    fetchWants()
  }, [])

  async function fetchWants() {
    const { data } = await supabase.from('wants').select('*').order('created_at', { ascending: false })
    if (data) setWants(data)
    setLoading(false)
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
  }

  async function postWant() {
    if (!title || !user) return
    setPosting(true)
    const { data } = await supabase.from('wants').insert([{ title, description, budget, location }]).select()
    if (data) setWants([data[0], ...wants])
    setTitle('')
    setDescription('')
    setBudget('')
    setLocation('')
    setPosting(false)
  }

  async function submitOffer() {
    if (!offerMessage || !user) return
    setSubmittingOffer(true)
    await supabase.from('offers').insert([{
      want_id: selectedWant.id,
      seller_email: user.email,
      price: offerPrice,
      message: offerMessage
    }])
    setOfferPrice('')
    setOfferMessage('')
    fetchOffers(selectedWant.id)
    setSubmittingOffer(false)
  }

  function openWant(want) {
    setSelectedWant(want)
    setOffers([])
    fetchOffers(want.id)
  }

  if (selectedWant) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'sans-serif' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 20px' }}>
          <div style={{ maxWidth: '680px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '20px', fontWeight: '700' }}>WantIt</span>
            <button onClick={() => setSelectedWant(null)} style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #ddd', background: 'transparent', cursor: 'pointer' }}>Back to listings</button>
          </div>
        </div>

        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>{selectedWant.title}</h2>
              <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>WANT</span>
            </div>
            {selectedWant.description && <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#555' }}>{selectedWant.description}</p>}
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#888' }}>
              {selectedWant.budget && <span>Budget: {selectedWant.budget}</span>}
              {selectedWant.location && <span>Location: {selectedWant.location}</span>}
            </div>
          </div>

          {user && (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Submit an offer</h3>
              <input
                placeholder="Your price e.g. $250"
                value={offerPrice}
                onChange={e => setOfferPrice(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px' }}
              />
              <textarea
                placeholder="Describe what you have — condition, photos available, how to arrange pickup..."
                value={offerMessage}
                onChange={e => setOfferMessage(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '11px 14px', marginBottom: '16px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px', resize: 'vertical' }}
              />
              <button
                onClick={submitOffer}
                disabled={!offerMessage || submittingOffer}
                style={{ background: offerMessage ? '#111' : '#ccc', color: '#fff', padding: '11px 24px', borderRadius: '10px', border: 'none', cursor: offerMessage ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '500' }}
              >
                {submittingOffer ? 'Submitting...' : 'Submit offer'}
              </button>
            </div>
          )}

          {!user && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px', marginBottom: '24px', fontSize: '14px', color: '#92400e' }}>
              Log in to submit an offer on this want
            </div>
          )}

          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>
            Offers {offers.length > 0 && `(${offers.length})`}
          </h3>

          {offers.length === 0 && (
            <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '32px 0' }}>No offers yet — be the first!</p>
          )}

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

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 20px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '20px', fontWeight: '700' }}>WantIt</span>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#888' }}>{user.email}</span>
              <button onClick={handleLogout} style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #ddd', background: 'transparent', cursor: 'pointer' }}>Log out</button>
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: '#888' }}>NZ reverse marketplace</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 20px' }}>
        {!user ? (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '16px', padding: '32px', marginBottom: '32px', maxWidth: '400px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 6px' }}>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px' }}>{authMode === 'login' ? 'Log in to post and manage your wants' : 'Sign up to start posting wants'}</p>
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ width: '100%', padding: '11px 14px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px' }} />
            <input placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} type="password" style={{ width: '100%', padding: '11px 14px', marginBottom: '16px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px' }} />
            {authError && <p style={{ fontSize: '13px', color: authError.includes('Check') ? '#16a34a' : '#dc2626', margin: '0 0 12px' }}>{authError}</p>}
            <button onClick={handleAuth} disabled={authLoading} style={{ width: '100%', background: '#111', color: '#fff', padding: '11px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '16px' }}>
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
            <h2 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Post what you want</h2>
            <input placeholder="What are you looking for? e.g. Road bike under $300" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '11px 14px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px' }} />
            <input placeholder="More details (optional)" value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '11px 14px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px' }} />
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input placeholder="Max budget e.g. $300" value={budget} onChange={e => setBudget(e.target.value)} style={{ flex: 1, padding: '11px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px' }} />
              <input placeholder="Location e.g. Auckland" value={location} onChange={e => setLocation(e.target.value)} style={{ flex: 1, padding: '11px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', boxSizing: 'border-box', fontSize: '14px' }} />
            </div>
            <button onClick={postWant} disabled={!title || posting} style={{ background: title ? '#111' : '#ccc', color: '#fff', padding: '11px 24px', borderRadius: '10px', border: 'none', cursor: title ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '500' }}>
              {posting ? 'Posting...' : 'Post want'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>Recent wants</h2>
          {wants.length > 0 && <span style={{ fontSize: '13px', color: '#888' }}>{wants.length} listing{wants.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading && <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>Loading...</p>}
        {!loading && wants.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: '15px', margin: '0 0 4px', color: '#555' }}>No wants yet</p>
            <p style={{ fontSize: '13px', margin: 0, color: '#999' }}>Be the first to post what you are looking for</p>
          </div>
        )}

        {wants.map(want => (
          <div key={want.id} onClick={() => openWant(want)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '18px 20px', marginBottom: '12px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '12px' }}>{want.title}</h3>
              <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>WANT</span>
            </div>
            {want.description && <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555' }}>{want.description}</p>}
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888' }}>
              {want.budget && <span>Budget: {want.budget}</span>}
              {want.location && <span>Location: {want.location}</span>}
              <span style={{ marginLeft: 'auto' }}>{new Date(want.created_at).toLocaleDateString('en-NZ')}</span>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#111', fontWeight: '500' }}>View offers →</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App