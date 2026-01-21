import React from 'react';

interface ParsedSegment {
  type: 'narration' | 'dialogue' | 'action' | 'thought';
  content: string;
}

/**
 * 指令前缀说明：
 * - /旁白 或 [旁白] - 标记为旁白叙述
 * - /对话 或 [对话] - 标记为角色对话
 * - /动作 或 [动作] - 标记为动作描写
 * - /想法 或 [想法] - 标记为心理活动
 * 
 * 自动检测规则（不使用指令时）：
 * - 旁白：普通叙述文字
 * - 对话：「」、『』、""、"" 等引号包裹的内容
 * - 动作：*内容* 包裹的描写
 * - 心理：（）、() 括号包裹的内心独白
 */

// 指令映射表
const COMMAND_MAP: Record<string, ParsedSegment['type']> = {
  '旁白': 'narration',
  '对话': 'dialogue', 
  '动作': 'action',
  '想法': 'thought',
  '心理': 'thought',
  '内心': 'thought',
};

// 匹配指令的正则：/指令 内容 或 [指令] 内容
const COMMAND_REGEX = /(?:\/|【|［|\[)(旁白|对话|动作|想法|心理|内心)(?:】|］|\]|：|:|\s)\s*(.+?)(?=(?:\/|【|［|\[)(?:旁白|对话|动作|想法|心理|内心)|$)/gs;

/**
 * 解析带指令的文本
 */
function parseWithCommands(text: string): ParsedSegment[] | null {
  const segments: ParsedSegment[] = [];
  let hasCommands = false;
  
  // 检查是否包含指令
  const commandPattern = /(?:\/|【|［|\[)(旁白|对话|动作|想法|心理|内心)(?:】|］|\]|：|:|\s)/;
  if (!commandPattern.test(text)) {
    return null; // 没有指令，返回null让自动检测接管
  }
  
  // 重置正则的lastIndex
  COMMAND_REGEX.lastIndex = 0;
  
  let lastIndex = 0;
  let match;
  
  while ((match = COMMAND_REGEX.exec(text)) !== null) {
    hasCommands = true;
    
    // 添加指令前的普通文本（如果有）
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index).trim();
      if (beforeText) {
        segments.push({ type: 'narration', content: beforeText });
      }
    }
    
    const command = match[1];
    const content = match[2].trim();
    const type = COMMAND_MAP[command] || 'narration';
    
    if (content) {
      segments.push({ type, content });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      segments.push({ type: 'narration', content: remaining });
    }
  }
  
  return hasCommands ? segments : null;
}

/**
 * 解析小说模式的文本，区分不同类型的内容
 * 优先使用指令解析，如果没有指令则使用自动检测
 */
