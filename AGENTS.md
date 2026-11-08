# Project rules

- Edge functions that call a user's custom AI API must build the URL with `buildChatCompletionsUrl` and read replies via `readAiJson`/`describeAiError` from `supabase/functions/_shared/ai-endpoint.ts`, so every feature resolves addresses the same way and never shows an HTML page as an AI reply.

- Treat the external-auth preparation documents as inert configuration templates, not runtime configuration; activate external-only auth only after real project configuration and server-side atomic invite validation are verified, to avoid breaking the current login with placeholders.
