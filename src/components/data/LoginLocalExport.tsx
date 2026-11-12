import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createLocalBackup, listLocalBackupAccounts } from '@/lib/localDataStore';
import { deliverRescueBackup, selectRescueBackup } from '@/lib/rescueBackup';

export function LoginLocalExport() {
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof listLocalBackupAccounts>>>([]);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const inspect = async () => {
    setBusy(true);
    setError('');
    setFile(null);
    try {
      setAccounts(await listLocalBackupAccounts());
      setChecked(true);
    } catch {
      setError('无法读取本机资料，请使用原来保存数据的浏览器。');
    } finally { setBusy(false); }
  };

  const prepare = async (userId: string) => {
    setBusy(true);
    setFile(null);
    setError('');
    try {
      const backup = selectRescueBackup(await createLocalBackup(userId));
      if (!Object.keys(backup.tables).length && !backup.assets.length) {
        setError('该本机账号没有可导出的角色、聊天或表情包。');
        return;
      }
      setFile(new File([JSON.stringify(backup)], `本机角色聊天表情包-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' }));
    } catch { setError('整理备份失败，请重试；请勿清理浏览器数据。'); }
    finally { setBusy(false); }
  };

  return <div className="mt-5 border-t border-border pt-4 space-y-3">
    <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={inspect}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      检查并导出本机资料（无需登录）
    </Button>
    <p className="text-xs text-muted-foreground leading-relaxed">仅限此手机、此浏览器、此网址已保存的资料；云端资料需要服务恢复后才能导出。图片未保存到本机时，备份只包含图片链接。</p>
    {checked && accounts.length === 0 && <p role="status" className="text-sm text-muted-foreground">未找到本机资料，不代表云端数据丢失。请勿卸载应用或清理浏览器。</p>}
    {accounts.map(account => <div key={account.userId} className="space-y-1">
      <p className="text-sm break-all">{account.label} · {account.records} 条资料 · {account.assets} 个本机文件</p>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => prepare(account.userId)}>整理此账号备份</Button>
    </div>)}
    {file && <Button type="button" className="w-full" onClick={() => { deliverRescueBackup(file).catch(() => setError('保存失败，请重试。')); }}><Download className="mr-2 h-4 w-4" />保存备份文件</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}