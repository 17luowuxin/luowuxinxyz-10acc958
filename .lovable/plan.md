
# 迁移计划：从 Lovable Cloud 迁移到外部 Supabase

## 背景说明

你的截图显示，你已经可以在 Supabase 官网看到这个项目（`17luowuxin的项目`），项目 ID 是 `emvolhvffoqsfmhbcadk`。这意味着你已经拥有了这个 Supabase 项目的完整控制权。

**关键发现**：你可以直接将代码迁移到新的 Lovable 项目，然后连接这个**已有的** Supabase 项目，无需重建数据库！

---

## 迁移概览

```text
当前状态                          目标状态
┌────────────────────┐           ┌────────────────────┐
│ Lovable 项目 A     │           │ 新 Lovable 项目 B   │
│ (启用 Cloud)       │           │ (不启用 Cloud)      │
│        │           │           │        │           │
│        ▼           │    ═══>   │        ▼           │
│  Lovable Cloud     │           │ 外部连接 Supabase  │
│  (消耗 $25 额度)    │           │ (用 Supabase 免费层) │
└────────────────────┘           └────────────────────┘
         │                                │
         ▼                                ▼
┌────────────────────┐           ┌────────────────────┐
│ Supabase 项目      │    保留    │ 同一个 Supabase    │
│ emvolhvffoqsfmhbcadk│   ════>   │ emvolhvffoqsfmhbcadk│
│ (数据库 + 用户)     │           │ (数据完整保留)      │
└────────────────────┘           └────────────────────┘
```

---

## 第一阶段：准备工作（在 Supabase 官网操作）

### 1.1 获取 Supabase 项目凭证

在 Supabase 官网 → 你的项目 → Settings → API：

| 需要获取的信息 | 位置 | 用途 |
|--------------|------|------|
| Project URL | `https://emvolhvffoqsfmhbcadk.supabase.co` | 已知 |
| anon public key | API Keys → `anon` `public` | 前端连接用 |
| service_role key | API Keys → `service_role` | Edge Function 用 |

### 1.2 检查 Supabase 项目 Tier

确认项目是 **Free Tier**（免费计划）：
- 进入 Supabase Dashboard → Settings → Billing
- 确认 Plan 显示为 "Free" 或 "Nano"
- 免费计划包含：500MB 数据库、1GB 文件存储、50,000 月活用户

### 1.3 备份 Edge Function Secrets

在 Supabase Dashboard → Edge Functions → Secrets，记录以下密钥的值：

- `ADMIN_PASSWORD`
- `DEFAULT_DEEPSEEK_API_KEY`
- `DEFAULT_TENSDAQ_API_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`

---

## 第二阶段：创建新 Lovable 项目

### 2.1 创建空白项目

1. 在 Lovable 首页点击 "New Project"
2. **关键**：当提示启用 Lovable Cloud 时，选择 **"不启用"** 或跳过
3. 项目创建后，进入 Settings → Supabase

### 2.2 连接外部 Supabase

在新项目中：
1. 点击 "Connect external Supabase"
2. 填入第一阶段获取的：
   - Project URL
   - anon key
   - service_role key
3. 完成连接

---

## 第三阶段：迁移代码

### 3.1 需要迁移的文件清单

**核心文件（约 100+ 文件）**：

```text
迁移内容:
├── src/
│   ├── App.tsx                    # 路由配置
│   ├── App.css                    # 样式
│   ├── index.css                  # 全局样式
│   ├── main.tsx                   # 入口
│   ├── pages/                     # 30 个页面组件
│   ├── components/                # 所有UI组件
│   ├── contexts/                  # AuthContext, MusicContext
│   ├── hooks/                     # 自定义 Hooks
│   ├── utils/                     # 工具函数
│   ├── data/                      # 静态数据
│   ├── assets/                    # 图片资源
│   └── lib/                       # 库配置
├── supabase/
│   ├── functions/                 # 25 个 Edge Functions
│   └── config.toml                # 函数配置
├── public/                        # 静态资源
├── vercel.json                    # Vercel 代理配置
└── tailwind.config.ts             # Tailwind 配置
```

