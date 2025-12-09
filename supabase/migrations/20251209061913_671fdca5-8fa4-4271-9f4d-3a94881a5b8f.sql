-- Create storage bucket for music files
INSERT INTO storage.buckets (id, name, public)
VALUES ('music', 'music', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload music files
CREATE POLICY "Users can upload music files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'music' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their music files
CREATE POLICY "Users can update their music files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'music' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their music files
CREATE POLICY "Users can delete their music files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'music' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public access to music files (for playback)
CREATE POLICY "Public can view music files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'music');