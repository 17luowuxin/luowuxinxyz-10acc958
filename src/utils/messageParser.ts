/**
 * 消息解析和清理工具
 * 用于处理AI返回的各种格式问题，确保显示给用户的内容干净无格式字符
 */

/**
 * 深度清理消息内容，移除所有可能的格式字符和残留符号
 * @param content 原始内容
 * @returns 清理后的干净内容
 */
export function sanitizeMessageContent(content: string): string {
  if (!content) return '';
  
  return content
    // 移除开头和结尾的空白
    .trim()
    // 移除开头的各种格式字符（竖线、破折号、星号等）
    .replace(/^[\s|*\-_#>]+/g, '')
    // 移除结尾的格式字符
    .replace(/[\s|*\-_#]+$/g, '')
    // 替换所有连续的竖线为空格（无论多少个）
    .replace(/\|{1,}/g, ' ')
    // 移除可能的 markdown 代码块标记
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/\|/g, ' '))
    // 清理多余的空格
    .replace(/\s{2,}/g, ' ')
    // 移除行首的格式字符
    .replace(/\n[\s|*\-]+/g, '\n')
    // 最终再次trim
    .trim();
}

/**
 * 解析线上模式的多条消息
 * @param content 原始AI返回内容
 * @param maxMessages 最大消息数量
 * @returns 消息数组
 */
export function parseOnlineMessages(content: string, maxMessages: number = 5): string[] {
  if (!content) return [];
  
  // 首先进行基础清理
  let cleanedContent = content
    .trim()
    // 移除开头和结尾的竖线和空白
    .replace(/^[\s|]+/g, '')
    .replace(/[\s|]+$/g, '');
  
  // 检测是否包含有效的 ||| 分隔符
  // 有效的分隔符应该是：前后都有实际文字内容
  const hasValidSeparator = /[^\s|]\s*\|\|\|\s*[^\s|]/.test(cleanedContent);
  
  if (!hasValidSeparator) {
    // 没有有效分隔符，清理所有竖线后作为单条消息返回
    return [sanitizeMessageContent(cleanedContent)].filter(s => s.length > 0);
  }
  
  // 预处理：统一各种分隔符格式
  cleanedContent = cleanedContent
    // 处理边框格式 "| 消息 ||| 消息 |"
    .replace(/\|\s*\|\|\|\s*\|/g, '|||')
    // 统一2个以上竖线为3个
    .replace(/\|{2,}/g, '|||')
    // 处理换行+分隔符的情况
    .replace(/\n\s*\|\|\|\s*\n?/g, '|||')
    .replace(/\|\|\|\s*\n/g, '|||')
    // 移除单独的边框竖线
    .replace(/^\|\s*/g, '')
    .replace(/\s*\|$/g, '');
  
  // 按 ||| 分割
  const parts = cleanedContent.split('|||');
  
  // 清理每个部分
  const messages = parts
    .map(part => {
      // 对每个部分进行深度清理
      return part
        .trim()
        // 移除该部分开头和结尾的竖线
        .replace(/^\|+\s*/g, '')
        .replace(/\s*\|+$/g, '')
        // 替换内部的单个或双竖线为空格（但不影响 ||| ）
        .replace(/\|{1,2}(?!\|)/g, ' ')
        // 清理多余空格
        .replace(/\s{2,}/g, ' ')
        .trim();
    })
    // 过滤空消息和只有符号的消息
    .filter(s => s.length > 0 && !/^[\s|*\-_#]+$/.test(s));
  
  // 如果解析后消息太少，可能是分割失败，返回清理后的完整内容
  if (messages.length === 0) {
    return [sanitizeMessageContent(content)].filter(s => s.length > 0);
  }
  
  // 限制最大条数
  return messages.slice(0, maxMessages);
}

/**
 * 解析小说模式的消息（单条，但需要深度清理）
 * @param content 原始AI返回内容
 * @returns 清理后的单条消息
 */
export function parseNovelMessage(content: string): string {
  return sanitizeMessageContent(content);
}

/**
 * 验证消息内容是否有效（不只是格式字符）
 * @param content 消息内容
 * @returns 是否有效
 */
export function isValidMessageContent(content: string): boolean {
  if (!content) return false;
  
  // 清理后检查是否还有实际内容
  const cleaned = content
    .replace(/[\s|*\-_#>\n\r]+/g, '')
    .trim();
  
  return cleaned.length > 0;
}

/**
 * 检测内容是否看起来像是被截断的（未完成的响应）
 * @param content 消息内容
 * @returns 是否可能被截断
 */
export function looksLikeTruncated(content: string): boolean {
  if (!content) return true;
  
  const trimmed = content.trim();
  
  // 以下情况可能表示响应被截断：
  // 1. 内容太短（少于10个有效字符）
  // 2. 以分隔符结尾
  // 3. 以不完整的格式标记结尾
  // 4. 以未闭合的括号/引号结尾
  
  if (trimmed.length < 10) return true;
  if (/\|\|?\s*$/.test(trimmed)) return true;
  if (/\[\s*$/.test(trimmed)) return true;
  if (/「\s*$/.test(trimmed)) return true;
  if (/"\s*$/.test(trimmed) && (trimmed.match(/"/g) || []).length % 2 !== 0) return true;
  
  return false;
}
