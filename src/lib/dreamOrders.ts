// 梦阁订单：下单 -> 发货 -> 运输 -> 签收（按时间推进，状态变化写入聊天让角色知道）
export type OrderStatus = 'paid' | 'shipped' | 'delivering' | 'delivered' | 'signed';
export type OrderBuyer = 'user' | 'character';

export interface DreamOrder {
  id: string;
  buyer: OrderBuyer; // user=我买给角色；character=角色买给我
  characterId: string;
  characterName: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  status: OrderStatus;
  notified: OrderStatus; // 已经通知到聊天的最新状态
  createdAt: number;
  signedAt?: number;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: '待发货',
  shipped: '已发货',
  delivering: '派送中',
  delivered: '待签收',
  signed: '已签收',
};

const SHIP_MS = 60_000; // 1分钟后发货
const DELIVERING_MS = 3 * 60_000;
const DELIVERED_MS = 5 * 60_000;

const key = (uid: string) => `dream_orders_${uid}`;
const probKey = (uid: string) => `dream_buy_prob_${uid}`;
const rollKey = (uid: string) => `dream_buy_roll_${uid}`;

export const loadOrders = (uid: string): DreamOrder[] => {
  try { return JSON.parse(localStorage.getItem(key(uid)) || '[]'); } catch { return []; }
};
export const saveOrders = (uid: string, orders: DreamOrder[]) =>
  localStorage.setItem(key(uid), JSON.stringify(orders.slice(0, 200)));

export const loadBuyProbabilities = (uid: string): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(probKey(uid)) || '{}'); } catch { return {}; }
};
export const saveBuyProbability = (uid: string, charId: string, value: number) => {
  const all = loadBuyProbabilities(uid);
  all[charId] = value;
  localStorage.setItem(probKey(uid), JSON.stringify(all));
};

export const createOrder = (uid: string, o: Omit<DreamOrder, 'id' | 'status' | 'notified' | 'createdAt'>) => {
  const order: DreamOrder = { ...o, id: crypto.randomUUID(), status: 'paid', notified: 'paid', createdAt: Date.now() };
  saveOrders(uid, [order, ...loadOrders(uid)]);
  return order;
};

const timeStatus = (o: DreamOrder): OrderStatus => {
  if (o.status === 'signed') return 'signed';
  const age = Date.now() - o.createdAt;
  if (age >= DELIVERED_MS) return 'delivered';
  if (age >= DELIVERING_MS) return 'delivering';
  if (age >= SHIP_MS) return 'shipped';
  return 'paid';
};

const ORDER: OrderStatus[] = ['paid', 'shipped', 'delivering', 'delivered', 'signed'];

export type ChatWriter = (characterId: string, role: 'user' | 'assistant', content: string) => Promise<void>;

const itemText = (o: DreamOrder) => o.items.map((i) => `${i.name}x${i.quantity}`).join('、');

const messageFor = (o: DreamOrder, s: OrderStatus): { role: 'user' | 'assistant'; content: string } | null => {
  const items = itemText(o);
  if (o.buyer === 'user') {
    if (s === 'shipped') return { role: 'user', content: `【梦阁物流】我给你买的${items}已经发货啦📦` };
    if (s === 'delivered') return { role: 'user', content: `【梦阁物流】我给你买的${items}送到了，快去签收吧～` };
    if (s === 'signed') return { role: 'user', content: `【梦阁物流】你已签收我送的${items}🎁` };
  } else {
    if (s === 'shipped') return { role: 'assistant', content: `我给你买的${items}发货了，等着收吧～` };
    if (s === 'delivered') return { role: 'assistant', content: `快递说${items}送到了，记得签收哦` };
    if (s === 'signed') return { role: 'user', content: `【梦阁物流】我签收了你送我的${items}，谢谢你💝` };
  }
  return null;
};

/** 推进订单状态，并把新状态通知到聊天 */
export const processOrders = async (uid: string, write: ChatWriter): Promise<DreamOrder[]> => {
  const orders = loadOrders(uid);
  let changed = false;
  for (const o of orders) {
    let next = timeStatus(o);
    // 我买给角色的：送达后角色自动签收
    if (o.buyer === 'user' && next === 'delivered') { next = 'signed'; o.signedAt = Date.now(); }
    if (next !== o.status) { o.status = next; changed = true; }
    while (ORDER.indexOf(o.notified) < ORDER.indexOf(o.status)) {
      const s = ORDER[ORDER.indexOf(o.notified) + 1];
      const msg = messageFor(o, s);
      if (msg) { try { await write(o.characterId, msg.role, msg.content); } catch (e) { console.warn(e); } }
      o.notified = s;
      changed = true;
    }
  }
  if (changed) saveOrders(uid, orders);
  return orders;
};

export const signOrder = async (uid: string, orderId: string, write: ChatWriter) => {
  const orders = loadOrders(uid);
  const o = orders.find((x) => x.id === orderId);
  if (!o || o.status !== 'delivered') return orders;
  o.status = 'signed';
  o.signedAt = Date.now();
  saveOrders(uid, orders);
  return processOrders(uid, write);
};

/** 每个角色每天按概率掷一次，命中则角色给用户下单 */
export const rollCharacterPurchases = async (
  uid: string,
  characters: { id: string; name: string }[],
  catalog: { name: string; price: number }[],
  write: ChatWriter,
) => {
  if (!catalog.length) return 0;
  const today = new Date().toDateString();
  let rolls: Record<string, string> = {};
  try { rolls = JSON.parse(localStorage.getItem(rollKey(uid)) || '{}'); } catch { /* ignore */ }
  const probs = loadBuyProbabilities(uid);
  let count = 0;
  for (const c of characters) {
    const p = probs[c.id] ?? 0;
    if (p <= 0 || rolls[c.id] === today) continue;
    rolls[c.id] = today;
    if (Math.random() * 100 >= p) continue;
    const item = catalog[Math.floor(Math.random() * catalog.length)];
    createOrder(uid, {
      buyer: 'character', characterId: c.id, characterName: c.name,
      items: [{ name: item.name, price: item.price, quantity: 1 }], total: item.price,
    });
    try { await write(c.id, 'assistant', `我偷偷在梦阁给你下单了${item.name}，已经付款啦，等发货吧😌`); } catch (e) { console.warn(e); }
    count++;
  }
  localStorage.setItem(rollKey(uid), JSON.stringify(rolls));
  return count;
};
