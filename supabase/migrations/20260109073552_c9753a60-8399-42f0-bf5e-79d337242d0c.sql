-- 无需新表，使用现有api_keys表存储空间图片生成API配置
-- 将使用以下provider值:
-- 'space_image_api_key' - 图片API密钥
-- 'space_image_api_url' - 图片API地址  
-- 'space_image_api_model' - 图片模型
-- 'space_image_enabled' - 是否启用

-- 添加注释说明这些配置的用途
COMMENT ON TABLE public.api_keys IS '存储用户的各类API配置，包括聊天API、NovelAI、TTS、空间图片生成API等';