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

    // 使用 SERVICE_ROLE_KEY 绕过 RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 查找邀请码
    const { data: inviteCode, error: findError } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .single()

    // 使用统一的错误消息防止邀请码枚举攻击
    // Return generic error to prevent invite code enumeration attacks
    if (findError || !inviteCode) {
      console.log('Invite code validation failed: code not found')
      return new Response(
        JSON.stringify({ valid: false, message: '邀请码无效或已过期' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 检查是否已使用 - 使用相同的通用错误消息
    if (inviteCode.is_used) {
      console.log('Invite code validation failed: code already used')
      return new Response(
        JSON.stringify({ valid: false, message: '邀请码无效或已过期' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 标记邀请码为已使用
    const { error: updateError } = await supabase
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

    return new Response(
      JSON.stringify({ valid: true, message: '邀请码验证成功' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ valid: false, message: '服务错误，请稍后重试' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
