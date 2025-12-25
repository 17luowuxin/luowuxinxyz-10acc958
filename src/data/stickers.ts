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
  
  for (const sticker of allStickers) {
    for (const keyword of sticker.keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return sticker;
      }
    }
  }
  
  return null;
}

// 判断是否应该发送表情包（根据对话情感和上下文）
export function shouldSendSticker(
  aiReply: string,
  recentMessages: { role: string; content: string }[] = []
): boolean {
  // 如果最近3条已经发过表情包，暂时不发
  const recentStickerCount = recentMessages
    .slice(-3)
    .filter(m => m.content?.includes('[STICKER:')).length;
  
  if (recentStickerCount >= 1) {
    return false;
  }
  
  // 根据AI回复内容判断情感强度
  const emotionalKeywords = [
    '晚安', '睡觉', '震惊', '惊讶', '开心', '高兴', '委屈', '难过',
    '加油', '努力', '没问题', '可以', '困', '睡意', '摸鱼', '划水',
    '吃饭', '饿', '亲亲', '爱你', '喜欢', '太棒了', '真的假的',
    '😊', '😢', '😴', '😍', '💕', '❤', '🥺', '😭', '😆'
  ];
  
  const hasEmotionalContent = emotionalKeywords.some(kw => 
    aiReply.includes(kw)
  );
  
  // 60%概率发送表情包（如果匹配到关键词）
  return hasEmotionalContent && Math.random() < 0.6;
}
