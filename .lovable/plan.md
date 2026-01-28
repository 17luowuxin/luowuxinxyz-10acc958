
# 优化新域名 luowuxin.xyz 的访问速度

## 问题诊断

通过分析代码，发现了性能问题的根本原因：

### 当前架构问题
- **Supabase SDK 调用**（登录、数据查询）→ 走 Vercel 代理 ✓
- **直接 fetch 调用 Edge Functions** → 硬编码 `import.meta.env.VITE_SUPABASE_URL` → 直连被墙 ✗

代码中有大量直接使用环境变量的地方：
```typescript
// ChatPage.tsx 等文件中
await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, ...)
```

这导致 AI 聊天回复、TTS 语音等功能在国内访问时超时或失败。

---

## 解决方案

### 1. 创建统一的 API URL 工具函数

创建一个工具函数来动态获取正确的 Supabase URL：

```typescript
// src/lib/supabaseUrl.ts
export const getSupabaseUrl = (): string => {
  const isCustomDomain = typeof window !== 'undefined' && 
    (window.location.hostname === 'luowuxin.xyz' || 
     window.location.hostname === 'www.luowuxin.xyz');

  return isCustomDomain 
    ? `${window.location.origin}/supabase`
    : import.meta.env.VITE_SUPABASE_URL;
};
```

### 2. 需要更新的文件

替换所有直接使用 `import.meta.env.VITE_SUPABASE_URL` 的地方：

| 文件 | 调用次数 | 功能 |
|------|----------|------|
| `src/pages/ChatPage.tsx` | 10+ | AI聊天、TTS语音、记忆摘要 |
| `src/pages/BottlePage.tsx` | 1 | 漂流瓶回复 |
| `src/pages/FriendsPage.tsx` | 1 | 记忆摘要 |
| `src/pages/MusicPage.tsx` | 1 | 音乐上传 |

### 3. 修改示例

将：
```typescript
await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
```

改为：
```typescript
import { getSupabaseUrl } from '@/lib/supabaseUrl';
// ...
await fetch(`${getSupabaseUrl()}/functions/v1/chat`, {
```

---

## 技术细节

### 代理路径映射
```
用户访问                           实际转发到
luowuxin.xyz/supabase/functions/v1/chat → supabase.co/functions/v1/chat
luowuxin.xyz/supabase/rest/v1/...       → supabase.co/rest/v1/...
luowuxin.xyz/supabase/storage/...       → supabase.co/storage/...
```

### 工作流程变化
```text
修改前（国内用户）:
  [浏览器] → 直连 supabase.co → 被墙/超时 ✗

修改后（国内用户）:
  [浏览器] → luowuxin.xyz/supabase → Vercel代理 → supabase.co ✓
```

---

## 预期效果

1. **AI 聊天回复正常** - 不再需要 VPN
2. **TTS 语音功能正常** - 走代理
3. **所有 Edge Function 调用正常** - 统一走代理
4. **保留原有 Lovable 域名的直连** - 国外用户不受影响

---

## 实施步骤

1. 创建 `src/lib/supabaseUrl.ts` 工具函数
2. 更新 `ChatPage.tsx` 中的所有 fetch 调用（约 10 处）
3. 更新 `BottlePage.tsx`、`FriendsPage.tsx`、`MusicPage.tsx`
4. 测试验证代理功能正常
