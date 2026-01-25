-- 为群聊表添加互动设置字段
ALTER TABLE public.group_chats 
ADD COLUMN IF NOT EXISTS lively_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS interaction_settings jsonb DEFAULT '{"maxRounds": 3, "firstTriggerChance": 50, "continueChanceBase": 40, "continueChanceDecay": 10}'::jsonb;