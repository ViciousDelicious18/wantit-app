import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Serif+Display:ital@0;1&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }

  body { background: #E8EFF5; font-family: 'DM Sans', sans-serif; color: #0F2030; }

  ::placeholder { color: #8FA5B8; }

  input, textarea, select {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1.5px solid #C8DCE8;
    background: #FFFFFF;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #0F2030;
    outline: none;
    transition: border-color 0.15s ease;
    appearance: none;
  }
  input:focus, textarea:focus, select:focus { border-color: #0E7FA8; }

  button { font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.15s ease; }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 500;
    border: 1.5px solid #C8DCE8; background: #FFFFFF; color: #0F2030;
  }
  .btn:hover { border-color: #0E7FA8; background: #EBF6FB; color: #0E7FA8; }

  .btn-primary {
    background: #0E7FA8; color: #FFFFFF; border: 1.5px solid #0E7FA8;
  }
  .btn-primary:hover { background: #0A6588; border-color: #0A6588; }
  .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-green {
    background: #EDFAF4; color: #0E9A6E; border: 1.5px solid #A7EDD4;
  }
  .btn-green:hover { background: #d4f5e8; }

  .btn-red {
    background: #FEF2F2; color: #DC2626; border: 1.5px solid #FECACA;
  }
  .btn-red:hover { background: #fee2e2; }

  .card {
    background: #FFFFFF;
    border: 1.5px solid #D6E4EF;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(14, 127, 168, 0.07);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .card-hover:hover {
    border-color: #7EC8E0;
    box-shadow: 0 6px 24px rgba(14, 127, 168, 0.13);
    cursor: pointer;
  }

  .badge {
    display: inline-flex; align-items: center; flex-shrink: 0;
    padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
  }
  .badge-want { background: #EBF6FB; color: #0E7FA8; }
  .badge-filled { background: #EDF2F7; color: #8FA5B8; }

  .tag {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; color: #4A6278;
  }

  .divider { height: 1px; background: #E4EFF7; }

  .nav-btn {
    flex: 1; padding: 10px 0; background: none; border: none;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
  }
  .nav-label { font-size: 10px; font-weight: 500; }

  .img-upload-area {
    border: 2px dashed #C8DCE8;
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s ease;
    background: #F5F9FC;
  }
  .img-upload-area:hover { border-color: #0E7FA8; background: #EBF6FB; }

  .img-thumb {
    width: 80px; height: 80px; object-fit: cover;
    border-radius: 10px; border: 1.5px solid #D6E4EF;
  }

  .img-gallery {
    display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;
  }

  .img-gallery-full {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }
  .img-gallery-full img {
    width: 100%; aspect-ratio: 1; object-fit: cover;
    border-radius: 12px; border: 1.5px solid #D6E4EF;
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  .img-gallery-full img:hover { transform: scale(1.02); }

  .img-lightbox {
    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; cursor: pointer;
  }
  .img-lightbox img { max-width: 92vw; max-height: 88vh; border-radius: 12px; }

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
  const [images, setImages] = useState([]) // local File objects
  const [imagePreviews, setImagePreviews] = useState([]) // local preview URLs
  const [uploadingImages, setUploadingImages] = useState(false)
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
  const [lightboxImg, setLightboxImg] = useState(null)
  const fileInputRef = useRef()

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

  function handleImageSelect(e) {
    const files = Array.from(e.target.files).slice(0, 4)
    setImages(files)
    setImagePreviews(files.map(f => URL.createObjectURL(f)))
  }

  function removeImage(index) {
    const newImages = images.filter((_, i) => i !== index)
    const newPreviews = imagePreviews.filter((_, i) => i !== index)
    setImages(newImages)
    setImagePreviews(newPreviews)
  }


  async function handleAuth() {
    setAuthLoading(true); setAuthError('')
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

  async function handleLogout() { await supabase.auth.signOut(); setPage('home') }

  async function postWant() {
    if (!title || !user) return
    setPosting(true)
    let imageUrls = []
    if (images.length > 0) {
      setUploadingImages(true)
      const tempId = crypto.randomUUID()
      for (const file of images) {
        const ext = file.name.split('.').pop()
        const path = tempId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
        const { error } = await supabase.storage.from('listing-images').upload(path, file)
        if (!error) {
          const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(path)
          imageUrls.push(urlData.publicUrl)
        }
      }
      setUploadingImages(false)
    }
    const { data } = await supabase.from('wants').insert([{ title, description, budget, location, category, user_id: user.id, user_email: user.email, images: imageUrls }]).select()
    if (data && data[0]) {
      setWants([{ ...data[0], images: imageUrls }, ...wants])
      setOfferCounts({ ...offerCounts, [data[0].id]: 0 })
    }
    setTitle(''); setDescription(''); setBudget(''); setLocation(''); setCategory('')
    setImages([]); setImagePreviews([])
    setPosting(false); setPage('home')
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
    setOfferPrice(''); setOfferMessage('')
    fetchOffers(selectedWant.id)
    setOfferCounts({ ...offerCounts, [selectedWant.id]: (offerCounts[selectedWant.id] || 0) + 1 })
    setSubmittingOffer(false)
  }

  function openWant(want) {
    setSelectedWant(want); setOffers([]); fetchOffers(want.id); setPage('want')
    if (want.user_id === user?.id) {
      const updated = { ...seenOffers, [want.id]: offerCounts[want.id] || 0 }
      setSeenOffers(updated); localStorage.setItem('seenOffers', JSON.stringify(updated))
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

  const pageStyle = { minHeight: '100vh', background: '#E8EFF5', fontFamily: "'DM Sans', sans-serif", paddingBottom: user ? '72px' : '0' }
  const inner = { maxWidth: '640px', margin: '0 auto', padding: '20px 16px' }

  const Header = () => (
    <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #D6E4EF', padding: '0 16px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span onClick={() => { setPage('home'); setSelectedWant(null) }} style={{ fontFamily: "'DM Serif Display', serif", fontSize: '24px', cursor: 'pointer', color: '#0E7FA8', letterSpacing: '-0.5px', fontStyle: 'italic' }}>Offr</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!user && <span style={{ fontSize: '13px', color: '#8FA5B8' }}>See it. Want it. Offr it.</span>}
          {user && page === 'want' && (
            <button className="btn" onClick={() => setPage('home')}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          )}
          {user && page !== 'want' && <button className="btn" onClick={handleLogout} style={{ fontSize: '12px' }}>Log out</button>}
        </div>
      </div>
    </div>
  )

  const BottomNav = () => {
    if (!user) return null
    return (
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid #D6E4EF', display: 'flex', zIndex: 10, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button className="nav-btn" onClick={() => { setPage('home'); setSelectedWant(null) }}>
          <svg width="20" height="20" fill="none" stroke={page === 'home' || page === 'want' ? '#0E7FA8' : '#8FA5B8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="nav-label" style={{ color: page === 'home' || page === 'want' ? '#0E7FA8' : '#8FA5B8' }}>Browse</span>
        </button>
        <button className="nav-btn" onClick={() => setPage('post')}>
          <div style={{ width: '40px', height: '40px', background: '#0E7FA8', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '-20px', boxShadow: '0 4px 16px rgba(14,127,168,0.35)' }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <span className="nav-label" style={{ color: page === 'post' ? '#0E7FA8' : '#8FA5B8' }}>Post</span>
        </button>
        <button className="nav-btn" onClick={() => setPage('mylistings')} style={{ position: 'relative' }}>
          <svg width="20" height="20" fill="none" stroke={page === 'mylistings' ? '#0E7FA8' : '#8FA5B8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {myNewOffers > 0 && <span style={{ position: 'absolute', top: '8px', right: 'calc(50% - 20px)', background: '#DC2626', color: '#fff', fontSize: '9px', fontWeight: '700', minWidth: '16px', height: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{myNewOffers}</span>}
          <span className="nav-label" style={{ color: page === 'mylistings' ? '#0E7FA8' : '#8FA5B8' }}>Mine</span>
        </button>
      </div>
    )
  }

  const WantCard = ({ want, index = 0 }) => {
    const hasImages = want.images && want.images.length > 0
    return (
      <div className={`card card-hover fade-up stagger-${Math.min(index + 1, 3)}`} onClick={() => openWant(want)} style={{ marginBottom: '10px', opacity: want.status === 'filled' ? 0.55 : 1, overflow: 'hidden' }}>
        {hasImages && (
          <div style={{ display: 'flex', gap: '2px', height: '160px', overflow: 'hidden', borderRadius: '14px 14px 0 0' }}>
            <img src={want.images[0]} alt="" style={{ flex: 1, objectFit: 'cover', minWidth: 0 }} />
            {want.images[1] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: want.images.length > 2 ? 1 : 0.6 }}>
                <img src={want.images[1]} alt="" style={{ flex: 1, objectFit: 'cover', width: '100%' }} />
                {want.images[2] && (
                  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <img src={want.images[2]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {want.images.length > 3 && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '700' }}>+{want.images.length - 3}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#0F2030', flex: 1, paddingRight: '14px', lineHeight: '1.4', textAlign: 'left' }}>{want.title}</h3>
            <span className={`badge ${want.status === 'filled' ? 'badge-filled' : 'badge-want'}`}>{want.status === 'filled' ? 'Filled' : 'Want'}</span>
          </div>
          {want.description && <p style={{ fontSize: '13px', color: '#4A6278', lineHeight: '1.55', marginBottom: '12px', textAlign: 'left' }}>{want.description}</p>}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {want.budget && <span className="tag">💰 {want.budget}</span>}
            {want.location && <span className="tag">📍 {want.location}</span>}
            {want.category && <span className="tag">{want.category}</span>}
          </div>
          <div className="divider" style={{ marginBottom: '12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: offerCounts[want.id] ? '#0E9A6E' : '#8FA5B8', fontWeight: offerCounts[want.id] ? '600' : '400' }}>
              {offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers yet'}
            </span>
            <span style={{ fontSize: '12px', color: '#8FA5B8' }}>{new Date(want.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span>
          </div>
        </div>
      </div>
    )
  }

  const ImageUploader = () => (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageSelect} />
      {imagePreviews.length === 0 ? (
        <div className="img-upload-area" onClick={() => fileInputRef.current.click()}>
          <svg width="28" height="28" fill="none" stroke="#8FA5B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ marginBottom: '8px' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <p style={{ fontSize: '13px', color: '#8FA5B8', margin: 0 }}>Add photos <span style={{ color: '#0E7FA8', fontWeight: '600' }}>Browse</span></p>
          <p style={{ fontSize: '11px', color: '#B0C4D4', marginTop: '4px' }}>Up to 4 images</p>
        </div>
      ) : (
        <div>
          <div className="img-gallery">
            {imagePreviews.map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={src} className="img-thumb" alt="" />
                <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#DC2626', border: 'none', color: '#fff', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
              </div>
            ))}
            {imagePreviews.length < 4 && (
              <div onClick={() => fileInputRef.current.click()} style={{ width: '80px', height: '80px', border: '2px dashed #C8DCE8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#F5F9FC' }}>
                <span style={{ fontSize: '22px', color: '#8FA5B8' }}>+</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const SearchFilters = () => (
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
  )

  const ListingsHeader = () => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }} className="fade-up stagger-1">
      <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F2030' }}>Recent listings</span>
      {filteredWants.length > 0 && <span style={{ fontSize: '12px', color: '#8FA5B8' }}>{filteredWants.length} listing{filteredWants.length !== 1 ? 's' : ''}</span>}
    </div>
  )

  // LIGHTBOX
  const Lightbox = () => {
    if (!lightboxImg) return null
    return (
      <div className="img-lightbox" onClick={() => setLightboxImg(null)}>
        <img src={lightboxImg} alt="" />
      </div>
    )
  }

  // WANT DETAIL PAGE
  if (page === 'want' && selectedWant) {
    const hasImages = selectedWant.images && selectedWant.images.length > 0
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        <Header />
        <Lightbox />
        <div style={inner}>
          <div className="card fade-up" style={{ marginBottom: '14px', overflow: 'hidden' }}>
            {hasImages && (
              <div className="img-gallery-full" style={{ padding: '16px 16px 0' }}>
                {selectedWant.images.map((url, i) => (
                  <img key={i} src={url} alt="" onClick={() => setLightboxImg(url)} />
                ))}
              </div>
            )}
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F2030', flex: 1, paddingRight: '14px', lineHeight: '1.3', fontFamily: "'DM Serif Display', serif", textAlign: 'left' }}>{selectedWant.title}</h2>
                <span className={`badge ${selectedWant.status === 'filled' ? 'badge-filled' : 'badge-want'}`}>{selectedWant.status === 'filled' ? 'Filled' : 'Want'}</span>
              </div>
              {selectedWant.description && <p style={{ fontSize: '14px', color: '#4A6278', lineHeight: '1.65', marginBottom: '16px' }}>{selectedWant.description}</p>}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {selectedWant.budget && <span className="tag" style={{ fontSize: '13px' }}>💰 {selectedWant.budget}</span>}
                {selectedWant.location && <span className="tag" style={{ fontSize: '13px' }}>📍 {selectedWant.location}</span>}
                {selectedWant.category && <span className="tag" style={{ fontSize: '13px' }}>🏷 {selectedWant.category}</span>}
              </div>
              {user && user.id === selectedWant.user_id && (
                <>
                  <div className="divider" style={{ margin: '20px 0 16px' }} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedWant.status !== 'filled' && <button className="btn btn-green" onClick={() => markFilled(selectedWant.id)}>✓ Mark as filled</button>}
                    <button className="btn btn-red" onClick={() => { deleteWant(selectedWant.id); setPage('home') }}>Delete</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {user && selectedWant.status !== 'filled' ? (
            <div className="card fade-up" style={{ padding: '24px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#0F2030' }}>Make an offer</h3>
              <input placeholder="Your price — e.g. $250" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} style={{ marginBottom: '10px' }} />
              <textarea placeholder="Describe what you have — condition, photos, pickup…" value={offerMessage} onChange={e => setOfferMessage(e.target.value)} rows={3} style={{ marginBottom: '14px', resize: 'vertical' }} />
              <button className="btn btn-primary" onClick={submitOffer} disabled={!offerMessage || submittingOffer} style={{ width: '100%', padding: '13px', fontSize: '14px' }}>
                {submittingOffer ? 'Submitting…' : 'Submit offer'}
              </button>
            </div>
          ) : !user ? (
            <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '12px', padding: '16px', marginBottom: '14px', fontSize: '13px', color: '#B45309' }}>
              Log in to submit an offer on this listing.
            </div>
          ) : selectedWant.status === 'filled' ? (
            <div style={{ background: '#EDF2F7', borderRadius: '12px', padding: '16px', marginBottom: '14px', fontSize: '13px', color: '#8FA5B8', textAlign: 'center' }}>This listing has been filled</div>
          ) : null}

          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F2030' }}>Offers{offers.length > 0 ? ` (${offers.length})` : ''}</span>
          </div>
          {offers.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8FA5B8', fontSize: '13px' }}>No offers yet</div>}
          {offers.map((offer, i) => (
            <div key={offer.id} className={`card fade-up stagger-${Math.min(i + 1, 3)}`} style={{ padding: '16px 20px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#4A6278', fontWeight: '500' }}>{offer.seller_email}</span>
                {offer.price && <span style={{ fontSize: '16px', fontWeight: '700', color: '#0E7FA8' }}>{offer.price}</span>}
              </div>
              <p style={{ fontSize: '13px', color: '#4A6278', lineHeight: '1.55', marginBottom: '10px' }}>{offer.message}</p>
              <span style={{ fontSize: '11px', color: '#8FA5B8' }}>{new Date(offer.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
              <p style={{ fontSize: '15px', color: '#4A6278', marginBottom: '20px' }}>Log in to post a listing</p>
              <button className="btn btn-primary" onClick={() => setPage('login')} style={{ padding: '12px 28px', fontSize: '14px' }}>Log in</button>
            </div>
          ) : (
            <div className="card fade-up" style={{ padding: '28px' }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', marginBottom: '6px', color: '#0F2030', fontStyle: 'italic' }}>What are you after?</h2>
              <p style={{ fontSize: '13px', color: '#8FA5B8', marginBottom: '24px' }}>Post your listing and let sellers come to you.</p>
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
                <ImageUploader />
                <button className="btn btn-primary" onClick={postWant} disabled={!title || posting} style={{ padding: '14px', fontSize: '15px', marginTop: '6px' }}>
                  {uploadingImages ? 'Uploading images…' : posting ? 'Posting…' : 'Post listing'}
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
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', color: '#0F2030', fontStyle: 'italic' }}>My listings</h2>
            <span style={{ fontSize: '12px', color: '#8FA5B8' }}>{myWants.length} listing{myWants.length !== 1 ? 's' : ''}</span>
          </div>
          {myWants.length === 0 && (
            <div className="card fade-up" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: '15px', color: '#4A6278', marginBottom: '6px' }}>No listings yet</p>
              <p style={{ fontSize: '13px', color: '#8FA5B8', marginBottom: '24px' }}>Tap + to post your first listing</p>
              <button className="btn btn-primary" onClick={() => setPage('post')} style={{ padding: '10px 24px' }}>Post something</button>
            </div>
          )}
          {myWants.map((want, i) => (
            <div key={want.id} className={`card fade-up stagger-${Math.min(i + 1, 3)}`} style={{ padding: '18px 20px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '14px', color: '#0F2030', lineHeight: '1.4', textAlign: 'left' }}>{want.title}</h3>
                <span style={{ background: want.status === 'filled' ? '#EDF2F7' : offerCounts[want.id] ? '#EDFAF4' : '#EDF2F7', color: want.status === 'filled' ? '#8FA5B8' : offerCounts[want.id] ? '#0E9A6E' : '#8FA5B8', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0 }}>
                  {want.status === 'filled' ? 'Filled' : offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers'}
                </span>
              </div>
              {want.description && <p style={{ fontSize: '13px', color: '#4A6278', marginBottom: '10px', lineHeight: '1.5' }}>{want.description}</p>}
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {want.budget && <span className="tag">💰 {want.budget}</span>}
                {want.location && <span className="tag">📍 {want.location}</span>}
                {want.category && <span className="tag">{want.category}</span>}
              </div>
              {want.images && want.images.length > 0 && (
                <div className="img-gallery" style={{ marginBottom: '14px' }}>
                  {want.images.slice(0, 3).map((url, i) => <img key={i} src={url} className="img-thumb" alt="" />)}
                  {want.images.length > 3 && <div style={{ width: '80px', height: '80px', borderRadius: '10px', background: '#EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#8FA5B8', fontWeight: '600' }}>+{want.images.length - 3}</div>}
                </div>
              )}
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
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '24px', marginBottom: '6px', color: '#0F2030', fontStyle: 'italic' }}>
              {authMode === 'login' ? 'Welcome back' : 'Join Offr'}
            </h2>
            <p style={{ fontSize: '13px', color: '#8FA5B8', marginBottom: '24px' }}>
              {authMode === 'login' ? 'Log in to post and manage your listings' : 'Post what you want, let sellers come to you'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" />
              <input placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} type="password" />
            </div>
            {authError && <p style={{ fontSize: '13px', color: authError.includes('Check') ? '#0E9A6E' : '#DC2626', marginBottom: '14px', fontWeight: '500' }}>{authError}</p>}
            <button className="btn btn-primary" onClick={handleAuth} disabled={authLoading} style={{ width: '100%', padding: '14px', fontSize: '14px', marginBottom: '16px' }}>
              {authLoading ? 'Please wait…' : authMode === 'login' ? 'Log in' : 'Create account'}
            </button>
            <p style={{ fontSize: '13px', color: '#8FA5B8', textAlign: 'center' }}>
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError('') }} style={{ color: '#0E7FA8', fontWeight: '600', cursor: 'pointer' }}>
                {authMode === 'login' ? 'Sign up free' : 'Log in'}
              </span>
            </p>
          </div>
          <SearchFilters />
          <ListingsHeader />
          {loading && <p style={{ color: '#8FA5B8', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Loading…</p>}
          {!loading && filteredWants.length === 0 && <p style={{ color: '#8FA5B8', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No listings found</p>}
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
        <SearchFilters />
        <ListingsHeader />
        {loading && <p style={{ color: '#8FA5B8', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Loading…</p>}
        {!loading && filteredWants.length === 0 && <p style={{ color: '#8FA5B8', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No listings found</p>}
        {filteredWants.map((want, i) => <WantCard key={want.id} want={want} index={i} />)}
      </div>
      <BottomNav />
    </div>
  )
}

export default App