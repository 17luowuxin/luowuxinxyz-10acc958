/**
 * 图片压缩工具
 * 使用 Canvas API 在浏览器端压缩图片
 */

/**
 * 压缩图片
 * @param file 原始文件
 * @param maxWidth 最大宽度（默认 1080px）
 * @param quality 压缩质量 0-1（默认 0.8）
 * @returns 压缩后的 Blob
 */
export const compressImage = (
  file: File,
  maxWidth = 1080,
  quality = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // 如果不是图片文件，直接返回原文件
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = document.createElement('img');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('无法创建 Canvas 上下文'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // 仅在超过最大宽度时缩放
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src); // 清理内存
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('压缩失败'));
          }
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

/**
 * 将 Blob 转为 File 对象
 * @param blob Blob 对象
 * @param originalFileName 原始文件名
 * @returns File 对象
 */
export const blobToFile = (blob: Blob, originalFileName: string): File => {
  const newName = originalFileName.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg' });
};
