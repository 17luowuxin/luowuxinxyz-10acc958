import React from 'react';
import { AlertTriangle, ShieldAlert, Info } from 'lucide-react';
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
}

const SensitiveWordWarning: React.FC<SensitiveWordWarningProps> = ({
  open,
  onOpenChange,
  result,
  onConfirm,
  onCancel,
}) => {
  const hasHighRisk = result.summary.high > 0;
  
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
          
          {/* 敏感词列表 */}
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {result.words.map((word, index) => (
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
                  </div>
                  <div className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>建议替换为：{word.suggestion}</span>
                  </div>
                </div>
              ))}
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
                  <li>使用上方建议的替代词汇</li>
                  <li>用隐晦/暗示性的表达方式</li>
                  <li>更换支持NSFW的API中转站</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel}>
            返回修改
          </Button>
          <Button 
            onClick={onConfirm}
            variant={hasHighRisk ? "destructive" : "default"}
          >
            {hasHighRisk ? '仍然保存（风险自负）' : '我已了解，继续保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SensitiveWordWarning;
