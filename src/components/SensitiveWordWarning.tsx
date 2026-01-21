import React from 'react';
import { AlertTriangle, ShieldAlert, Info, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DetectionResult, getSeverityLabel, getSeverityColor, getCategoryLabel } from '@/utils/sensitiveWordChecker';

interface SensitiveWordWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: DetectionResult;
  onConfirm: () => void;
  onCancel: () => void;
  onAutoReplace?: () => void;  // 一键替换回调
}

const SensitiveWordWarning: React.FC<SensitiveWordWarningProps> = ({
  open,
  onOpenChange,
  result,
  onConfirm,
  onCancel,
  onAutoReplace,
}) => {
  const hasHighRisk = result.summary.high > 0;
  
  // 计算可以被自动替换的词数量（排除"建议避免"类的）
  const replaceableCount = result.words.filter(w => 
    !w.suggestion.includes('建议避免') && 
    !w.suggestion.includes('禁止') && 
    !w.suggestion.includes('警告')
  ).length;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-500">
            <ShieldAlert className="w-5 h-5" />
            检测到敏感词汇
          </DialogTitle>
          <DialogDescription>
            人设中包含可能触发API内容过滤的词汇，这可能导致AI无法回复。
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 风险统计 */}
          <div className="flex gap-4 p-3 bg-muted/50 rounded-lg text-sm">
            {result.summary.high > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-red-500 font-medium">高风险: {result.summary.high}</span>
              </div>
            )}
            {result.summary.medium > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full" />
                <span className="text-orange-500 font-medium">中风险: {result.summary.medium}</span>
              </div>
            )}
            {result.summary.low > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span className="text-yellow-500 font-medium">低风险: {result.summary.low}</span>
              </div>
            )}
          </div>
          
          {/* 一键替换按钮 */}
          {onAutoReplace && replaceableCount > 0 && (
            <Button 
              onClick={onAutoReplace}
              variant="secondary"
              className="w-full gap-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30"
            >
              <Wand2 className="w-4 h-4" />
              一键替换为隐晦表达（{replaceableCount}处）
            </Button>
          )}
          
          {/* 敏感词列表 */}
          <ScrollArea className="max-h-[180px]">
            <div className="space-y-2">
              {result.words.map((word, index) => {
                const canReplace = !word.suggestion.includes('建议避免') && 
                                   !word.suggestion.includes('禁止') && 
                                   !word.suggestion.includes('警告');
                return (
                  <div 
                    key={`${word.word}-${index}`}
                    className="p-2 bg-muted/30 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${getSeverityColor(word.severity)}`}>
                        「{word.word}」
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {getCategoryLabel(word.category)} · {getSeverityLabel(word.severity)}
                      </span>
                      {canReplace && (
                        <span className="text-xs bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded">
                          可替换
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-start gap-1">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>
                        {canReplace ? (
                          <>将替换为：<span className="text-green-600 font-medium">{word.suggestion.split('/')[0].split('（')[0].trim()}</span></>
                        ) : (
                          <>建议：{word.suggestion}</>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          
          {/* 提示信息 */}
          <div className="p-3 bg-blue-500/10 rounded-lg text-xs text-blue-600 dark:text-blue-400">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">为什么会被过滤？</p>
                <p>部分API提供商（如OpenAI、Azure及某些中转站）会对敏感内容进行审核，导致AI返回空白。</p>
                <p className="font-medium mt-2">解决方案：</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>点击"一键替换"自动使用隐晦表达</li>
                  <li>手动修改人设中的敏感词</li>
                  <li>更换支持NSFW的API中转站</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="sm:flex-1">
            返回修改
          </Button>
          <Button 
            onClick={onConfirm}
            variant={hasHighRisk ? "destructive" : "default"}
            className="sm:flex-1"
          >
            {hasHighRisk ? '仍然保存（风险自负）' : '继续保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SensitiveWordWarning;