### 3.2 迁移方式

**方式 A：复制粘贴（推荐）**
1. 在当前项目的代码编辑器中复制每个文件内容
2. 在新项目中创建对应文件并粘贴
3. 按目录逐步完成

**方式 B：GitHub 导出**
1. 将当前项目连接到 GitHub（如果还没有）
2. 在新项目中拉取同一个 GitHub 仓库
3. 需要后续手动断开旧项目的连接

### 3.3 需要修改的文件

**不需要修改的文件**（新项目会自动生成）：
- `src/integrations/supabase/client.ts` - 自动生成
- `src/integrations/supabase/types.ts` - 自动生成
- `.env` - 自动配置

**需要检查/保留的文件**：
- `vercel.json` - 中国代理配置，需要保留
- `src/lib/supabaseUrl.ts` - 代理 URL 逻辑，需要保留
- `src/integrations/supabase/proxyClient.ts` - 代理客户端，需要保留

---

## 第四阶段：配置 Edge Functions

### 4.1 重新添加 Secrets

在新 Lovable 项目中，通过聊天添加密钥：
1. 告诉 Lovable 添加 `ADMIN_PASSWORD` secret
2. 告诉 Lovable 添加 `DEFAULT_DEEPSEEK_API_KEY` secret
3. 依次添加所有需要的密钥

### 4.2 部署 Edge Functions

Edge Functions 会在代码迁移后自动部署，无需手动操作。

---

## 第五阶段：验证与切换

### 5.1 功能验证清单

| 功能 | 测试方法 | 预期结果 |
|-----|---------|---------|
| 登录 | 使用现有账号登录 | 成功登录，看到原有数据 |
| 聊天 | 发送消息给角色 | AI 正常回复 |
| 角色列表 | 进入好友页面 | 显示原有角色 |
| 个性化 | 查看主题设置 | 显示原有设置 |
| 管理后台 | 进入 /admin | 正常验证密码并进入 |

### 5.2 域名切换

1. 获取新项目的预览 URL
2. 在 Vercel（luowuxin.xyz 的托管平台）中更新指向
3. 或者直接发布新项目并更新 DNS

---

## 第六阶段：清理旧项目

### 6.1 确认新项目正常后

1. 保留旧 Lovable 项目 1-2 周作为备份
2. 确认用户可以正常使用新项目
3. 删除旧 Lovable 项目（可选）

### 6.2 费用变化

| 项目 | 迁移前 | 迁移后 |
|-----|-------|-------|
| Lovable Pro 1 | $20/月 | $20/月（保留 AI 编辑功能） |
| Lovable Cloud | 消耗 $25 额度 | **$0**（不再消耗） |
| Supabase | 通过 Cloud 使用 | 免费计划直接使用 |
| **总计** | $20/月 + Cloud 额度 | $20/月 |

---

## 注意事项

### 数据安全
- 数据库数据完全保留在原 Supabase 项目中
- 迁移过程不会丢失任何用户数据
- 所有认证信息（用户账号）保持不变

### 潜在问题

1. **文件存储**：Storage 桶中的文件（头像、图片等）保留在 Supabase，无需迁移

2. **代理配置**：`vercel.json` 中的代理规则需要保留，确保中国用户可以访问

3. **Realtime**：如果使用了实时订阅，功能会自动继续工作

---

## 时间估计

| 阶段 | 预计时间 |
|-----|---------|
| 准备工作 | 15 分钟 |
| 创建新项目 | 5 分钟 |
| 迁移代码 | 2-4 小时（取决于方式） |
| 配置 Secrets | 10 分钟 |
| 验证测试 | 30 分钟 |
| **总计** | 3-5 小时 |

---

## 下一步

确认你准备好后，我可以帮你：

1. **导出完整的数据库 Schema SQL** - 用于参考或备份
2. **列出所有需要迁移的文件** - 生成完整清单
3. **指导具体的迁移步骤** - 一步步进行
