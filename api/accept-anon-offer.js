const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY
const SITE_URL = 'https://offrit.com'

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { seller_name, seller_contact, buyer_email, buyer_username, want_title, want_id } = req.body ?? {}

  if (!seller_contact || !buyer_email || !want_title) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const name = seller_name || 'The seller'
  const contact = seller_contact
  const listingUrl = `${SITE_URL}/?listing=${want_id}`
  const isEmail = contact.includes('@')

  // Email buyer with seller's contact details
  const buyerHtml = `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#16110A">
  <p style="font-size:15px">Hi,</p>
  <p style="font-size:15px">You accepted an offer on <strong>${esc(want_title)}</strong>. Here are the seller's contact details:</p>
  <div style="background:#EDFAF4;border:1.5px solid #A7EDD4;border-radius:10px;padding:16px 20px;margin:16px 0">
    <p style="font-size:16px;font-weight:700;margin:0 0 6px">${esc(name)}</p>
    <p style="font-size:14px;margin:0">
      ${isEmail
        ? `<a href="mailto:${esc(contact)}" style="color:#1E5470">${esc(contact)}</a>`
        : `<a href="tel:${esc(contact)}" style="color:#1E5470">${esc(contact)}</a>`
      }
    </p>
  </div>
  <p style="font-size:13px;color:#7A6F5C">Reach out to sort out the details directly.</p>
  <p style="font-size:13px"><a href="${listingUrl}" style="color:#1E5470">View listing →</a></p>
  <hr style="border:none;border-top:1px solid #EDE6D6;margin:20px 0">
  <p style="font-size:11px;color:#7A6F5C">Offrit — New Zealand's buyer-first marketplace</p>
</div>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Offrit <noreply@offrit.com>',
      to: buyer_email,
      subject: `Contact details for your accepted offer — ${want_title}`,
      html: buyerHtml
    })
  }).catch(() => {})

  // Email seller with buyer's contact (only if seller gave an email)
  if (isEmail) {
    const sellerHtml = `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#16110A">
  <p style="font-size:15px">Hi ${esc(name)},</p>
  <p style="font-size:15px">Great news — the buyer accepted your offer on <strong>${esc(want_title)}</strong>.</p>
  <p style="font-size:15px">Here are their contact details:</p>
  <div style="background:#EDFAF4;border:1.5px solid #A7EDD4;border-radius:10px;padding:16px 20px;margin:16px 0">
    <p style="font-size:16px;font-weight:700;margin:0 0 6px">@${esc(buyer_username || buyer_email.split('@')[0])}</p>
    <p style="font-size:14px;margin:0"><a href="mailto:${esc(buyer_email)}" style="color:#1E5470">${esc(buyer_email)}</a></p>
  </div>
  <p style="font-size:13px;color:#7A6F5C">Reach out to sort out the details directly.</p>
  <p style="font-size:13px"><a href="${listingUrl}" style="color:#1E5470">View listing →</a></p>
  <hr style="border:none;border-top:1px solid #EDE6D6;margin:20px 0">
  <p style="font-size:11px;color:#7A6F5C">Offrit — New Zealand's buyer-first marketplace · <a href="https://offrit.com" style="color:#7A6F5C">offrit.com</a></p>
</div>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Offrit <noreply@offrit.com>',
        to: contact,
        subject: `Offer accepted — ${want_title}`,
        html: sellerHtml
      })
    }).catch(() => {})
  }

  res.status(200).json({ ok: true })
}
