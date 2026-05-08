# Offrit — Project Context for Claude

## What this app is
Marketplace SPA where buyers post "wants" and sellers make offers. React + Vite + Supabase.
Single source file: `src/App.jsx` (~2150 lines). All components and state live inside `App()`.

---

## Critical rules — never break these

### 1. Supabase JS client hangs on data mutations
The Supabase JS client `.insert()` / `.update()` / `.delete()` silently hangs and never resolves on these tables: `wants`, `offers`, `profiles`, `keyword_alerts`.

**Always use direct `fetch()` to the REST API instead:**
```js
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const token = sessionRef.current?.access_token

const res = await fetch(`${supabaseUrl}/rest/v1/TABLE_NAME`, {
  method: 'POST', // or PATCH, DELETE
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation', // or 'return=minimal'
  },
  body: JSON.stringify({ ...fields })
})
```

The Supabase JS client is fine for: `auth`, `realtime`, `storage`, and SELECT queries on most tables.

### 2. Components inside App() must be called as functions
```js
// CORRECT — inlines the JSX, no remount
{EditModal()}
{CounterModal()}
{SearchFilters()}

// WRONG — React sees a new component type every render, unmounts/remounts, loses input focus
<EditModal />
<CounterModal />
```
This applies to every const component defined inside `App()`.

---

## Design system

### Colour tokens (light / dark)
| Token | Light | Dark |
|---|---|---|
| Background | `#F6F4EE` (warm paper) | `#111009` (warm charcoal) |
| Card bg | `#FFFFFF` | `#241E16` |
| Card border | `#EDE6D6` | `#3A2F22` |
| Primary text | `#16110A` | `#F0EBE0` |
| Sub text | `#3D3528` | `#B0A898` |
| Muted text | `#7A6F5C` | `#8A7E6E` |
| Accent (teal) | `#1E5470` | `#7FA8B8` |
| Service (clay) | `#A0522D` | `#E2C9AD` |
| Green | `#3F6F4E` | `#8FB89A` |
| Red | `#9B3232` | `#C99A9A` |
| Amber | `#A86A1A` | `#C9A87A` |

The `C` object in App() exposes these as `C.bg`, `C.card`, `C.cardBorder`, `C.text`, `C.textSub`, `C.textMuted`, `C.accentText` — always use `C.*` for dark-mode-aware colours in inline styles.

### CSS utility classes (injected via `<style>{styles}</style>`)
- `.btn` — base button, `.btn-primary`, `.btn-green`, `.btn-red`, `.btn-amber`
- `.card` — warm paper card with border/shadow, `.card-hover` adds hover effect
- `.badge`, `.badge-want`, `.badge-service`, `.badge-filled`, `.badge-accepted`
- `.filter-chip`, `.chips-row` — horizontal scrollable filter pills
- `.filter-toolbar-chip` — mono eyebrow chip (BUDGET/SORT/LOCATION)
- `.skeleton` — shimmer loading placeholder
- `.modal-overlay` + `.modal` — bottom-sheet modal pattern
- `.toast` — floating notification (fixed, bottom centre)
- `.reveal`, `.delay-1/2/3` — GSAP ScrollTrigger entrance animations
- `.msg-bubble`, `.msg-mine`, `.msg-theirs` — chat bubbles
- `.header-desktop-nav` — desktop nav (641px+, hidden on mobile)
- `.bottom-nav-bar` — bottom nav (hidden on desktop via media query)
- `.no-photo-placeholder` — mono "NO PHOTO" swatch for imageless cards
- `.post-pill` — square ink nav button for Post

### Typography
- Headings/editorial: `Fraunces` (upright for h1/h2, italic for hero)
- Body/UI: `Inter` (weights 400–700)
- Eyebrows/metadata/mono: `JetBrains Mono`

### Spacing / sizing conventions
- Cards: `padding: '18px 20px'` standard, `'24px 28px'` for forms
- Page inner: `max-width: 640px`, `padding: '20px 16px'`
- Border radius: `10px` inputs, `12–16px` cards, `20px` pills/badges

---

## State patterns

`sessionRef` is a `useRef` pointing to the current Supabase session. Read it inside async functions as `sessionRef.current?.access_token` — never put the token in state.

Dark mode: `dark` boolean state. Always check `dark` when choosing colours outside of `C.*`.

Navigation is page-based (`page` string state), not React Router. Use `setPage('pageName')` to navigate. Back history is a `navStack` array.

---

## Data fetching conventions

- `fetchWants(offset, append)` — paginated, 20 at a time. `append=true` for load-more.
- `fetchOfferCounts()` — fetches all offer want_ids in one call, builds a map.
- `fetchAllProfiles(emailsArray)` — batch fetch usernames, merges into `profiles` state map.
- Optimistic updates: update local state immediately, fire async request in background.

---

## Features already built
Browse/search/filter, post listings with images, edit listings, delete/mark-filled, make/accept/decline/counter/withdraw offers, messaging with realtime, ratings, wishlist/hearts, keyword alerts + notifications bell, near-me geolocation, profile pages with bio/deals/ratings, dark mode, pull-to-refresh, skeleton loading, pagination, image carousel on cards, password reset, report listings, share listings, view counts, recent searches.

## DB tables
`wants`, `offers`, `profiles`, `ratings`, `messages`, `wishlists`, `keyword_alerts`, `notifications`, `reports`

## NZ cities
Auckland, Wellington, Christchurch, Hamilton, Tauranga, Dunedin, Napier, Palmerston North, Rotorua, Nelson, New Plymouth, Other

## Required DB columns (run in Supabase SQL editor if missing)
```sql
ALTER TABLE wants ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
ALTER TABLE wants ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE wants ADD COLUMN IF NOT EXISTS negotiable boolean DEFAULT false;
```
