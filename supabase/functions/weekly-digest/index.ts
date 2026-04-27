import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentWants } = await supabase
    .from('wants')
    .select('id, title, description, budget, location, category, listing_type')
    .eq('status', 'active')
    .gte('created_at', since)

  if (!recentWants?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no new wants this week' }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    })
  }

  const { data: alerts } = await supabase.from('keyword_alerts').select('user_email, keyword')
  if (!alerts?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no keyword alerts configured' }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    })
  }

  // Group keywords by user
  const byUser: Record<string, string[]> = {}
  for (const a of alerts) {
    if (!byUser[a.user_email]) byUser[a.user_email] = []
    byUser[a.user_email].push(a.keyword.toLowerCase())
  }

  let sent = 0

  for (const [email, keywords] of Object.entries(byUser)) {
    const matches = recentWants.filter(w =>
      keywords.some(kw =>
        w.title?.toLowerCase().includes(kw) ||
        w.description?.toLowerCase().includes(kw) ||
        w.category?.toLowerCase().includes(kw)
      )
    )

    if (!matches.length) continue

    const wantCards = matches.slice(0, 8).map(w => `
      <div style="border:1.5px solid #D6E4EF;border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fff;">
        <div style="font-size:14px;font-weight:600;color:#0F2030;margin-bottom:6px;">${w.title}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          ${w.budget ? `<span style="font-size:12px;color:#0E7FA8;font-weight:600;">💰 ${w.budget}</span>` : ''}
          ${w.location ? `<span style="font-size:12px;color:#8FA5B8;">📍 ${w.location}</span>` : ''}
          ${w.category ? `<span style="font-size:12px;color:#4A6278;">${w.listing_type === 'service' ? '🔧' : '📦'} ${w.category}</span>` : ''}
        </div>
      </div>
    `).join('')

    const overflowNote = matches.length > 8
      ? `<p style="color:#8FA5B8;font-size:13px;text-align:center;margin-top:4px;">+${matches.length - 8} more on Offrit</p>`
      : ''

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#F0F4F8;padding:24px 16px;">
        <div style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(14,127,168,0.1);">
          <div style="background:linear-gradient(160deg,#0F2030 0%,#0E4A6A 65%,#0E7FA8 100%);padding:28px 24px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Offrit</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Your weekly wants digest</div>
          </div>
          <div style="padding:24px;">
            <p style="font-size:14px;color:#0F2030;margin:0 0 16px;">
              Hey — here are <strong style="color:#0E7FA8;">${matches.length} new want${matches.length !== 1 ? 's' : ''}</strong> matching your keyword alerts this week:
            </p>
            ${wantCards}
            ${overflowNote}
            <div style="text-align:center;margin-top:24px;">
              <a href="https://offrit.com" style="display:inline-block;background:linear-gradient(160deg,#0f8bb8,#0b6a8a);color:#fff;padding:13px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;box-shadow:0 4px 14px rgba(14,127,168,0.35);">
                Browse all wants →
              </a>
            </div>
          </div>
          <div style="border-top:1px solid #E4EFF7;padding:16px 24px;text-align:center;">
            <p style="font-size:11px;color:#B0C4D4;margin:0;">
              You're receiving this because you set keyword alerts on Offrit.<br/>
              <a href="https://offrit.com" style="color:#8FA5B8;">Manage your alerts</a>
            </p>
          </div>
        </div>
      </div>
    `

    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          'apikey': Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
        body: JSON.stringify({
          to: email,
          subject: `${matches.length} new want${matches.length !== 1 ? 's' : ''} match your alerts on Offrit`,
          html,
        }),
      })
      sent++
    } catch (_) { /* continue on send failure */ }
  }

  return new Response(JSON.stringify({ sent, total_users: Object.keys(byUser).length }), {
    headers: { ...CORS, "Content-Type": "application/json" }
  })
})
