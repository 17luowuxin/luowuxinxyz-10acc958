-- 添加小说模式指令格式开关字段
ALTER TABLE public.characters 
ADD COLUMN use_novel_format boolean DEFAULT false;

COMMENT ON COLUMN public.characters.use_novel_format IS '启用后AI回复将自动使用小说模式指令格式（/旁白、/对话、/动作、/想法）';