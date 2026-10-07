import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageCircle, StickyNote, Image as ImageIcon, Search, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, fetchEdgeFunction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Character { id: string; name: string; avatar_url: string | null }
interface PhoneData {
  notes: { title: string; content: string; date?: string }[];
  photos: { caption: string; date?: string }[];
  searches: { query: string; time?: string }[];
  generatedAt: string;
}
type App = 'home' | 'chat' | 'notes' | 'photos' | 'search';

const providerKey = (id: string) => `char_phone_${id}`;

const CharacterPhonePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [current, setCurrent] = useState<Character | null>(null);
  const [phone, setPhone] = useState<PhoneData | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string; created_at: string }[]>([]);
  const [app, setApp] = useState<App>('home');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('characters').select('id, name, avatar_url').eq('user_id', user.id).order('name')
      .then(({ data }) => setCharacters((data as Character[]) || []));
  }, [user]);

  const generate = async (c: Character) => {
    if (!user) return;
    setLoading(true);
    try {
      const resp = await fetchEdgeFunction('character-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: c.id, userId: user.id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '生成失败');
      setPhone(data);
      await supabase.from('api_keys').upsert(
        { user_id: user.id, provider: providerKey(c.id), api_key: JSON.stringify(data) } as any,
        { onConflict: 'user_id,provider' },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const open = async (c: Character) => {
    if (!user) return;
    setCurrent(c); setApp('home'); setPhone(null);
    const [{ data: saved }, { data: msgs }] = await Promise.all([
      supabase.from('api_keys').select('api_key').eq('user_id', user.id).eq('provider', providerKey(c.id)).maybeSingle(),
      supabase.from('chat_messages').select('role, content, created_at').eq('user_id', user.id).eq('character_id', c.id)
        .order('created_at', { ascending: false }).limit(60),
    ]);
    setMessages(((msgs as any[]) || []).reverse());
    if (saved?.api_key) {
      try { setPhone(JSON.parse(saved.api_key)); return; } catch { /* regenerate */ }
    }
    void generate(c);
  };

  const back = () => {
    if (current && app !== 'home') setApp('home');
    else if (current) setCurrent(null);
    else navigate('/');
  };

  const apps: { id: App; name: string; icon: React.ElementType; color: string }[] = [
    { id: 'chat', name: '微信', icon: MessageCircle, color: 'bg-green-500' },
    { id: 'notes', name: '备忘录', icon: StickyNote, color: 'bg-amber-400' },
    { id: 'photos', name: '相册', icon: ImageIcon, color: 'bg-pink-400' },
    { id: 'search', name: '浏览器', icon: Search, color: 'bg-blue-500' },
  ];
  const title = !current ? '偷看TA的手机' : app === 'home' ? `${current.name}的手机` : apps.find((a) => a.id === app)?.name;

  return (
    <div className="min-h-screen flex flex-col bg-background/80 backdrop-blur">
      <div className="flex items-center gap-2 px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button onClick={back} aria-label="返回"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="flex-1 font-semibold">{title}</h1>
        {current && (
          <button onClick={() => generate(current)} disabled={loading} aria-label="刷新" className="text-sm flex items-center gap-1 text-muted-foreground">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />刷新
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {!current && (
          <div className="grid grid-cols-3 gap-4 pt-2">
            {characters.map((c) => (
              <button key={c.id} onClick={() => open(c)} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card shadow-sm">
                {c.avatar_url ? <img src={c.avatar_url} alt={c.name} className="w-14 h-14 rounded-full object-cover" />
                  : <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center"><Smartphone className="w-6 h-6" /></div>}
                <span className="text-sm truncate w-full text-center">{c.name}</span>
              </button>
            ))}
            {characters.length === 0 && <p className="col-span-3 text-center text-muted-foreground py-10">还没有角色</p>}
          </div>
        )}

        {current && loading && !phone && (
          <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
            <RefreshCw className="w-8 h-8 animate-spin" />正在偷偷解锁{current.name}的手机…
          </div>
        )}

        {current && app === 'home' && (phone || !loading) && (
          <div className="rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 min-h-[60vh]">
            <p className="text-center text-4xl font-light text-white/90 mb-1">{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-center text-xs text-white/60 mb-8">{current.name} 的手机 · 已解锁</p>
            <div className="grid grid-cols-4 gap-4">
              {apps.map((a) => (
                <button key={a.id} onClick={() => setApp(a.id)} className="flex flex-col items-center gap-1">
                  <div className={`w-14 h-14 rounded-2xl ${a.color} flex items-center justify-center`}><a.icon className="w-7 h-7 text-white" /></div>
                  <span className="text-xs text-white/80">{a.name}</span>
                </button>
              ))}
            </div>
            {!phone && <p className="text-center text-xs text-white/60 mt-8">内容还没生成，点右上角「刷新」</p>}
          </div>
        )}

        {current && app === 'chat' && (
          <div className="space-y-2">
            <p className="text-center text-xs text-muted-foreground">TA 和你的聊天（TA的视角）</p>
            {messages.length === 0 && <p className="text-center text-muted-foreground py-10">还没有聊天记录</p>}
            {messages.map((m, i) => {
              const mine = m.role === 'assistant';
              return (
                <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${mine ? 'bg-green-500 text-white' : 'bg-card'}`}>
                    {m.content.replace(/\[(TRANSFER|IMAGE|STICKER)[^\]]*\]/g, '[特殊消息]')}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {current && app === 'notes' && phone && (
          <div className="space-y-3">
            {phone.notes.map((n, i) => (
              <div key={i} className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex justify-between mb-1"><p className="font-medium">{n.title}</p><span className="text-xs text-muted-foreground">{n.date}</span></div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{n.content}</p>
              </div>
            ))}
          </div>
        )}

        {current && app === 'photos' && phone && (
          <div className="grid grid-cols-2 gap-3">
            {phone.photos.map((p, i) => (
              <div key={i} className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/40 p-3 flex flex-col justify-between">
                <p className="text-xs leading-relaxed overflow-hidden">{p.caption}</p>
                <span className="text-[10px] text-muted-foreground">{p.date}</span>
              </div>
            ))}
          </div>
        )}

        {current && app === 'search' && phone && (
          <div className="rounded-2xl bg-card divide-y divide-border">
            <p className="px-4 py-2 text-xs text-muted-foreground">搜索历史</p>
            {phone.searches.map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm">{s.query}</span>
                <span className="text-xs text-muted-foreground">{s.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterPhonePage;
