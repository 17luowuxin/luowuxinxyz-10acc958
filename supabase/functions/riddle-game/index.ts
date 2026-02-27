import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RIDDLES = [
  { question: "什么东西有头无脚？", answer: "硬币", hint: "常用于购物" },
  { question: "什么东西越洗越脏？", answer: "水", hint: "生命之源" },
  { question: "什么东西能穿过玻璃而不留痕迹？", answer: "光", hint: "太阳发出的" },
  { question: "什么东西有口不能说话，有头不能思考？", answer: "山", hint: "自然景观" },
  { question: "什么东西你走得越远离得越近？", answer: "年龄", hint: "与时间有关" },
  { question: "什么东西白天不出来，晚上才出来？", answer: "星星", hint: "在天空中闪烁" },
  { question: "什么东西有脚不能走？", answer: "桌子", hint: "常放在家里" },
  { question: "什么东西人人都爱，但看不见摸不着？", answer: "空气", hint: "呼吸需要它" },
  { question: "什么东西生来有皮不有毛，走起路来半截腰？", answer: "香蕉", hint: "黄色的水果" },
  { question: "两个小木人，站在水边。", answer: "沐", hint: "与洗澡有关的字" },
  { question: "一口咬掉牛尾巴。", answer: "告", hint: "汉字谜语" },
  { question: "十月十日。", answer: "萌", hint: "可爱的意思" },
  { question: "上下串通。", answer: "卡", hint: "会被东西卡住" },
  { question: "一只狗四个口。", answer: "器", hint: "容器的器" },
  { question: "什么路走不通？", answer: "死路", hint: "没有出路" },
  { question: "什么水不能喝？", answer: "薪水", hint: "工作赚的" },
  { question: "什么布剪不断？", answer: "瀑布", hint: "自然景观" },
  { question: "什么房子住不了人？", answer: "牢房", hint: "限制自由的地方" },
  { question: "什么花不能摸？", answer: "火花", hint: "摩擦产生的" },
  { question: "什么情话听了会害怕？", answer: "鬼话", hint: "不是真的" },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userAnswer, riddleIndex } = await req.json();
    console.log("Riddle game action:", action, "Index:", riddleIndex);

    if (action === 'get_riddle') {
      // Get a random riddle
      const index = Math.floor(Math.random() * RIDDLES.length);
      const riddle = RIDDLES[index];
      
      return new Response(JSON.stringify({
        success: true,
        riddle: {
          index,
          question: riddle.question,
          hint: riddle.hint,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'check_answer') {
      if (riddleIndex === undefined || !userAnswer) {
        return new Response(JSON.stringify({
          success: false,
          error: "缺少必要参数"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const riddle = RIDDLES[riddleIndex];
      const isCorrect = userAnswer.trim().toLowerCase() === riddle.answer.toLowerCase();
      
      return new Response(JSON.stringify({
        success: true,
        correct: isCorrect,
        answer: riddle.answer,
        message: isCorrect ? "🎉 恭喜你答对了！" : `❌ 答错了，正确答案是: ${riddle.answer}`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'get_hint') {
      if (riddleIndex === undefined) {
        return new Response(JSON.stringify({
          success: false,
          error: "缺少谜题索引"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const riddle = RIDDLES[riddleIndex];
      return new Response(JSON.stringify({
        success: true,
        hint: riddle.hint
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "未知操作" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Riddle game error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
