import React, { useState, useRef } from 'react';
import { Download, Upload, Loader2, FileDown, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { exportAllCharacters, downloadExportFile, readImportFile, importData, ExportPackage } from '@/utils/dataMigration';

const DataMigrationCard: React.FC = () => {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPackage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAll = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const data = await exportAllCharacters(user.id);
      if (!data || data.characters.length === 0) {
        toast.error('没有可导出的角色数据');
        return;
      }
      downloadExportFile(data);
      const totalMsgs = data.characters.reduce((sum, c) => sum + c.messages.length, 0);
      toast.success(`已导出 ${data.characters.length} 个角色，${totalMsgs} 条消息`);
    } catch (e) {
      toast.error('导出失败: ' + (e instanceof Error ? e.message : '未知错误'));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readImportFile(file);
      setPreviewData(data);
      setShowImportDialog(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '文件读取失败');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!user || !previewData) return;
    setImporting(true);
    try {
      const result = await importData(user.id, previewData, (current, total, name) => {
        setImportProgress(`正在导入 ${name} (${current}/${total})`);
      });
      setShowImportDialog(false);
      setPreviewData(null);
      if (result.success > 0) {
        toast.success(`成功导入 ${result.success} 个角色${result.failed > 0 ? `，${result.failed} 个失败` : ''}`);
      }
      if (result.errors.length > 0) {
        toast.error(result.errors.join('\n'), { duration: 10000 });
      }
    } catch (e) {
      toast.error('导入失败: ' + (e instanceof Error ? e.message : '未知错误'));
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  return (
    <>
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileDown className="w-4 h-4 text-primary" />
          数据迁移
        </h3>
        <p className="text-xs text-muted-foreground">
          导出角色和聊天记录到文件，在新账号导入后角色不会失忆
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl"
            onClick={handleExportAll}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
            导出全部
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
            导入数据
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认导入</DialogTitle>
            <DialogDescription>
              {previewData && (
                <span>
                  将导入 <strong>{previewData.characters.length}</strong> 个角色及其聊天记录。
                  导出时间：{new Date(previewData.exported_at).toLocaleString('zh-CN')}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {previewData.characters.map((c, i) => (
                <div key={i} className="text-sm flex justify-between px-2 py-1 bg-muted/50 rounded">
                  <span>{c.character.name}</span>
                  <span className="text-muted-foreground">{c.messages.length} 条消息</span>
                </div>
              ))}
            </div>
          )}
          {importProgress && (
            <div className="text-sm text-primary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {importProgress}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(false)} disabled={importing}>
              取消
            </Button>
            <Button size="sm" onClick={handleImport} disabled={importing}>
              {importing ? '导入中...' : '确认导入'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataMigrationCard;
