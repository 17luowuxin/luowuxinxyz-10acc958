-- Add quoted_message_id column to chat_messages for persisting message quotes
ALTER TABLE public.chat_messages
ADD COLUMN quoted_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;