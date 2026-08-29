import React, { useEffect, useRef, useState } from 'react';
import { Cloud, Download, HardDrive, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { copyCloudDataToLocal } from '@/utils/cloudToLocalMigration';
import {
  createLocalBackup,
  downloadLocalBackup,
  getLocalStorageStatus,
  importLocalBackup,
  isLocalModeEnabled,
  LocalBackupPackage,
  requestPersistentLocalStorage,
  setLocalModeEnabled,
} from '@/lib/localDataStore';

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const DataMigrationCard: React.FC = () => {
  const { user } = useAuth();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [localReady, setLocalReady] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [skippedTables, setSkippedTables] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setLocalMode(null);
      return;
    }

    isLocalModeEnabled(user.id)
      .then((enabled) => {
        setLocalMode(enabled);
        // Cloud users must export again in this visit before local mode can be enabled.
        setLocalReady(false);
        setWarnings([]);
        setSkippedTables([]);
      })
      .catch(() => setLocalMode(false));
  }, [user?.id]);

  const exportPreparedBackup = async () => {
    if (!user) return;
    const backup = await createLocalBackup(user.id);
    const recordCount = Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0);
    if (recordCount === 0) throw new Error('没有可导出的数据');
    downloadLocalBackup(backup);
    return { recordCount, assetCount: backup.assets.length };
  };

  const handleExport = async () => {
    if (!user || localMode === null || exporting) return;
    setExporting(true);
    setWarnings([]);
    setSkippedTables([]);
    try {
      if (!localMode) {
        const result = await copyCloudDataToLocal(user.id, (label, current, total) => {
          setProgress(`正在整理${label}（${current}/${total}）`);
        });
        setLocalReady(result.completed);
        setWarnings(result.warnings);
        setSkippedTables(result.skippedTables);
        if (!result.completed) {
          toast.error('数据尚未完整复制，请查看失败详情后重新导出', { duration: 8000 });
          return;
        }
      }
      setProgress('正在生成备份文件...');
      const exported = await exportPreparedBackup();
      toast.success(`完整备份已保存到下载文件夹，共 ${exported.recordCount} 条记录和 ${exported.assetCount} 个文件`);
    } catch (error) {
      toast.error(`导出失败：${error instanceof Error ? error.message : '未知错误'}`);
      setLocalReady(false);
    } finally {
      setProgress('');
      setExporting(false);
    }
  };

  const handleEnableLocalMode = async () => {
    if (!user || localMode || !localReady || exporting) return;
    if (!window.confirm('确认开始使用本机数据？云端原数据会保留，不会删除。')) return;
    await setLocalModeEnabled(user.id, true);
    const persisted = await requestPersistentLocalStorage();
    setLocalMode(true);
    toast.success(persisted ? '已开始使用本机数据' : '已开始使用本机数据，请定期导出备份');
    setTimeout(() => window.location.reload(), 500);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !localMode) return;
    try {
      const currentStorage = await getLocalStorageStatus();
      const available = currentStorage?.quota ? currentStorage.quota - currentStorage.usage : null;
      if (available !== null && file.size > available) {
        toast.error(`本机空间不足：备份约 ${formatBytes(file.size)}，当前剩余约 ${formatBytes(available)}`);
        return;
      }
      if (!window.confirm('导入会替换这台设备上的现有本机数据，确认继续吗？')) return;
      const parsed = JSON.parse(await file.text()) as LocalBackupPackage;
      const result = await importLocalBackup(user.id, parsed);
      toast.success(`已导入 ${result.records} 条数据和 ${result.assets} 个文件`);
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error(`导入失败：${error instanceof Error ? error.message : '备份文件无效'}`);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 space-y-3 border border-emerald-100">
      <div className="flex items-start gap-2">
        {localMode ? (
          <HardDrive className="w-4 h-4 text-amber-600 mt-0.5" />
        ) : (
          <Cloud className="w-4 h-4 text-emerald-600 mt-0.5" />
        )}
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{localMode ? '本机数据保护' : '云端数据保存'}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {localMode
              ? '这台设备以前已启用本机保存。为避免丢失本机新增记录，系统不会强制切回云端。'
              : '默认继续使用云端，只有完成导出并点击第二步才会切换。'}
          </p>
        </div>
        {localMode !== null && <ShieldCheck className="w-5 h-5 text-emerald-500" aria-label="数据模式已确认" />}
      </div>

      {localMode === null && <p className="text-xs text-muted-foreground text-center">正在检查数据保存方式...</p>}

      {localMode === false && (
        <>
          <p className="text-xs text-emerald-700 bg-emerald-50/80 rounded-lg px-2 py-1.5">
            先把云端数据下载成备份文件，确认安全后再选择是否使用本机数据。
          </p>
          <Button variant="outline" size="sm" className="w-full rounded-xl border-emerald-200 text-emerald-700" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
            {exporting ? '正在导出...' : '1. 一键导出云端数据'}
          </Button>
          {progress && <p className="text-xs text-emerald-700 text-center">{progress}</p>}
          <Button size="sm" className="w-full rounded-xl" onClick={handleEnableLocalMode} disabled={!localReady || exporting}>
            {warnings.length > 0 ? '2. 数据未完整，暂不能切换' : '2. 开始使用本机数据'}
          </Button>
        </>
      )}

      {localMode === true && (
        <>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              {exporting ? '导出中' : '一键导出'}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => backupInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />
              一键导入
            </Button>
          </div>
          <input ref={backupInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          <p className="text-[11px] text-amber-700 bg-amber-50/80 rounded-lg px-2 py-1.5">
            卸载浏览器或清除网站数据前，请先导出备份；备份内含 API 密钥，请妥善保管。
          </p>
        </>
      )}

      {skippedTables.length > 0 && (
        <p className="text-[11px] text-muted-foreground bg-gray-50/80 rounded-lg px-2 py-1.5">
          已自动跳过未启用的空功能：{skippedTables.join('、')}
        </p>
      )}

      {warnings.length > 0 && (
        <details className="rounded-lg bg-red-50/80 px-2 py-1.5 text-[11px] text-red-700">
          <summary className="cursor-pointer font-medium">有 {warnings.length} 项未复制，必须处理后才能迁移</summary>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
          </ul>
        </details>
      )}

      {localMode === false && (
        <p className="text-[11px] text-amber-700 bg-amber-50/80 rounded-lg px-2 py-1.5">
          备份包含聊天、图片和 API 密钥，请妥善保管，不要发送给他人。
        </p>
      )}
    </div>
  );
};

export default DataMigrationCard;
