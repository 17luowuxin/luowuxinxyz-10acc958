-- 更新 music 存储桶的文件大小限制为 500MB
UPDATE storage.buckets 
SET file_size_limit = 524288000 
WHERE id = 'music';