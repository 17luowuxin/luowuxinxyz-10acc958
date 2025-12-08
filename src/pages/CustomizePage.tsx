import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const colors = ['#FF6B9D', '#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

const CustomizePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bubbleColor, setBubbleColor] = useState('#FF6B9D');
  const [friendBubbleColor, setFriendBubbleColor] = useState('#A855F7');
  const [opacity, setOpacity] = useState([1]);

  useEffect(() => {
    if (user) fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('customization').select('*').eq('user_id', user?.id).single();
    if (data) {
      setBubbleColor(data.bubble_color || '#FF6B9D');
      setFriendBubbleColor(data.friend_bubble_color || '#A855F7');
      setOpacity([Number(data.bubble_opacity) || 1]);
    }
  };

  const handleSave = async () => {
    await supabase.from('customization').update({
      bubble_color: bubbleColor,
      friend_bubble_color: friendBubbleColor,
      bubble_opacity: opacity[0],
    }).eq('user_id', user?.id);
    toast.success('美化设置已保存!');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-xl font-bold ml-2">美化</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-medium mb-3">我的气泡颜色</h3>
          <div className="flex gap-3">
            {colors.map(c => (
              <button key={c} onClick={() => setBubbleColor(c)} className={`w-10 h-10 rounded-full border-4 ${bubbleColor === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-medium mb-3">好友气泡颜色</h3>
          <div className="flex gap-3">
            {colors.map(c => (
              <button key={c} onClick={() => setFriendBubbleColor(c)} className={`w-10 h-10 rounded-full border-4 ${friendBubbleColor === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-medium mb-3">气泡透明度: {Math.round(opacity[0] * 100)}%</h3>
          <Slider value={opacity} onValueChange={setOpacity} max={1} step={0.1} />
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-medium mb-3">预览</h3>
          <div className="space-y-3">
            <div className="flex justify-end"><div className="px-4 py-2 rounded-2xl rounded-br-md text-white" style={{ backgroundColor: bubbleColor, opacity: opacity[0] }}>你好呀~</div></div>
            <div className="flex justify-start"><div className="px-4 py-2 rounded-2xl rounded-bl-md text-white" style={{ backgroundColor: friendBubbleColor, opacity: opacity[0] }}>你好! 很高兴认识你 💕</div></div>
          </div>
        </div>

        <Button variant="candy" className="w-full" onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
};

export default CustomizePage;
