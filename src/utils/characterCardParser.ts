/**
 * SillyTavern / 酒馆角色卡解析器
 * 支持格式：
 * - PNG (带嵌入的tEXt/iTXt块的角色数据)
 * - JSON (V1/V2 格式)
 * - JSONL (多角色文件)
 */

export interface CharacterCardData {
  name: string;
  description: string;  // persona
  personality?: string;
  scenario?: string;
  first_mes?: string;   // opening_line
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  tags?: string[];
  creator?: string;
  character_version?: string;
  avatar?: string; // base64 或 URL
}

export interface ParseResult {
  success: boolean;
  data?: CharacterCardData;
  error?: string;
}

/**
 * 从PNG文件中提取嵌入的角色数据
 */
async function extractFromPNG(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
          resolve(null);
          return;
        }
        
        let offset = 8; // Skip PNG signature
        
        while (offset < bytes.length) {
          // Read chunk length (4 bytes, big endian)
          const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
          offset += 4;
          
          // Read chunk type (4 bytes)
          const type = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
          offset += 4;
          
          if (type === 'tEXt' || type === 'iTXt') {
            // Read chunk data
            const data = bytes.slice(offset, offset + length);
            
            // Find null separator
            let nullIndex = 0;
            for (let i = 0; i < data.length; i++) {
              if (data[i] === 0) {
                nullIndex = i;
                break;
              }
            }
            
            const keyword = new TextDecoder().decode(data.slice(0, nullIndex));
            
            // Check for character data keywords
            if (keyword === 'chara' || keyword === 'ccv3') {
              let textData: string;
              
              if (type === 'iTXt') {
                // iTXt: keyword + null + compression flag + compression method + language tag + null + translated keyword + null + text
                let textStart = nullIndex + 1;
                // Skip compression flag, compression method, language tag, and translated keyword
                for (let i = 0; i < 3; i++) {
                  while (textStart < data.length && data[textStart] !== 0) textStart++;
                  textStart++;
                }
                textData = new TextDecoder().decode(data.slice(textStart));
              } else {
                // tEXt: keyword + null + text
                textData = new TextDecoder().decode(data.slice(nullIndex + 1));
              }
              
              // Decode base64
              try {
                const decoded = atob(textData);
                resolve(decoded);
                return;
              } catch {
                // Not base64, try as plain text
                resolve(textData);
                return;
              }
            }
          }
          
          offset += length + 4; // Skip data and CRC
          
          if (type === 'IEND') break;
        }
        
        resolve(null);
      } catch (err) {
        console.error('PNG parsing error:', err);
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 解析V1格式的角色卡
 */
function parseV1Card(data: any): CharacterCardData {
  return {
    name: data.name || data.char_name || '',
    description: data.description || data.char_persona || '',
    personality: data.personality || '',
    scenario: data.scenario || data.world_scenario || '',
    first_mes: data.first_mes || data.char_greeting || '',
    mes_example: data.mes_example || data.example_dialogue || '',
    creator_notes: data.creator_notes || '',
    system_prompt: data.system_prompt || '',
    tags: data.tags || [],
    creator: data.creator || '',
    avatar: data.avatar || '',
  };
}

/**
 * 解析V2格式的角色卡 (SillyTavern V2)
 */
function parseV2Card(data: any): CharacterCardData {
  const spec = data.data || data;
  
  return {
    name: spec.name || data.name || '',
    description: spec.description || data.description || '',
    personality: spec.personality || data.personality || '',
    scenario: spec.scenario || data.scenario || '',
    first_mes: spec.first_mes || data.first_mes || '',
    mes_example: spec.mes_example || data.mes_example || '',
    creator_notes: spec.creator_notes || data.creator_notes || '',
    system_prompt: spec.system_prompt || data.system_prompt || '',
    post_history_instructions: spec.post_history_instructions || '',
    alternate_greetings: spec.alternate_greetings || [],
    tags: spec.tags || data.tags || [],
    creator: spec.creator || data.creator || '',
    character_version: spec.character_version || data.character_version || '',
    avatar: data.avatar || '',
  };
}

/**
 * 解析V3格式的角色卡 (Character Card V3)
 */
function parseV3Card(data: any): CharacterCardData {
  const spec = data.data || data;
  
  // V3 可能有更复杂的结构
  let description = spec.description || '';
  
  // 如果有角色书(character book)，可以附加到描述中
  if (spec.character_book?.entries) {
    const entries = spec.character_book.entries
      .filter((e: any) => e.content && e.enabled !== false)
      .map((e: any) => e.content)
      .join('\n\n');
    if (entries) {
      description += '\n\n【设定补充】\n' + entries;
    }
  }
  
  return {
    name: spec.name || data.name || '',
    description,
    personality: spec.personality || '',
    scenario: spec.scenario || '',
    first_mes: spec.first_mes || '',
    mes_example: spec.mes_example || '',
    creator_notes: spec.creator_notes || '',
    system_prompt: spec.system_prompt || '',
    post_history_instructions: spec.post_history_instructions || '',
    alternate_greetings: spec.alternate_greetings || [],
    tags: spec.tags || [],
    creator: spec.creator || '',
    character_version: spec.character_version || '',
    avatar: data.avatar || '',
  };
}

/**
 * 解析角色卡JSON
 */
function parseCharacterJSON(jsonStr: string): CharacterCardData | null {
  try {
    const data = JSON.parse(jsonStr);
    
    // 检测格式版本
    if (data.spec === 'chara_card_v3') {
      return parseV3Card(data);
    } else if (data.spec === 'chara_card_v2' || data.spec_version === '2.0' || data.data) {
      return parseV2Card(data);
    } else {
      return parseV1Card(data);
    }
  } catch (err) {
    console.error('JSON parsing error:', err);
    return null;
  }
}

/**
 * 将角色卡数据转换为应用使用的格式
 */
export function convertToAppFormat(card: CharacterCardData): {
  name: string;
  persona: string;
  openingLine: string;
} {
  // 组合人设描述
  let persona = card.description || '';
  
  if (card.personality) {
    persona += `\n\n【性格特点】\n${card.personality}`;
  }
  
  if (card.scenario) {
    persona += `\n\n【场景设定】\n${card.scenario}`;
  }
  
  if (card.system_prompt) {
    persona += `\n\n【系统提示】\n${card.system_prompt}`;
  }
  
  if (card.mes_example) {
    // 清理示例对话中的特殊标记
    let examples = card.mes_example
      .replace(/<START>/gi, '')
      .replace(/{{user}}/gi, '用户')
      .replace(/{{char}}/gi, card.name || '角色')
      .trim();
    
    if (examples) {
      persona += `\n\n【对话示例】\n${examples}`;
    }
  }
  
  // 处理开场白
  let openingLine = card.first_mes || '';
  openingLine = openingLine
    .replace(/{{user}}/gi, '你')
    .replace(/{{char}}/gi, card.name || '我')
    .trim();
  
  if (!openingLine && card.alternate_greetings && card.alternate_greetings.length > 0) {
    openingLine = card.alternate_greetings[0]
      .replace(/{{user}}/gi, '你')
      .replace(/{{char}}/gi, card.name || '我')
      .trim();
  }
  
  return {
    name: card.name || '未命名角色',
    persona: persona.trim(),
    openingLine: openingLine || '你好呀~',
  };
}

/**
 * 解析角色卡文件
 */
export async function parseCharacterCard(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  
  try {
    // PNG 文件 - 尝试提取嵌入数据
    if (fileName.endsWith('.png')) {
      const embedded = await extractFromPNG(file);
      
      if (embedded) {
        const card = parseCharacterJSON(embedded);
        if (card) {
          return { success: true, data: card };
        }
      }
      
      return { 
        success: false, 
        error: '无法从PNG中提取角色数据。请确保这是一个有效的酒馆角色卡。' 
      };
    }
    
    // JSON 文件
    if (fileName.endsWith('.json')) {
      const text = await file.text();
      const card = parseCharacterJSON(text);
      
      if (card) {
        return { success: true, data: card };
      }
      
      return { success: false, error: '无法解析JSON文件' };
    }
    
    // JSONL 文件 - 读取第一个角色
    if (fileName.endsWith('.jsonl')) {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        const card = parseCharacterJSON(lines[0]);
        if (card) {
          return { success: true, data: card };
        }
      }
      
      return { success: false, error: '无法解析JSONL文件' };
    }
    
    return { 
      success: false, 
      error: '不支持的文件格式。请使用 PNG、JSON 或 JSONL 文件。' 
    };
    
  } catch (err) {
    console.error('Character card parsing error:', err);
    return { 
      success: false, 
      error: `解析失败: ${err instanceof Error ? err.message : '未知错误'}` 
    };
  }
}

/**
 * 从文件中提取头像（如果是PNG文件）
 */
export async function extractAvatarFromFile(file: File): Promise<string | null> {
  if (file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
  return null;
}
