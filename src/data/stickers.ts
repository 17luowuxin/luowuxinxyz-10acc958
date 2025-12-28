// 默认表情包数据 - 带关键词用于匹配对话内容
import wananImg from '@/assets/stickers/wanan.jpg';
import zhenjingImg from '@/assets/stickers/zhenjing.jpg';
import kaixinImg from '@/assets/stickers/kaixin.jpg';
import weiquImg from '@/assets/stickers/weiqu.jpg';
import jiayouImg from '@/assets/stickers/jiayou.jpg';
import meiwentiImg from '@/assets/stickers/meiwenti.jpg';
import kunleImg from '@/assets/stickers/kunle.jpg';
import moyuImg from '@/assets/stickers/moyu.jpg';
import ganfanImg from '@/assets/stickers/ganfan.jpg';
import qinqinImg from '@/assets/stickers/qinqin.jpg';

export interface Sticker {
  id: string;
  imageUrl: string;
  keywords: string[]; // 用于匹配的关键词
  text: string; // 表情包上的文字
}

export const defaultStickers: Sticker[] = [
  {
    id: 'wanan',
    imageUrl: wananImg,
    keywords: ['晚安', '睡觉', '睡了', '早点休息', '晚上好', '睡吧', '该睡了', '困了', '要睡', '做个好梦', '好梦'],
    text: '晚安'
  },
  {
    id: 'zhenjing',
    imageUrl: zhenjingImg,
    keywords: ['震惊', '惊讶', '吓到', '不敢相信', '天啊', '我的天', '真的假的', '什么', '啥', '居然', '竟然', '没想到'],
    text: '震惊'
  },
  {
    id: 'kaixin',
    imageUrl: kaixinImg,
    keywords: ['开心', '高兴', '太棒了', '好开心', '嘻嘻', '哈哈', '太好了', '开心到飞起', '起飞', '棒', '耶', '好耶'],
    text: '开心到起飞'
  },
  {
    id: 'weiqu',
    imageUrl: weiquImg,
    keywords: ['委屈', '难过', '伤心', '不开心', '呜呜', '哭', '哭了', '心疼', '可怜', '好惨', '嘤嘤'],
    text: '委屈巴巴'
  },
  {
    id: 'jiayou',
    imageUrl: jiayouImg,
    keywords: ['加油', '努力', '坚持', '你可以的', '相信你', '冲', '冲鸭', '奥利给', 'fighting', '打起精神', '别放弃'],
    text: '加油'
  },
  {
    id: 'meiwenti',
    imageUrl: meiwentiImg,
    keywords: ['没问题', '没事', '可以', '行', '好的', '好哒', 'OK', 'ok', '没关系', '当然', '完全可以', '放心'],
    text: '没问题'
  },
  {
    id: 'kunle',
    imageUrl: kunleImg,
    keywords: ['困了', '困', '好困', '想睡', '犯困', '瞌睡', '打哈欠', '眼皮打架', '睡意'],
    text: '困了'
  },
  {
    id: 'moyu',
    imageUrl: moyuImg,
    keywords: ['摸鱼', '偷懒', '划水', '不想工作', '不想动', '懒', '躺平', '咸鱼', '佛系', '发呆'],
    text: '摸鱼中'
  },
  {
    id: 'ganfan',
    imageUrl: ganfanImg,
    keywords: ['干饭', '吃饭', '饿了', '吃东西', '午饭', '晚饭', '好饿', '饭饭', '恰饭', '吃货', '美食'],
    text: '干饭啦'
  },
  {
    id: 'qinqin',
    imageUrl: qinqinImg,
    keywords: ['亲亲', '亲', '么么', '么么哒', '爱你', '喜欢你', '爱', '比心', '❤', '💕', '心心', 'mua'],
    text: '亲亲'
  }
];

// 根据对话内容匹配合适的表情包
export function matchSticker(
  content: string, 
  stickers: Sticker[], 
  userStickers: Sticker[] = []
): Sticker | null {
  const allStickers = [...userStickers, ...stickers]; // 用户表情包优先
  const lowerContent = content.toLowerCase();
  
  // 计算每个表情包的匹配分数，选择最佳匹配
  let bestMatch: { sticker: Sticker; score: number } | null = null;
  
  for (const sticker of allStickers) {
    let score = 0;
    for (const keyword of sticker.keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        // 关键词越长，匹配分数越高（更精确的匹配）
        score += keyword.length;
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { sticker, score };
    }
  }
  
  return bestMatch?.sticker || null;
}

