// 敏感词检测工具 - 检测可能触发API内容过滤的词汇

interface SensitiveWord {
  word: string;
  category: 'sexual' | 'violence' | 'illegal' | 'hate';
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

// 常见可能触发API过滤的敏感词及其替代建议
// 注：这些词在角色扮演语境下可能是合理的，但某些API会过滤
const sensitiveWords: SensitiveWord[] = [
  // 性相关 - 高风险
  { word: '做爱', category: 'sexual', severity: 'high', suggestion: '亲密行为/深度互动' },
  { word: '性爱', category: 'sexual', severity: 'high', suggestion: '亲密关系/身体接触' },
  { word: '性交', category: 'sexual', severity: 'high', suggestion: '亲密行为' },
  { word: '口交', category: 'sexual', severity: 'high', suggestion: '特殊服务/亲密接触' },
  { word: '肛交', category: 'sexual', severity: 'high', suggestion: '特殊接触' },
  { word: '强奸', category: 'sexual', severity: 'high', suggestion: '强迫行为（建议避免此类设定）' },
  { word: '轮奸', category: 'sexual', severity: 'high', suggestion: '（建议避免此类设定）' },
  { word: '乱伦', category: 'sexual', severity: 'high', suggestion: '禁忌关系' },
  { word: '淫荡', category: 'sexual', severity: 'high', suggestion: '大胆/开放/热情' },
  { word: '淫乱', category: 'sexual', severity: 'high', suggestion: '开放态度' },
  { word: '淫秽', category: 'sexual', severity: 'high', suggestion: '成人向' },
  { word: '色情', category: 'sexual', severity: 'high', suggestion: '成人向/亲密' },
  { word: '黄色', category: 'sexual', severity: 'medium', suggestion: '成人向（如指内容）' },
  { word: 'R18', category: 'sexual', severity: 'medium', suggestion: '成人向/限制级' },
  { word: 'NSFW', category: 'sexual', severity: 'medium', suggestion: '成人向内容' },
  { word: '18禁', category: 'sexual', severity: 'medium', suggestion: '成人向' },
  
  // 性相关 - 中风险
  { word: '裸体', category: 'sexual', severity: 'medium', suggestion: '赤裸/无衣物' },
  { word: '全裸', category: 'sexual', severity: 'medium', suggestion: '未着装' },
  { word: '勃起', category: 'sexual', severity: 'medium', suggestion: '兴奋状态' },
  { word: '射精', category: 'sexual', severity: 'high', suggestion: '高潮/释放' },
  { word: '潮吹', category: 'sexual', severity: 'high', suggestion: '极致体验' },
  { word: '高潮', category: 'sexual', severity: 'medium', suggestion: '极致感受/顶点' },
  { word: '自慰', category: 'sexual', severity: 'medium', suggestion: '自我安慰/独处时光' },
  { word: '手淫', category: 'sexual', severity: 'medium', suggestion: '自我探索' },
  { word: '阴茎', category: 'sexual', severity: 'medium', suggestion: '私密部位/那里' },
  { word: '阴道', category: 'sexual', severity: 'medium', suggestion: '私密部位/那里' },
  { word: '阴蒂', category: 'sexual', severity: 'medium', suggestion: '敏感部位' },
  { word: '乳房', category: 'sexual', severity: 'low', suggestion: '胸部/酥胸' },
  { word: '乳头', category: 'sexual', severity: 'medium', suggestion: '敏感点/顶端' },
  { word: '阴唇', category: 'sexual', severity: 'medium', suggestion: '私密处' },
  { word: '睾丸', category: 'sexual', severity: 'medium', suggestion: '私密部位' },
  { word: '肉棒', category: 'sexual', severity: 'high', suggestion: '那根/那里' },
  { word: '小穴', category: 'sexual', severity: 'high', suggestion: '那里/私处' },
  { word: '骚穴', category: 'sexual', severity: 'high', suggestion: '那里' },
  { word: '淫穴', category: 'sexual', severity: 'high', suggestion: '私处' },
  { word: '嫩穴', category: 'sexual', severity: 'high', suggestion: '那里' },
  { word: '菊穴', category: 'sexual', severity: 'high', suggestion: '后方' },
  { word: '肉穴', category: 'sexual', severity: 'high', suggestion: '那处' },
  { word: '淫水', category: 'sexual', severity: 'high', suggestion: '润滑/湿润' },
  { word: '精液', category: 'sexual', severity: 'medium', suggestion: '体液' },
  { word: '内射', category: 'sexual', severity: 'high', suggestion: '内部释放' },
  { word: '颜射', category: 'sexual', severity: 'high', suggestion: '（建议隐晦表达）' },
  { word: '中出', category: 'sexual', severity: 'high', suggestion: '内部' },
  { word: '调教', category: 'sexual', severity: 'medium', suggestion: '教导/训练' },
  { word: 'SM', category: 'sexual', severity: 'medium', suggestion: '特殊爱好/BDSM暗示' },
  { word: '捆绑', category: 'sexual', severity: 'low', suggestion: '束缚play' },
  { word: '奴隶', category: 'sexual', severity: 'medium', suggestion: '服从者/忠犬' },
  { word: '主人', category: 'sexual', severity: 'low', suggestion: '主导者（一般OK）' },
  { word: '母狗', category: 'sexual', severity: 'high', suggestion: '宠物/忠犬' },
  { word: '荡妇', category: 'sexual', severity: 'high', suggestion: '大胆女性/开放' },
  { word: '婊子', category: 'sexual', severity: 'high', suggestion: '（建议避免）' },
  { word: '妓女', category: 'sexual', severity: 'high', suggestion: '特殊职业/夜晚工作者' },
  { word: '嫖娼', category: 'sexual', severity: 'high', suggestion: '（建议避免）' },
  { word: '卖淫', category: 'sexual', severity: 'high', suggestion: '（建议避免）' },
  
  // 未成年相关 - 极高风险（应完全避免）
  { word: '未成年', category: 'sexual', severity: 'high', suggestion: '【警告】涉及未成年的成人内容绝对禁止' },
  { word: '小学生', category: 'sexual', severity: 'high', suggestion: '【警告】请确保角色设定为成年人' },
  { word: '中学生', category: 'sexual', severity: 'high', suggestion: '【警告】请确保角色设定为成年人' },
  { word: '高中生', category: 'sexual', severity: 'medium', suggestion: '建议明确设定为成年（18+）' },
  { word: '幼女', category: 'sexual', severity: 'high', suggestion: '【禁止】此类内容绝对不允许' },
  { word: '萝莉', category: 'sexual', severity: 'medium', suggestion: '如涉及成人内容，请明确为成年角色' },
  { word: '正太', category: 'sexual', severity: 'medium', suggestion: '如涉及成人内容，请明确为成年角色' },
  { word: '童颜', category: 'sexual', severity: 'low', suggestion: '娇小/年轻外表（确保角色成年）' },
  
  // 暴力相关
  { word: '杀人', category: 'violence', severity: 'medium', suggestion: '击败/消灭（如指战斗）' },
  { word: '虐待', category: 'violence', severity: 'high', suggestion: '严厉对待' },
  { word: '折磨', category: 'violence', severity: 'medium', suggestion: '考验/磨练' },
  { word: '肢解', category: 'violence', severity: 'high', suggestion: '（建议避免详细描写）' },
  { word: '分尸', category: 'violence', severity: 'high', suggestion: '（建议避免）' },
  { word: '血腥', category: 'violence', severity: 'medium', suggestion: '激烈/残酷' },
  { word: '残忍', category: 'violence', severity: 'low', suggestion: '冷酷/无情' },
  
  // 违法相关
  { word: '毒品', category: 'illegal', severity: 'high', suggestion: '违禁物品' },
  { word: '吸毒', category: 'illegal', severity: 'high', suggestion: '（建议避免）' },
  { word: '贩毒', category: 'illegal', severity: 'high', suggestion: '（建议避免）' },
];

export interface DetectionResult {
  found: boolean;
  words: Array<{
    word: string;
    category: string;
    severity: string;
    suggestion: string;
    position: number;
  }>;
  summary: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * 检测文本中的敏感词
 */
export function detectSensitiveWords(text: string): DetectionResult {
  if (!text) {
    return { found: false, words: [], summary: { high: 0, medium: 0, low: 0 } };
  }
  
  const foundWords: DetectionResult['words'] = [];
  const lowerText = text.toLowerCase();
  
  for (const sw of sensitiveWords) {
    const lowerWord = sw.word.toLowerCase();
    let position = lowerText.indexOf(lowerWord);
    
    while (position !== -1) {
      // 避免重复添加同一位置的词
      if (!foundWords.some(w => w.word === sw.word && w.position === position)) {
        foundWords.push({
          word: sw.word,
          category: sw.category,
          severity: sw.severity,
          suggestion: sw.suggestion,
          position,
        });
      }
      position = lowerText.indexOf(lowerWord, position + 1);
    }
  }
  
  // 按位置排序
  foundWords.sort((a, b) => a.position - b.position);
  
  // 去重（同一个词只显示一次）
  const uniqueWords = foundWords.filter((word, index, self) =>
    index === self.findIndex(w => w.word === word.word)
  );
  
  const summary = {
    high: uniqueWords.filter(w => w.severity === 'high').length,
    medium: uniqueWords.filter(w => w.severity === 'medium').length,
    low: uniqueWords.filter(w => w.severity === 'low').length,
  };
  
  return {
    found: uniqueWords.length > 0,
    words: uniqueWords,
    summary,
  };
}

/**
 * 一键替换文本中的敏感词为建议的隐晦表达
 */
export function replaceSensitiveWords(text: string): { 
  newText: string; 
  replacedCount: number;
  replacements: Array<{ original: string; replacement: string }>;
} {
  if (!text) {
    return { newText: text, replacedCount: 0, replacements: [] };
  }
  
  let newText = text;
  const replacements: Array<{ original: string; replacement: string }> = [];
  
  // 按词长度从长到短排序，避免短词先被替换导致长词匹配失败
  const sortedWords = [...sensitiveWords].sort((a, b) => b.word.length - a.word.length);
  
  for (const sw of sortedWords) {
    // 跳过建议为"建议避免"类型的词（这些词没有好的替代）
    if (sw.suggestion.includes('建议避免') || sw.suggestion.includes('禁止') || sw.suggestion.includes('警告')) {
      continue;
    }
    
    // 提取建议中的第一个替代词（去掉括号内的补充说明）
    let replacement = sw.suggestion
      .split('/')[0]  // 取第一个选项
      .split('（')[0]  // 去掉括号说明
      .split('(')[0]   // 去掉英文括号说明
      .trim();
    
    // 如果替代词为空或太长，跳过
    if (!replacement || replacement.length > 10) {
      continue;
    }
    
    // 全局替换（不区分大小写）
    const regex = new RegExp(escapeRegExp(sw.word), 'gi');
    const matches = newText.match(regex);
    
    if (matches && matches.length > 0) {
      newText = newText.replace(regex, replacement);
      replacements.push({ original: sw.word, replacement });
    }
  }
  
  return {
    newText,
    replacedCount: replacements.length,
    replacements,
  };
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 获取风险等级描述
 */
export function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'high': return '高风险';
    case 'medium': return '中风险';
    case 'low': return '低风险';
    default: return '未知';
  }
}

/**
 * 获取风险等级颜色
 */
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high': return 'text-red-500';
    case 'medium': return 'text-orange-500';
    case 'low': return 'text-yellow-500';
    default: return 'text-gray-500';
  }
}

/**
 * 获取分类描述
 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'sexual': return '性相关';
    case 'violence': return '暴力';
    case 'illegal': return '违法';
    case 'hate': return '仇恨';
    default: return '其他';
  }
}
