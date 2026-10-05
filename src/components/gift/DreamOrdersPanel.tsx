import React, { useState } from 'react';
import { Package, Truck, CheckCircle2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { DreamOrder, STATUS_LABEL, loadBuyProbabilities, saveBuyProbability } from '@/lib/dreamOrders';

interface Props {
  userId: string;
  orders: DreamOrder[];
  characters: { id: string; name: string }[];
  onSign: (orderId: string) => void;
}

const steps = ['paid', 'shipped', 'delivering', 'delivered', 'signed'] as const;

const DreamOrdersPanel: React.FC<Props> = ({ userId, orders, characters, onSign }) => {
  const [filter, setFilter] = useState<'all' | 'user' | 'character'>('all');
  const [probs, setProbs] = useState<Record<string, number>>(() => loadBuyProbabilities(userId));
  const list = orders.filter((o) => filter === 'all' || o.buyer === filter);

  return (
    <div className="space-y-4 mb-6">
      <div className="flex gap-2 text-sm">
        {([['all', '全部订单'], ['user', '我买的'], ['character', 'TA买给我']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1 rounded-full ${filter === k ? 'bg-orange-500 text-white' : 'bg-white/70 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">暂无订单</p>
      ) : list.map((o) => {
        const idx = steps.indexOf(o.status);
        return (
          <div key={o.id} className="bg-white/80 rounded-2xl p-3 shadow-sm">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{o.buyer === 'user' ? `送给 ${o.characterName}` : `${o.characterName} 买给你`}</span>
              <span className="text-orange-500 font-medium">{STATUS_LABEL[o.status]}</span>
            </div>
            <p className="text-sm font-medium text-gray-800">{o.items.map((i) => `${i.name} x${i.quantity}`).join('、')}</p>
            <p className="text-xs text-gray-500">实付 {o.total} 梦境币 · {new Date(o.createdAt).toLocaleString('zh-CN')}</p>
            <div className="flex items-center gap-1 mt-2">
              {steps.map((s, i) => (
                <div key={s} className={`flex-1 h-1 rounded-full ${i <= idx ? 'bg-orange-400' : 'bg-gray-200'}`} />
              ))}
            </div>
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                {idx >= 4 ? <CheckCircle2 className="w-3 h-3" /> : idx >= 1 ? <Truck className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                {idx === 0 ? '商家备货中' : idx < 3 ? '快递运输中' : idx === 3 ? '已送达' : '交易完成'}
              </span>
              {o.buyer === 'character' && o.status === 'delivered' && (
                <button onClick={() => onSign(o.id)} className="px-3 py-1 rounded-full bg-orange-500 text-white">确认签收</button>
              )}
            </div>
          </div>
        );
      })}

      {characters.length > 0 && (
        <div className="bg-white/80 rounded-2xl p-3 shadow-sm">
          <p className="text-sm font-medium text-gray-800 mb-1">角色代买概率</p>
          <p className="text-xs text-gray-500 mb-3">每个角色每天会按这个几率在梦阁给你买一件东西</p>
          {characters.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-1.5">
              <span className="text-sm w-20 truncate">{c.name}</span>
              <Slider className="flex-1" min={0} max={100} step={5} value={[probs[c.id] ?? 0]}
                onValueChange={([v]) => { setProbs((p) => ({ ...p, [c.id]: v })); saveBuyProbability(userId, c.id, v); }} />
              <span className="text-xs w-10 text-right">{probs[c.id] ?? 0}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DreamOrdersPanel;