// 用户显式要求发某个表情包时：优先按用户意图返回（找不到就随机来一个）
export function parseStickerRequest(
  userText: string,
  stickers: Sticker[],
  userStickers: Sticker[] = []
): Sticker | null {
  const text = (userText || '').trim();
  if (!text) return null;

  const normalized = text.replace(/\s+/g, ' ');

  const hasStickerWord = /(表情包|表情|贴纸|斗图)/.test(normalized);
  const hasRequestVerb = /(发|来)(个|张|点|一个|一张)/.test(normalized);
  const hasCue = hasStickerWord || hasRequestVerb;

  // "不要/别发表情包"之类的否定指令
  const isNegative = /(不要|别|不需要|别再)/.test(normalized) && hasCue;
  if (isNegative) return null;

  if (!hasCue) return null;

  const matched = matchSticker(normalized, stickers, userStickers);
  if (matched) return matched;

  // 没点名：给个友好的默认/随机
  const pool = [...userStickers, ...stickers];
  if (pool.length === 0) return null;

  const friendly = pool.find(s => s.id === 'kaixin') || pool.find(s => s.id === 'meiwenti');
  return friendly || pool[Math.floor(Math.random() * pool.length)];
}

// 判断是否应该发送表情包（根据对话情感和上下文）
export function shouldSendSticker(
  aiReply: string,
  recentMessages: { role: string; content: string }[] = []
): boolean {
  const reply = (aiReply || '').trim();

  // 1) 避免刷屏：最近 6 条里出现过表情包就先不发
  const recentStickerCount = recentMessages
    .slice(-6)
    .filter(m => m.content?.includes('[STICKER:')).length;

  if (recentStickerCount >= 1) return false;

  // 2) 太短不发（像"嗯""好"这类）
  if (reply.length < 4) return false;

  // 3) 严肃/敏感话题尽量不发
  const snippet = reply.slice(Math.max(0, reply.length - 240));
  const seriousKeywords = [
    '自杀', '去世', '不幸', '病', '抑郁', '焦虑', '崩溃', '绝望',
    '分手', '离婚', '伤害', '危险', '紧急',
    '对不起', '抱歉', '很遗憾'
  ];

  if (seriousKeywords.some(kw => snippet.includes(kw))) return false;

  // 4) 情感强度判断（更偏"收尾一句"是否有情绪）
  const strongEmotionalKeywords = [
    '晚安', '早安', '睡啦', '睡了',
    '太开心了', '好开心', '超开心',
    '好饿', '吃饭', '干饭',
    '好困', '困死了',
    '爱你', '喜欢你', '么么哒', '亲亲', '比心',
    '加油', '冲鸭', '你可以的',
    '真的吗', '天啊', '我的天', '太震惊了',
    '呜呜', '好委屈', '心疼'
  ];

  const weakEmotionalKeywords = [
    '开心', '高兴', '太棒了', '棒', '好耶', '哈哈', '嘻嘻',
    '没问题', '可以', '行',
    '困', '累', '懒', '摸鱼',
    '震惊', '惊讶', '什么', '居然', '竟然',
    '😊', '😢', '😴', '😍', '💕', '❤', '🥺', '😭', '😆'
  ];

  const hasStrongEmotion = strongEmotionalKeywords.some(kw => snippet.includes(kw));
  const hasWeakEmotion = weakEmotionalKeywords.some(kw => snippet.includes(kw));

  // 提高触发几率：强情绪55%，弱情绪30%
  let p = 0;
  if (hasStrongEmotion) p = 0.55;
  else if (hasWeakEmotion) p = 0.30;
  else return false;

  // 5) 回复越长越像"认真解释"，降低但不完全禁止
  if (reply.length > 400) p *= 0.7;
  if (reply.length > 800) p *= 0.5;

  return Math.random() < p;
}
