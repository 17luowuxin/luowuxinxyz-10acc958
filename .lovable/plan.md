

# 图片上传预压缩功能 + 清除聊天记录 Bug 修复

## 功能概述

### 需求 1: 图片上传预压缩
在前端（浏览器端）对用户上传的图片进行压缩后再上传到存储，参数为最大宽度 1080px，质量 0.8。

### 需求 2: 修复清除聊天记录 Bug
点击"清除全部聊天记录"时，需同时移除屏幕上所有的转账卡片组件。

---

## 实现方案

### 第一部分：创建通用图片压缩工具

创建一个独立的工具函数文件，避免在多个页面重复相同代码：

**新建文件 `src/utils/imageCompressor.ts`**

```text
功能：
- 接收 File 对象、最大宽度（默认 1080px）、质量（默认 0.8）
- 使用 Canvas API 进行压缩
- 返回压缩后的 Blob
- 保持宽高比，仅在超过最大宽度时缩放
```

### 第二部分：应用压缩到各上传场景

需要修改以下文件：

| 文件 | 上传场景 | 压缩尺寸 |
|-----|---------|---------|
| `ChatPage.tsx` | 聊天图片上传 | 1080px |
| `ProfilePage.tsx` | 头像上传 | 512px（头像较小）|
| `SpacePage.tsx` | 动态图片上传 | 1080px |
| `AlbumPage.tsx` | 相册上传 | 1080px |
| `GroupChatPage.tsx` | 群聊背景 | 1080px |
| `CustomizePage.tsx` | 聊天/全局背景 | 1920px（背景较大）|
| `VisualNovelPage.tsx` | 立绘/背景上传 | 1080px |

注：`MusicPage.tsx` 和 `HomeScreen.tsx` 已有压缩功能，可复用或替换为统一工具。

### 第三部分：修复清除聊天记录 Bug

**当前问题**：
`ChatPage.tsx` 中的 `clearAllMessages` 函数只清空了 `messages` 状态，但没有清空 `pendingTransfers` 状态，导致转账卡片仍然显示。

**修复方案**：
在 `clearAllMessages` 函数中添加 `setPendingTransfers([])` 调用。

---

## 详细技术实现

### 1. 通用压缩工具（新文件）

```typescript
// src/utils/imageCompressor.ts

export const compressImage = (
  file: File, 
  maxWidth = 1080, 
  quality = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      let { width, height } = img;
      
      // 仅在超过最大宽度时缩放
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src); // 清理内存
          blob ? resolve(blob) : reject(new Error('压缩失败'));
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('图片加载失败'));
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// 辅助函数：将 Blob 转为 File
export const blobToFile = (
  blob: Blob, 
  originalFileName: string
): File => {
  const newName = originalFileName.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg' });
};
```

### 2. ChatPage.tsx 修改

```typescript
// 导入压缩工具
import { compressImage, blobToFile } from '@/utils/imageCompressor';

// 修改 uploadImageToStorage 函数
const uploadImageToStorage = async (file: File): Promise<string | null> => {
  if (!user?.id) return null;
  
  try {
    // 压缩图片
    const compressedBlob = await compressImage(file, 1080, 0.8);
    const compressedFile = blobToFile(compressedBlob, file.name);
    
    const fileName = `${user.id}/${Date.now()}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(fileName, compressedFile);
    // ...其余逻辑不变
  } catch (error) {
    console.error('Upload image error:', error);
    return null;
  }
};

// 修改 clearAllMessages 函数
const clearAllMessages = async () => {
  try {
    await supabase.from('chat_messages').delete()
      .eq('character_id', characterId)
      .eq('user_id', user?.id);
    setMessages([]);
    setPendingTransfers([]); // 新增：清除转账卡片
    toast.success('已清空全部聊天记录');
  } catch (err) {
    toast.error('清空失败');
  }
};
```

### 3. 其他页面修改示例

**ProfilePage.tsx（头像压缩）**：
```typescript
import { compressImage, blobToFile } from '@/utils/imageCompressor';

const handleAvatarUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file || !user) return;
  
  // 压缩头像（512px，质量0.85）
  const compressedBlob = await compressImage(file, 512, 0.85);
  const compressedFile = blobToFile(compressedBlob, file.name);
  
  const filePath = `${user.id}/avatar-${Date.now()}.jpg`;
  await supabase.storage.from('avatars').upload(filePath, compressedFile, { upsert: true });
  // ...
};
```

**SpacePage.tsx（动态图片压缩）**：
```typescript
import { compressImage, blobToFile } from '@/utils/imageCompressor';

const handleUploadPostImage = async (e) => {
  // ...验证逻辑
  for (const file of Array.from(files)) {
    const compressedBlob = await compressImage(file, 1080, 0.8);
    const compressedFile = blobToFile(compressedBlob, file.name);
    
    const fileName = `${user.id}/moment-${Date.now()}.jpg`;
    await supabase.storage.from('photos').upload(fileName, compressedFile);
    // ...
  }
};
```

---

## 文件修改清单

| 操作 | 文件路径 | 修改内容 |
|-----|---------|---------|
| 新建 | `src/utils/imageCompressor.ts` | 通用压缩工具函数 |
| 修改 | `src/pages/ChatPage.tsx` | 添加压缩 + 修复清除 Bug |
| 修改 | `src/pages/ProfilePage.tsx` | 添加头像压缩 |
| 修改 | `src/pages/SpacePage.tsx` | 添加动态图片压缩 |
| 修改 | `src/pages/AlbumPage.tsx` | 添加相册图片压缩 |
| 修改 | `src/pages/GroupChatPage.tsx` | 添加背景图压缩 |
| 修改 | `src/pages/CustomizePage.tsx` | 添加背景图压缩 |
| 修改 | `src/pages/VisualNovelPage.tsx` | 添加立绘/背景压缩 |
| 可选 | `src/pages/MusicPage.tsx` | 替换为统一工具 |
| 可选 | `src/components/phone/HomeScreen.tsx` | 替换为统一工具 |

---

## 预期效果

1. **上传速度提升**：图片经过压缩后体积大幅减小（通常减少 50-80%）
2. **存储空间节省**：减少 Supabase 存储使用量
3. **加载速度提升**：压缩后的图片在聊天、动态等页面加载更快
4. **Bug 修复**：清除聊天记录时，转账卡片也会同步消失

