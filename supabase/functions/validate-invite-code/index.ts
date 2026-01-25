import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    if (findError || !inviteCode) {
      return new Response(
        JSON.stringify({ valid: false, message: '邀请码不存在' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 检查是否已使用
    if (inviteCode.is_used) {
      return new Response(
        JSON.stringify({ valid: false, message: '该邀请码已被使用' }),
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
