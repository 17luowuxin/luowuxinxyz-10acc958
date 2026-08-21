import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.25.76'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.object({
  code: z.string().min(1).max(64),
  email: z.string().email().max(320),
  password: z.string().min(6).max(128),
})

type ClientEntry = {
  name: InviteSource
  client: any
}

type InviteSource = 'cloud' | 'external'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const getInviteClients = () => {
  const clients: ClientEntry[] = []

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

  return clients
}

const findInviteCode = async (code: string) => {
  const normalizedCode = code.toUpperCase().trim()

  for (const entry of getInviteClients()) {
    const { data, error } = await entry.client
      .from('invite_codes')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle()

    if (!error && data) {
      return { entry, inviteCode: data }
    }
  }

  return { entry: null, inviteCode: null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: '请求方式不支持' }, 405)
  }

  try {
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return json({ success: false, message: '邮箱、密码或邀请码格式不正确' }, 400)
    }

    const { code, email, password } = parsed.data
    const { entry, inviteCode } = await findInviteCode(code)

    if (!entry || !inviteCode || inviteCode.is_used) {
      return json({ success: false, message: '邀请码无效或已过期' }, 400)
    }

    const authAdmin = entry.client
    const authSource: InviteSource = entry.name === 'external' ? 'external' : 'cloud'

    if (!authAdmin) {
      return json({ success: false, message: '注册服务未配置，请联系管理员' }, 500)
    }

    console.log(`[register-with-invite] registering user in ${entry.name}`)

    const { data: created, error: createError } = await authAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { invite_registration: true },
      user_metadata: { invite_code: code.toUpperCase().trim() },
    })

    if (createError) {
      const message = createError.message || ''
      if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
        return json({ success: false, message: '该邮箱已注册' }, 409)
      }

      console.error('[register-with-invite] create user failed:', createError)
      if (message.toLowerCase().includes('password')) {
        return json({ success: false, message: '密码过于简单，请使用至少8位并包含字母和数字' }, 400)
      }
      return json({ success: false, message: '账号创建失败，请联系管理员' }, 500)
    }

    const { data: consumedInvite, error: consumeError } = await entry.client
      .from('invite_codes')
      .update({
        is_used: true,
        used_by_email: email,
        used_at: new Date().toISOString(),
      })
      .eq('id', inviteCode.id)
      .eq('is_used', false)
      .select('id')
      .maybeSingle()

    // 新数据库触发器会在创建账号时原子消费邀请码；兼容尚未升级的环境，
    // 如果这里仍是未使用状态，则由函数完成消费。
    let inviteConsumedByThisUser = Boolean(consumedInvite)
    if (!inviteConsumedByThisUser && !consumeError) {
      const { data: alreadyConsumed } = await entry.client
        .from('invite_codes')
        .select('id, used_by_email')
        .eq('id', inviteCode.id)
        .eq('is_used', true)
        .maybeSingle()

      inviteConsumedByThisUser = alreadyConsumed?.used_by_email?.toLowerCase() === email.toLowerCase()
    }

    if (consumeError || !inviteConsumedByThisUser) {
      console.error('[register-with-invite] consume invite failed:', consumeError)
      if (created.user?.id) {
        await authAdmin.auth.admin.deleteUser(created.user.id).catch((error: unknown) => {
          console.error('[register-with-invite] rollback user failed:', error)
        })
      }
      return json({ success: false, message: '邀请码已被使用，请换一个邀请码重试' }, 409)
    }

    const { data: sessionData, error: signInError } = await authAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !sessionData.session) {
      console.error('[register-with-invite] sign in after create failed:', signInError)
      return json({ success: true, message: '注册成功，请返回登录', session: null, authSource })
    }

    return json({ success: true, message: '注册成功', session: sessionData.session, authSource })
  } catch (error) {
    console.error('[register-with-invite] unexpected error:', error)
    return json({ success: false, message: '服务错误，请稍后重试' }, 500)
  }
})
