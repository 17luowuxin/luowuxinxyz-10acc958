import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
const TermsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-background/70 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
          className="rounded-full"
        >
          <ChevronLeft className="w-6 h-6 text-purple-600" />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-500" />
          <h1 className="text-lg font-bold text-purple-700">用户协议</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-purple-100/50">
          <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
            <p className="text-sm text-gray-500">最后更新日期：2026年8月19日</p>
            
            <h2 className="text-base font-bold text-purple-700 mt-4">1. 服务条款</h2>
            <p className="text-sm leading-relaxed">
              欢迎使用本应用。使用本应用即表示您同意遵守本用户协议的所有条款和条件。如果您不同意任何条款，请不要使用本应用。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">2. 用户账户</h2>
            <p className="text-sm leading-relaxed">
              您需要创建账户才能使用本应用的完整功能。您有责任维护账户的安全性，并对账户下发生的所有活动负责。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">3. 用户内容</h2>
            <p className="text-sm leading-relaxed">
              您对在本应用中创建的角色、对话、日记等内容负责。启用本机模式后，这些内容保存在您的设备；使用 AI 功能时，您同意发送完成该次请求所必需的内容。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">4. 禁止行为</h2>
            <p className="text-sm leading-relaxed">
              您同意不会：使用本应用进行任何非法活动；上传或分享任何违法、有害或冒犯性的内容；试图未经授权访问系统；干扰或破坏服务的正常运行。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">5. 知识产权</h2>
            <p className="text-sm leading-relaxed">
              本应用及其原始内容、功能和特性均为开发者所有，受国际版权、商标和其他知识产权法律保护。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">6. 免责声明</h2>
            <p className="text-sm leading-relaxed">
              本应用按"现状"提供，不作任何明示或暗示的保证。我们不保证服务不会中断或无错误。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">7. 责任限制</h2>
            <p className="text-sm leading-relaxed">
              在法律允许的最大范围内，开发者对因使用或无法使用本应用而产生的任何损害不承担责任。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">8. 服务变更</h2>
            <p className="text-sm leading-relaxed">
              我们保留随时修改或终止服务的权利，恕不另行通知。我们也可能随时更新本协议。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">9. 法律责任与争议解决</h2>
            <p className="text-sm leading-relaxed">
              如因使用本应用产生任何争议，双方应首先通过友好协商解决。协商不成的，任何一方均可向开发者所在地有管辖权的人民法院提起诉讼。
            </p>
            <p className="text-sm leading-relaxed">
              用户因违反本协议或相关法律法规而导致的任何法律责任，由用户自行承担。如因用户行为给开发者或第三方造成损失，用户应承担相应的赔偿责任。
            </p>
            <p className="text-sm leading-relaxed">
              本协议的订立、执行和解释及争议的解决均应适用中华人民共和国法律。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">10. 联系方式</h2>
            <p className="text-sm leading-relaxed">
              如有任何问题或建议，请通过应用内反馈功能联系我们，或添加微信联系：
            </p>
            <div className="flex items-center gap-2 mt-2 p-3 bg-purple-50 rounded-xl">
              <span className="text-sm font-medium text-purple-700">微信号：XxyLxs9201314</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                onClick={() => {
                  navigator.clipboard.writeText('XxyLxs9201314');
                  toast({ title: '已复制微信号' });
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
