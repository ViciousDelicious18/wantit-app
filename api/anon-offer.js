const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY
const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY
const SITE_URL = 'https://offrit.com'

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { want_id, want_title, buyer_email, seller_name, seller_contact, price, message } = req.body ?? {}

  if (!seller_name?.trim() || !seller_contact?.trim() || !message?.trim() || !buyer_email || !want_id) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const name = seller_name.trim()
  const contact = seller_contact.trim()
  const msg = message.trim()
  const listingUrl = `${SITE_URL}/want/${want_id}`

  const emailHtml = `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#16110A">
  <p style="font-size:15px">Hi,</p>
  <p style="font-size:15px">You have a new offer on your Offrit listing:</p>
  <div style="background:#F6F4EE;border-radius:10px;padding:16px 20px;margin:16px 0">
    <p style="font-size:16px;font-weight:700;margin:0 0 4px">${esc(want_title)}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:6px 0;font-size:13px;color:#7A6F5C;width:90px">From</td><td style="padding:6px 0;font-size:14px;font-weight:600">${esc(name)}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#7A6F5C">Contact</td><td style="padding:6px 0;font-size:14px"><a href="${contact.includes('@') ? `mailto:${esc(contact)}` : `tel:${esc(contact)}`}" style="color:#1E5470">${esc(contact)}</a></td></tr>
    ${price ? `<tr><td style="padding:6px 0;font-size:13px;color:#7A6F5C">Offered</td><td style="padding:6px 0;font-size:14px;font-weight:600">${esc(price)}</td></tr>` : ''}
  </table>
  <div style="background:#fff;border:1px solid #EDE6D6;border-radius:10px;padding:14px 16px;margin-bottom:20px">
    <p style="font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap">${esc(msg)}</p>
  </div>
  <p style="font-size:13px;color:#7A6F5C">Reach them directly at: <strong style="color:#16110A">${esc(contact)}</strong></p>
  <p style="font-size:13px"><a href="${listingUrl}" style="color:#1E5470">View listing on Offrit →</a></p>
  <hr style="border:none;border-top:1px solid #EDE6D6;margin:20px 0">
  <p style="font-size:11px;color:#7A6F5C">Offrit — New Zealand's buyer-first marketplace</p>
</div>`

  // Send email to buyer
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Offrit <noreply@offrit.com>',
      to: buyer_email,
      subject: `New offer on: ${want_title}`,
      html: emailHtml
    })
  }).catch(() => {})

  // Store in DB using anon key (requires anon_offer_insert RLS policy)
  await fetch(`${SUPABASE_URL}/rest/v1/offers`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      want_id,
      seller_name: name,
      seller_contact: contact,
      seller_email: contact.includes('@') ? contact : null,
      price: price || null,
      message: msg
    })
  }).catch(() => {})

  res.status(200).json({ ok: true })
}
