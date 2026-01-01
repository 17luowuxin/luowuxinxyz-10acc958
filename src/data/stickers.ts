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
import cuteBoyImg from '@/assets/stickers/cute-boy.png';

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
    keywords: [
      '晚安', '睡觉', '睡了', '早点休息', '晚上好', '睡吧', '该睡了', '困了', '要睡', 
      '做个好梦', '好梦', '安安', '晚安安', '睡啦', '去睡', '休息', '明天见', '拜拜', 
      '梦里见', '夜深了', '早睡', '睡个好觉', 'goodnight', '晚上见', '今晚', '夜晚'
    ],
    text: '晚安'
  },
  {
    id: 'zhenjing',
    imageUrl: zhenjingImg,
    keywords: [
      '震惊', '惊讶', '吓到', '不敢相信', '天啊', '我的天', '真的假的', '什么', '啥', 
      '居然', '竟然', '没想到', '卧槽', '我靠', '天呐', '我滴妈', '妈呀', '哇塞', 
      '不是吧', '不会吧', '我去', '服了', '离谱', '绝了', '牛逼', 'nb', 'yyds',
      '太强了', '厉害', '无语', '惊呆', '呆住', 'omg', '我傻了', '惊了', '蚌埠住了'
    ],
    text: '震惊'
  },
  {
    id: 'kaixin',
    imageUrl: kaixinImg,
    keywords: [
      '开心', '高兴', '太棒了', '好开心', '嘻嘻', '哈哈', '太好了', '开心到飞起', '起飞', 
      '棒', '耶', '好耶', '快乐', '幸福', '兴奋', '激动', '赞', '完美', '成功', 
      '太开心', '超开心', '好嗨', '嗨皮', 'happy', '爽', '舒服', '真棒', '太赞了',
      '绝绝子', '笑死', '太可了', '可太行了', '巨开心', '乐', '乐死', '笑嘻嘻'
    ],
    text: '开心到起飞'
  },
  {
    id: 'weiqu',
    imageUrl: weiquImg,
    keywords: [
      '委屈', '难过', '伤心', '不开心', '呜呜', '哭', '哭了', '心疼', '可怜', '好惨', 
      '嘤嘤', '悲伤', '难受', '郁闷', '失落', '沮丧', '痛苦', '眼泪', '泪目', '哭唧唧',
      '好难过', '心碎', '💔', '呜', '555', '5555', '好委屈', '受伤', '难', '太难了',
      '心酸', '心塞', '不容易', '辛苦', '累死', '好累', '烦', '烦死', '崩溃'
    ],
    text: '委屈巴巴'
  },
  {
    id: 'jiayou',
    imageUrl: jiayouImg,
    keywords: [
      '加油', '努力', '坚持', '你可以的', '相信你', '冲', '冲鸭', '奥利给', 'fighting', 
      '打起精神', '别放弃', '鼓励', '支持', '挺你', '看好你', '冲冲冲', '干巴爹', 
      'gogogo', 'go', '一起加油', '加油加油', '必胜', '胜利', '赢', '必赢', '冲啊',
      '冲就完了', '干就完了', '别怕', '勇敢', '奥力给', '加油鸭', '拼', '拼了'
    ],
    text: '加油'
  },
  {
    id: 'meiwenti',
    imageUrl: meiwentiImg,
    keywords: [
      '没问题', '没事', '可以', '行', '好的', '好哒', 'OK', 'ok', '没关系', '当然', 
      '完全可以', '放心', 'okok', '好滴', '好嘞', '没毛病', '妥', '妥了', '稳', '稳了',
      '搞定', '没啥', '无所谓', '都行', '随便', '都可以', '好啊', '行啊', '没得问题',
      '木问题', '莫问题', '阔以', '可', '嗯嗯', '嗯', 'yes', '是的', '对', '对对对'
    ],
    text: '没问题'
  },
  {
    id: 'kunle',
    imageUrl: kunleImg,
    keywords: [
      '困了', '困', '好困', '想睡', '犯困', '瞌睡', '打哈欠', '眼皮打架', '睡意', 
      '困死', '困得不行', '困惨了', '要睡着了', '眯一会', '打盹', '昏昏欲睡', '没精神',
      '精神不好', '迷糊', '迷迷糊糊', '睡不醒', '起不来', '困成狗', '困飞了', '哈欠'
    ],
    text: '困了'
  },
  {
    id: 'moyu',
    imageUrl: moyuImg,
    keywords: [
      '摸鱼', '偷懒', '划水', '不想工作', '不想动', '懒', '躺平', '咸鱼', '佛系', '发呆',
      '摸', '划', '偷偷摸鱼', '上班摸鱼', '工作摸鱼', '懒得动', '不想干', '躺着', 
      '葛优躺', '瘫', '瘫着', '啥也不想干', '不想努力', '休息一下', '歇会', '放松'
    ],
    text: '摸鱼中'
  },
  {
    id: 'ganfan',
    imageUrl: ganfanImg,
    keywords: [
      '干饭', '吃饭', '饿了', '吃东西', '午饭', '晚饭', '好饿', '饭饭', '恰饭', '吃货', 
      '美食', '早饭', '早餐', '午餐', '晚餐', '宵夜', '干饭人', '吃吃吃', '开吃', '开饭',
      '好吃', '太好吃', '馋', '馋了', '想吃', '吃点', '吃啥', '吃什么', '外卖', '点餐',
      '肚子饿', '饥饿', '干饭啦', '恰饭人', '美味', '香', '真香', '太香了'
    ],
    text: '干饭啦'
  },
  {
    id: 'qinqin',
    imageUrl: qinqinImg,
    keywords: [
      '亲亲', '亲', '么么', '么么哒', '爱你', '喜欢你', '爱', '比心', '❤', '💕', '心心', 
      'mua', '宝贝', '宝宝', '亲爱的', '老婆', '老公', '抱抱', '想你', '思念', '想念',
      '爱死你', '超爱', '最爱', '我的心', '小可爱', '甜蜜', '撒娇', '蜜糖', '心动',
      '💗', '💖', '💘', '💝', '😘', '😍', '🥰', '爱意', '表白', '告白', '在一起'
    ],
    text: '亲亲'
  },
  {
    id: 'cute-boy',
    imageUrl: cuteBoyImg,
    keywords: [
      '可爱', '萌', '萌萌哒', '好萌', '超萌', '小可爱', '软萌', '卡哇伊', 'kawaii',
      '呆萌', '软软', '乖', '乖乖', '小宝贝', '小天使', '棉花糖', '甜', '甜甜',
      '小奶音', '奶', '撒娇', '嘤', '嘤嘤', '超可爱', '太可爱', '萌死了'
    ],
    text: '萌萌哒'
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
