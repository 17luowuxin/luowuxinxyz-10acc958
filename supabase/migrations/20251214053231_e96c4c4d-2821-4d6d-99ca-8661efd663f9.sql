-- Create space_logs table for independent logs in Space page
CREATE TABLE public.space_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.space_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for users to manage their own logs
CREATE POLICY "Users can manage own space_logs"
  ON public.space_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_space_logs_updated_at
  BEFORE UPDATE ON public.space_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();