// 统一处理用户自定义 AI 接口地址和返回内容，避免把网页当成 AI 回复。

/**
 * 把用户填写的地址整理成 chat/completions 接口地址。
 * - 已经以 /chat/completions 结尾：原样使用
 * - 以 /v1、/v3、/v4 等版本号结尾：补上 /chat/completions
 * - 中间含 /v1/：截到 /v1 再补
 * - 只有域名或其它路径：补 /v1/chat/completions
 */
export function buildChatCompletionsUrl(baseUrl: string): string {
  const url = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!url) return url;
  if (/\/chat\/completions$/i.test(url)) return url;
  if (/\/v\d+(?:beta)?$/i.test(url)) return `${url}/chat/completions`;
  if (/\/v1\//i.test(url)) return url.replace(/\/v1\/.*$/i, '/v1/chat/completions');
  return `${url}/v1/chat/completions`;
}

export function looksLikeHtml(text: string, contentType = ''): boolean {
  if (/text\/html/i.test(contentType)) return true;
  const head = String(text || '').trimStart().slice(0, 300).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.includes('<head>') || head.includes('<body') || head.includes('<script');
}

export function htmlResponseMessage(apiUrl?: string): string {
  return `API地址填错了：这个地址返回的是一个网页，不是AI回复${apiUrl ? `（实际请求：${apiUrl}）` : ''}。请到「设置」把API地址改成服务商给的接口地址，一般以 /v1 结尾，例如 https://xxx.com/v1，然后点「测试连接」确认成功。`;
}

/** 根据 HTTP 状态和返回内容，给出用户看得懂的失败原因 */
export function describeAiError(status: number, text: string, apiUrl?: string): string {
  if (looksLikeHtml(text)) return htmlResponseMessage(apiUrl);
  let detail = '';
  try {
    const json = JSON.parse(text);
    const err = json?.error;
    detail = String((typeof err === 'string' ? err : err?.message) || json?.message || json?.msg || '').trim();
  } catch {
    detail = String(text || '').trim().slice(0, 200);
  }
  const lower = detail.toLowerCase();
  let reason: string;
  if (status === 401 || /invalid.*(api[_ ]?key|token)|unauthorized|无效的令牌|令牌/.test(lower)) {
    reason = 'API密钥不对或已失效，请检查密钥是否复制完整';
  } else if (status === 402 || /insufficient|quota|余额|额度/.test(lower)) {
    reason = 'API账户余额或额度不足，请到服务商那里充值';
  } else if (/no available channel|model_not_found|model not found|does not exist|模型不存在|无可用渠道/.test(lower)) {
    reason = '服务商没有这个模型或暂时不可用，请换一个模型';
  } else if (status === 404) {
    reason = 'API地址不对，找不到接口，一般应以 /v1 结尾';
  } else if (status === 429) {
    reason = '请求太频繁或服务商限流，请稍后再试';
  } else if (status === 403) {
    reason = '服务商拒绝了请求（可能是密钥没有权限或IP被限制）';
  } else if (status >= 500) {
    reason = '服务商那边出错了，请稍后再试或换个模型';
  } else {
    reason = `请求失败（错误码 ${status}）`;
  }
  return detail ? `${reason}。服务商原话：${detail.slice(0, 160)}` : reason;
}

/** 读取 AI 接口返回的 JSON；如果返回的是网页或不是 JSON，抛出看得懂的中文错误 */
export async function readAiJson(response: Response, apiUrl?: string): Promise<any> {
  const text = await response.text();
  if (looksLikeHtml(text, response.headers.get('content-type') || '')) {
    throw new Error(htmlResponseMessage(apiUrl));
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`AI接口返回的内容看不懂（不是标准格式），请检查API地址是否正确。返回开头：${text.trim().slice(0, 80)}`);
  }
}
