import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { token, tg_id } = await req.json()

  if (!token || !tg_id) {
    return new Response(JSON.stringify({ error: 'Missing token or tg_id' }), { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: row, error: queryError } = await supabaseAdmin
    .from('auth_tokens')
    .select('*')
    .eq('token', token)
    .eq('user_id', tg_id)
    .limit(1)
    .maybeSingle()

  if (queryError || !row) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 })
  }

  if (row.used) {
    return new Response(JSON.stringify({ error: 'Token already used' }), { status: 401 })
  }

  if (new Date(row.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401 })
  }

  await supabaseAdmin
    .from('auth_tokens')
    .update({ used: true })
    .eq('token', token)

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: row.email,
  })

  if (linkError || !linkData?.properties?.action_link) {
    return new Response(JSON.stringify({ error: 'Failed to generate session' }), { status: 500 })
  }

  const url = new URL(linkData.properties.action_link)
  const tokenHash = url.searchParams.get('token')

  return new Response(
    JSON.stringify({ email: row.email, token_hash: tokenHash, type: 'magiclink' }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
