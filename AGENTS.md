# Project rules

- Edge functions that call a user's custom AI API must build the URL with `buildChatCompletionsUrl` and read replies via `readAiJson`/`describeAiError` from `supabase/functions/_shared/ai-endpoint.ts`, so every feature resolves addresses the same way and never shows an HTML page as an AI reply.
