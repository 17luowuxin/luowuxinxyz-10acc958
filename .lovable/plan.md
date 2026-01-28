
# ✅ 优化新域名 luowuxin.xyz 的访问速度 (已完成)

## 问题诊断

通过分析代码，发现了性能问题的根本原因：

### 当前架构问题
- **Supabase SDK 调用**（登录、数据查询）→ 走 Vercel 代理 ✓
- **直接 fetch 调用 Edge Functions** → 硬编码 `import.meta.env.VITE_SUPABASE_URL` → 直连被墙 ✗

---

## ✅ 已实施的解决方案

### 1. 创建统一的 API URL 工具函数

创建 `src/lib/supabaseUrl.ts`：

```typescript
export const getSupabaseUrl = (): string => {
  const isCustomDomain = typeof window !== 'undefined' && 
    (window.location.hostname === 'luowuxin.xyz' || 
     window.location.hostname === 'www.luowuxin.xyz');

  return isCustomDomain 
    ? `${window.location.origin}/supabase`
    : import.meta.env.VITE_SUPABASE_URL;
};
```

### 2. 已更新的文件

| 文件 | 修改处 | 状态 |
|------|--------|------|
| `src/pages/ChatPage.tsx` | 10+ 处 fetch 调用 | ✅ 完成 |
| `src/pages/BottlePage.tsx` | 1 处 fetch 调用 | ✅ 完成 |
| `src/pages/FriendsPage.tsx` | 1 处 fetch 调用 | ✅ 完成 |
| `src/pages/MusicPage.tsx` | 1 处 storage 调用 | ✅ 完成 |

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

1. ✅ **AI 聊天回复正常** - 不再需要 VPN
2. ✅ **TTS 语音功能正常** - 走代理
3. ✅ **所有 Edge Function 调用正常** - 统一走代理
4. ✅ **保留原有 Lovable 域名的直连** - 国外用户不受影响
5. ✅ **用户历史数据保留** - 使用同一个数据库
6. ✅ **不消耗 Lovable 云余额** - 只是改变了请求路由

---

## 部署说明

代码修改完成后，需要确保：
1. 代码已推送到 GitHub 并部署到 Vercel
2. `luowuxin.xyz` 域名已添加到 Vercel 项目
3. DNS 记录已正确配置指向 Vercel
