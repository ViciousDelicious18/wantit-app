# Offrit — Next Session Briefing
**Last updated: 11 May 2026 — read this fully before doing anything.**

---

## What Offrit Is

A **buyer-intent network** — not a listings marketplace. Buyers post requests, sellers come to them. NZ-only. Live at **offrit.com**.

Positioning: "A calmer, request-first marketplace. Post what you need. Let sellers come to you."
Stack: React + Vite SPA (`src/App.jsx` — single file, ~5200 lines), Supabase (auth + DB + realtime + storage + edge functions), Vercel (hosting + serverless API routes in `api/`).

---

## Critical Code Rules (from CLAUDE.md — never break these)

### 1. Supabase JS client hangs on mutations
`.insert()` / `.update()` / `.delete()` silently hang forever on: `wants`, `offers`, `profiles`, `keyword_alerts`, `reports`, `blocks`, `banned_users`, `support_messages`.

**Always use `fetch()` to the REST API for mutations:**
```js
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const token = sessionRef.current?.access_token
await fetch(`${supabaseUrl}/rest/v1/TABLE`, {
  method: 'POST', // PATCH, DELETE
  headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ ...fields })
})
```
Supabase JS client is fine for: `auth`, `realtime`, `storage`, SELECT queries.

### 2. Components inside App() must be called as functions
```js
{EditModal()}   // CORRECT — no remount, keeps input focus
<EditModal />   // WRONG — unmounts/remounts on every render
```

### 3. Dev server
`npm run dev` → localhost:5173 (or 5174 if port taken). Never test against the dist build — CSP issues.

---

## What's Been Built (Complete Feature List as of 11 May 2026)

### Core marketplace
- Browse/search/filter wants (categories, locations, budget, sort)
- Post listings with images, title, description, budget, location, category, condition, negotiable, listing type (item/service), expiry
- Edit listings, delete, mark as filled
- View counts, image carousel, listing sharing
- Pagination (load more), skeleton loading, pull-to-refresh

### Offers
- Logged-in offer flow: price, message, expiry timer, counter-offer, accept, decline, withdraw
- **Anonymous offer flow**: name + contact (email or phone) + message → Supabase Edge Function emails buyer. Contact details hidden until buyer accepts. Accept reveals contact details to both parties via email.
- Offer filtering: blocked users' offers hidden from listing owner

### Auth
- Login / signup with username
- **Forgot password**: enter email → click "Forgot password?" → email sent with reset link to offrit.com
- **Reset password page**: `page === 'reset-password'` — catches Supabase `PASSWORD_RECOVERY` auth event, shows confirm-password form, calls `supabase.auth.updateUser({ password })`
- Ban enforcement: banned users are signed out on `SIGNED_IN` event

### Messaging
- Real-time offer-based chat (Supabase realtime)
- Inbox with unread count
- Message bubbles, typing detection

### Profile
- Public profile pages with bio, ratings, deal history, listings
- Block user / unblock user
- Report user (with reason selector + optional "also block" checkbox)

### Safety & Moderation
- **Content filter** (`checkContent()`): slur list + leet-speak normalization (`@→a`, `0→o`, `3→e`, `$→s`, `1→i`). Extra restrictions for anon users: 600 char limit, no links, no phone numbers, no email addresses in messages.
- **Block system**: `blocks` table. Blocked users' offers and listings are hidden. Blocks are optimistic.
- **Report system**: `reports` table with `report_type` ('listing' or 'user'), `reported_user_email`, `reporter_email`, reason, details.

### Contact Support
- "Support" link in desktop nav opens `ContactAdminModal`
- **Privacy notice** shown first: explicitly states admin cannot read private conversations, cannot use chat logs as evidence, needs @username or listing reference
- User must tick acknowledgement checkbox before sending
- 500 character limit with live counter
- Sends to `support_messages` table as logged-in user email

### Admin Panel (`page === 'admin'`, visible only to `dupreezdylan2@gmail.com`)
- **Reports tab**: all user reports with reason, reported email, reporter email, date. Ban or Dismiss actions.
- **Support tab**: all contact-admin messages. Resolve, Ban user, Delete actions. Unresolved count shown on tab.
- **Bans tab**: all banned users with ban reason, date. Unban action.
- **User search**: search profiles by @username or email from any tab. Shows ban status, Ban/Unban inline.

### Other
- Wishlists / hearts
- Keyword alerts + push notifications + notification bell
- Ratings / star reviews (post-deal)
- Referral system, listing bump
- Dark mode (persisted in localStorage)
- Geolocation "near me" filter
- Profile pages with bio/deals/ratings/listings tabs
- Settings: username change, phone verification (OTP), IRD number
- Social sharing with OG tags (`api/want/[id].js` — bot detection returns OG HTML to crawlers, 302 to real browsers)
- Terms of Service and Privacy Policy pages

