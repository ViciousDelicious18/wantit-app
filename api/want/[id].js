const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY
const SITE_URL = 'https://offrit.com'

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default async function handler(req, res) {
  const { id } = req.query

  if (!id || !/^[0-9a-f-]+$/i.test(id)) {
    return res.redirect(302, '/')
  }

  let want = null
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/wants?id=eq.${id}&select=id,title,description,budget,location,category,listing_type,status`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    const data = await r.json()
    want = data?.[0] ?? null
  } catch {
    // fall through to redirect
  }

  if (!want) {
    return res.redirect(302, '/')
  }

  const title = want.title
    ? want.title.charAt(0).toUpperCase() + want.title.slice(1)
    : 'Listing'

  const ogTitle = `Looking for: ${title} | Offrit`

  const parts = [
    want.location,
    want.category,
    want.budget ? `Budget: ${want.budget}` : null,
    want.listing_type === 'service' ? 'Service request' : 'Item wanted',
  ].filter(Boolean)

  const ogDescription = parts.join(' · ') +
    ' — Posted on Offrit, New Zealand\'s buyer-first marketplace.'

  const canonical = `${SITE_URL}/want/${id}`
  // Redirect real browsers to SPA using the existing ?listing= deep link mechanism
  const spaUrl = `${SITE_URL}/?listing=${id}`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(ogTitle)}</title>
  <link rel="canonical" href="${esc(canonical)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(ogDescription)}" />
  <meta property="og:site_name" content="Offrit" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDescription)}" />

  <!-- Redirect real browsers to the SPA (crawlers ignore meta refresh) -->
  <meta http-equiv="refresh" content="0;url=${esc(spaUrl)}" />
</head>
<body>
  <h1>${esc(title)}</h1>
  <p>${esc(ogDescription)}</p>
  <p><a href="${esc(spaUrl)}">View on Offrit →</a></p>
</body>
</html>`)
}
