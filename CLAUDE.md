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
| Background | `#E8EFF5` | `#0B1829` |
| Card bg | `#FFFFFF` | `#112240` |
| Card border | `#D6E4EF` | `#1E3A5F` |
| Primary text | `#0F2030` | `#CCD6F6` |
| Sub text | `#4A6278` | `#8892B0` |
| Muted text | `#8FA5B8` | `#4A6080` |
| Accent (blue) | `#0E7FA8` | `#0E9FCC` |
| Accent hover | `#0A6588` | — |
| Green | `#0E9A6E` | `#34D399` |
| Red | `#DC2626` | `#F87171` |
| Amber | `#D97706` | `#FCD34D` |

The `C` object in App() exposes these as `C.bg`, `C.card`, `C.cardBorder`, `C.text`, `C.textSub`, `C.textMuted`, `C.accentText` — always use `C.*` for dark-mode-aware colours in inline styles.

### CSS utility classes (injected via `<style>{styles}</style>`)
- `.btn` — base button, `.btn-primary`, `.btn-green`, `.btn-red`, `.btn-amber`
- `.card` — white card with border/shadow, `.card-hover` adds hover effect
- `.badge`, `.badge-want`, `.badge-filled`, `.badge-accepted`
- `.tag` — small inline label with icon
- `.filter-chip`, `.chips-row` — horizontal scrollable filter pills
- `.skeleton` — shimmer loading placeholder
- `.modal-overlay` + `.modal` — bottom-sheet modal pattern
- `.toast` — floating notification (fixed, bottom centre)
- `.fade-up`, `.stagger-1/2/3` — entrance animations
- `.msg-bubble`, `.msg-mine`, `.msg-theirs` — chat bubbles

### Typography
- Body: `DM Sans` (weights 300–700)
- Headings/logo: `DM Serif Display` (italic)

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
