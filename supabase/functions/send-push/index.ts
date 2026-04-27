import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
}

// Minimal VAPID-signed web push using Web Crypto API (no npm deps needed)
async function sendWebPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) {
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!

  const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

  const audience = new URL(subscription.endpoint).origin
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600
  const header = b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims = b64(JSON.stringify({ aud: audience, exp, sub: 'mailto:support@offrit.com' }))
  const unsigned = `${header}.${claims}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    decode(vapidPrivate),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64(String.fromCharCode(...new Uint8Array(sig)))}`

  // Encrypt payload
  const clientPublicKey = await crypto.subtle.importKey('raw', decode(subscription.keys.p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])
  const serverPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const authSecret = decode(subscription.keys.auth)
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, serverKeys.privateKey, 256))

  const prk = await crypto.subtle.importKey('raw', await crypto.subtle.exportKey('raw', await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: new TextEncoder().encode('Content-Encoding: auth\0') },
    await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']),
    { name: 'HMAC', hash: 'SHA-256', length: 256 }, true, ['sign']
  )), 'HKDF', false, ['deriveKey', 'deriveBits'])

  const context = new Uint8Array([...new TextEncoder().encode('P-256\0'), 0, 65, ...decode(vapidPublic), 0, 65, ...serverPublicRaw])
  const cekInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: aesgcm\0'), ...context])
  const nonceInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: nonce\0'), ...context])

  const cek = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, prk, 128)
  const nonce = (await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prk, 96)).slice(0, 12)

  const encKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const payloadBytes = new TextEncoder().encode(payload)
  const padded = new Uint8Array(payloadBytes.length + 2)
  padded.set(payloadBytes, 2)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, encKey, padded)

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${vapidPublic}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${b64(String.fromCharCode(...salt))}`,
      'Crypto-Key': `dh=${b64(String.fromCharCode(...serverPublicRaw))};p256ecdsa=${vapidPublic}`,
      'TTL': '86400',
    },
    body: encrypted,
  })

  if (!res.ok && res.status !== 201) {
    const text = await res.text()
    throw new Error(`Push failed ${res.status}: ${text}`)
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { to_email, title, body, url, tag } = await req.json()
    if (!to_email || !title) return new Response("missing fields", { status: 400, headers: CORS })

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_email', to_email)

    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...CORS, "Content-Type": "application/json" } })

    const payload = JSON.stringify({ title, body, url: url || '/', tag: tag || 'offrit' })
    let sent = 0

    for (const row of subs) {
      try {
        await sendWebPush(row.subscription, payload)
        sent++
      } catch (e) {
        // Remove stale subscriptions (410 = subscription expired)
        if (e.message?.includes('410')) {
          await supabase.from('push_subscriptions').delete().eq('user_email', to_email)
        }
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" }
    })
  }
})
