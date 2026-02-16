-- 增大 avatars 桶的文件大小限制到 500MB，支持音乐文件上传
UPDATE storage.buckets 
SET file_size_limit = 524288000 
WHERE name = 'avatars';