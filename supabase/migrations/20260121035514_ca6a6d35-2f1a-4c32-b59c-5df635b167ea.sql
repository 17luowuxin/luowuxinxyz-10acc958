-- 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 启用 pg_net 扩展用于HTTP调用
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 授予权限
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;