export function parseNovelModeText(text: string): ParsedSegment[] {
  if (!text) return [];
  
  // 首先尝试使用指令解析
  const commandSegments = parseWithCommands(text);
  if (commandSegments && commandSegments.length > 0) {
    return commandSegments;
  }
  
  // 没有指令，使用自动检测
  const segments: ParsedSegment[] = [];
  
  // 正则表达式匹配不同类型的内容
  // 注意：顺序很重要，优先匹配更长的模式
  const patterns = [
    // 动作描写：*内容*（支持多行和嵌套括号）
    { regex: /\*([^*]+)\*/g, type: 'action' as const },
    // 心理活动：（内容）或 (内容)
    { regex: /（([^）]+)）/g, type: 'thought' as const },
    { regex: /\(([^)]+)\)/g, type: 'thought' as const },
    // 对话：「内容」
    { regex: /「([^」]+)」/g, type: 'dialogue' as const },
    // 对话：『内容』
    { regex: /『([^』]+)』/g, type: 'dialogue' as const },
    // 对话：中文双引号 "内容"
    { regex: /"([^"]+)"/g, type: 'dialogue' as const },
    // 对话：英文双引号 "内容"
    { regex: /"([^"]+)"/g, type: 'dialogue' as const },
    // 对话：单引号 '内容' 或 '内容'
    { regex: /'([^']+)'/g, type: 'dialogue' as const },
    { regex: /'([^']+)'/g, type: 'dialogue' as const },
  ];
  
  // 收集所有匹配
  interface Match {
    start: number;
    end: number;
    content: string;
    type: ParsedSegment['type'];
    fullMatch: string;
  }
  
  const allMatches: Match[] = [];
  
  for (const { regex, type } of patterns) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(text)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type,
        fullMatch: match[0]
      });
    }
  }
  
  // 按位置排序
  allMatches.sort((a, b) => a.start - b.start);
  
  // 去除重叠的匹配（保留先匹配到的）
  const filteredMatches: Match[] = [];
  let lastEnd = 0;
  for (const match of allMatches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  }
  
  // 构建分段
  let currentIndex = 0;
  for (const match of filteredMatches) {
    // 添加匹配前的普通文本（旁白）
    if (match.start > currentIndex) {
      const narration = text.slice(currentIndex, match.start).trim();
      if (narration) {
        segments.push({ type: 'narration', content: narration });
      }
    }
    
    // 添加匹配的内容
    segments.push({ type: match.type, content: match.content });
    currentIndex = match.end;
  }
  
  // 添加剩余的文本（旁白）
  if (currentIndex < text.length) {
    const narration = text.slice(currentIndex).trim();
    if (narration) {
      segments.push({ type: 'narration', content: narration });
    }
  }
  
  // 如果没有匹配到任何特殊格式，整个文本作为旁白
  if (segments.length === 0 && text.trim()) {
    segments.push({ type: 'narration', content: text.trim() });
  }
  
  return segments;
}

interface NovelModeTextProps {
  content: string;
  baseColor?: string;
  dialogueColor?: string;
  narrationColor?: string;
  actionColor?: string;
  thoughtColor?: string;
  fontSize?: number;
}

/**
 * 小说模式文本渲染组件
 * 将不同类型的内容用不同颜色显示
 */
export const NovelModeText: React.FC<NovelModeTextProps> = ({
  content,
  baseColor = '#333',
  dialogueColor = '#e91e63',    // 对话：粉红色
  narrationColor = '#666',       // 旁白：灰色
  actionColor = '#9c27b0',       // 动作：紫色
  thoughtColor = '#607d8b',      // 心理：蓝灰色
  fontSize = 16,
}) => {
  const segments = parseNovelModeText(content);
  
  if (segments.length === 0) {
    return <span style={{ color: baseColor }}>{content}</span>;
  }
  
  const getColor = (type: ParsedSegment['type']) => {
    switch (type) {
      case 'dialogue': return dialogueColor;
      case 'narration': return narrationColor;
      case 'action': return actionColor;
      case 'thought': return thoughtColor;
      default: return baseColor;
    }
  };
  
  const getStyle = (type: ParsedSegment['type']): React.CSSProperties => {
    const base: React.CSSProperties = {
      color: getColor(type),
      fontSize: `${fontSize}px`,
    };
    
    switch (type) {
      case 'action':
        return { ...base, fontStyle: 'italic' };
      case 'thought':
        return { ...base, fontStyle: 'italic', opacity: 0.9 };
      case 'dialogue':
        return { ...base, fontWeight: 500 };
      default:
        return base;
    }
  };
  
  const getWrapper = (type: ParsedSegment['type'], content: string) => {
    switch (type) {
      case 'action':
        return `*${content}*`;
      case 'thought':
        return `（${content}）`;
      case 'dialogue':
        return `"${content}"`;
      default:
        return content;
    }
  };
  
  return (
    <span>
      {segments.map((segment, index) => (
        <span key={index} style={getStyle(segment.type)}>
          {getWrapper(segment.type, segment.content)}
        </span>
      ))}
    </span>
  );
};

export default NovelModeText;
