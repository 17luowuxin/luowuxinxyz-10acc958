import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find pending messages that haven't expired
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('pending_messages')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching pending messages:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending messages to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const msg of pendingMessages) {
      try {
        // Mark as processing
        await supabase
          .from('pending_messages')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', msg.id);

        const context = msg.request_context as any;

        // Call the chat function to get AI response
        const chatResponse = await fetch(`${supabaseUrl}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            characterId: msg.character_id,
            userId: msg.user_id,
            messages: context.messages || [],
            persona: context.persona,
            userName: context.userName,
            replyMode: context.replyMode,
            historyLimit: context.historyLimit
          })
        });

        if (!chatResponse.ok) {
          throw new Error(`Chat API error: ${chatResponse.status}`);
        }

        const responseText = await chatResponse.text();
        let aiContent = '';

        // Parse response (handle both JSON and streaming)
        try {
          const jsonResponse = JSON.parse(responseText);
          aiContent = jsonResponse.content || jsonResponse.message || responseText;
        } catch {
          // If it's SSE, extract content
          const lines = responseText.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  aiContent += data.content;
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        }

        if (!aiContent) {
          throw new Error('Empty AI response');
        }

        // Save the AI message to chat_messages
        const { error: saveError } = await supabase
          .from('chat_messages')
          .insert({
            user_id: msg.user_id,
            character_id: msg.character_id,
            role: 'assistant',
            content: aiContent
          });

        if (saveError) {
          throw new Error(`Failed to save message: ${saveError.message}`);
        }

        // Mark as completed
        await supabase
          .from('pending_messages')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', msg.id);

        // Send push notification
        const { data: character } = await supabase
          .from('characters')
          .select('name')
          .eq('id', msg.character_id)
          .single();

        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            userId: msg.user_id,
            title: `${character?.name || '角色'}回复了你`,
            body: aiContent.slice(0, 100) + (aiContent.length > 100 ? '...' : ''),
            url: `/chat/${msg.character_id}`,
            characterId: msg.character_id,
            characterName: character?.name
          })
        });

        results.push({ id: msg.id, status: 'completed' });
      } catch (error) {
        console.error('Error processing message:', msg.id, error);
        
        // Update retry count and mark as pending again
        await supabase
          .from('pending_messages')
          .update({ 
            status: msg.retry_count >= 2 ? 'failed' : 'pending',
            retry_count: msg.retry_count + 1,
            error_message: String(error),
            updated_at: new Date().toISOString()
          })
          .eq('id', msg.id);

        results.push({ id: msg.id, status: 'error', error: String(error) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Process pending messages error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
