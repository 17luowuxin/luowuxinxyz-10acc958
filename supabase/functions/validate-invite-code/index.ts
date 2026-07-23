import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { code, email } = await req.json()

    if (!code || !email) {
      return new Response(
        JSON.stringify({ valid: false, message: '邀请码和邮箱不能为空' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const normalizedCode = code.toUpperCase().trim()

    // 构建两个客户端：Cloud + External（管理员可能在任一实例创建邀请码）
    const clients: { name: string; client: ReturnType<typeof createClient> }[] = []

    const cloudUrl = Deno.env.get('SUPABASE_URL')
    const cloudKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (cloudUrl && cloudKey) {
      clients.push({ name: 'cloud', client: createClient(cloudUrl, cloudKey) })
    }

    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')
    if (externalUrl && externalKey) {
      clients.push({ name: 'external', client: createClient(externalUrl, externalKey) })
    }

    // 在两个库中查找邀请码
    let foundClient: typeof clients[number] | null = null
    let inviteCode: any = null

    for (const c of clients) {
      try {
        const { data, error } = await c.client
          .from('invite_codes')
          .select('*')
          .eq('code', normalizedCode)
          .maybeSingle()
        if (!error && data) {
          foundClient = c
          inviteCode = data
          break
        }
      } catch (e) {
        console.error(`Error querying ${c.name}:`, e)
      }
    }

    if (!foundClient || !inviteCode) {
      console.log('Invite code validation failed: code not found in any database')
      return new Response(
        JSON.stringify({ valid: false, message: '邀请码无效或已过期' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (inviteCode.is_used) {
      console.log(`Invite code validation failed: code already used (${foundClient.name})`)
      return new Response(
        JSON.stringify({ valid: false, message: '邀请码无效或已过期' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: updateError } = await foundClient.client
      .from('invite_codes')
      .update({
        is_used: true,
        used_by_email: email,
        used_at: new Date().toISOString()
      })
      .eq('id', inviteCode.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(
        JSON.stringify({ valid: false, message: '验证失败，请重试' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Invite code validated successfully from ${foundClient.name}`)
    return new Response(
      JSON.stringify({ valid: true, message: '邀请码验证成功' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ valid: false, message: '服务错误，请稍后重试' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