---

## Database Tables (Supabase)

| Table | Purpose |
|---|---|
| `wants` | Listings |
| `offers` | Offers on listings |
| `profiles` | User profiles (username, bio, phone, ird_number, referral_code) |
| `ratings` | Star ratings after deals |
| `messages` | Chat messages |
| `wishlists` | Saved/hearted listings |
| `keyword_alerts` | Seller keyword notification subscriptions |
| `notifications` | In-app notification records |
| `reports` | Listing and user reports (`report_type`: 'listing' or 'user') |
| `blocks` | Blocked user pairs (`blocker_email`, `blocked_email`) |
| `banned_users` | Banned accounts (`email`, `reason`, `banned_at`) |
| `support_messages` | Contact-admin messages (`sender_email`, `sender_username`, `message`, `resolved`) |
| `price_history` | Accepted price signals (not yet shown in UI) |

---

## API Routes (Vercel, `api/` directory)

| File | Purpose |
|---|---|
| `api/want/[id].js` | Bot detection: OG HTML for crawlers, 302 to SPA for real browsers |
| `api/anon-offer.js` | Anon offer submission — sends email via Supabase Edge Function, inserts offer to DB |
| `api/accept-anon-offer.js` | Buyer accepts anon offer — emails contact details to both parties |

---

## Key State & Patterns

- `sessionRef` — `useRef` pointing to current Supabase session. Read as `sessionRef.current?.access_token` inside async functions.
- `page` string state — navigation is page-based (no React Router). `navigate(page)` pushes to navStack.
- `deepLinkRef` + `sessionStorage('pendingListing')` — persists listing ID through login for email deep links.
- `C` object — dark-mode-aware colour tokens (`C.bg`, `C.card`, `C.cardBorder`, `C.text`, `C.textSub`, `C.textMuted`, `C.accentText`).
- `ADMIN_EMAIL = 'dupreezdylan2@gmail.com'` — hardcoded constant, gates admin panel and all admin functions.
- `blockedUsers` — `Set` of blocked email addresses, filters offer lists and listings.

---

## What's Next (Priority Order)

### Immediate priorities
1. **Listing reports in admin panel** — the Reports tab currently only shows `report_type=user` reports. Should also show `report_type=listing` reports with a link to the listing and a "Remove listing" action (DELETE from wants table).

2. **Admin listing removal** — `banUser()` bans the account but doesn't remove their listings. Should delete `wants` where `user_email = banned_email` on ban.

3. **Email the admin when a support message arrives** — currently messages just go to DB silently. Wire up a Resend or Supabase Edge Function call in `api/` to notify `dupreezdylan2@gmail.com` when a new support message is submitted.

4. **Test password reset end-to-end on prod** — verify the Supabase redirect URL whitelist includes `https://offrit.com` (Auth → URL Configuration → Redirect URLs in Supabase dashboard).

### Medium priority
5. **Design refresh** — the landing page and listing cards could be more visually polished. GSAP scroll animations are partially set up (`.reveal`, `.delay-1/2/3` classes exist). Expand the ScrollTrigger entrance animations.

6. **Empty state improvements** — when search/filter returns 0 results, show featured recent requests + "Be the first to post in [location]" prompt.

7. **Seller response rate** — show average response time on profiles once there's enough data.

8. **Monetisation** — discussed but not started. Options: featured/bumped listings (already has `bumped_at` column), pro seller accounts, take percentage on accepted offers.

### Later
- Category hub pages for SEO (`/category/electronics-auckland` etc.)
- Next.js / ISR migration once the core loop is proven
- Stripe integration for monetisation

---

## Design System Quick Reference

**Fonts**: Fraunces (headings/editorial), Inter (body/UI), JetBrains Mono (eyebrows/metadata)
**Colours**: warm paper (`#F6F4EE` bg, `#16110A` text, `#1E5470` accent teal, `#A0522D` service clay)
**Classes**: `.btn`, `.btn-primary`, `.btn-green`, `.btn-red`, `.btn-amber`, `.card`, `.card-hover`, `.badge`, `.modal-overlay`, `.modal`, `.toast`, `.skeleton`
**Cards**: `padding: '18px 20px'` standard, border-radius `12-16px`
**Page inner**: `max-width: 640px`, `padding: '20px 16px'`

Do NOT change the warm paper identity. It's distinctive and working.

---

## Repo & Deploy

- GitHub: `ViciousDelicious18/wantit-app` (main branch → auto-deploys to Vercel)
- Live: `https://offrit.com`
- Local: `npm run dev` (port 5173/5174)
- Vercel CLI not installed — deploy via git push
