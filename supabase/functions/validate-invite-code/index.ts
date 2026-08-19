const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 旧的“先校验、注册后再消费”流程存在并发复用和恶意消耗邀请码的风险。
  // 新客户端统一使用 register-with-invite 在服务端完成注册和消费。
  return json({
    valid: false,
    message: '注册流程已升级，请刷新页面后重新注册',
  }, 410)
})
