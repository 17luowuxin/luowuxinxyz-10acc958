import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();

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
          <Shield className="w-5 h-5 text-purple-500" />
          <h1 className="text-lg font-bold text-purple-700">隐私政策</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-purple-100/50">
          <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
            <p className="text-sm text-gray-500">最后更新日期：2026年8月19日</p>
            
            <h2 className="text-base font-bold text-purple-700 mt-4">1. 信息收集</h2>
            <p className="text-sm leading-relaxed">
              服务器仅保存登录所需的账户信息、邀请码和权限信息。启用本机模式后，角色、对话、日记、图片、API 设置等内容保存在您的设备中。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">2. 信息使用</h2>
            <p className="text-sm leading-relaxed">
              当您主动使用 AI 对话、画图、语音等功能时，当前请求所需的内容会发送到对应的接口进行处理。请勿在提示词中填写不希望交给接口处理的敏感信息。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">3. 信息存储</h2>
            <p className="text-sm leading-relaxed">
              本机内容使用浏览器本地数据库保存，不占用开发者云数据库。迁移前已有的云端旧记录会保留且不再更新，以避免迁移时丢失；清除浏览器数据或卸载前请先导出备份。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">4. 信息共享</h2>
            <p className="text-sm leading-relaxed">
              我们不会出售您的个人内容。AI、图片、语音等功能会按您的操作把必要请求发送给您选择的第三方接口服务商。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">5. 数据安全</h2>
            <p className="text-sm leading-relaxed">
              本机备份文件可能包含聊天内容和 API 密钥，请由您自行妥善保管，不要发送给不可信的人。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">6. 您的权利</h2>
            <p className="text-sm leading-relaxed">
              您可以在应用中修改本机内容，并可在设置中一键导出或导入完整备份。账户和历史云端记录相关请求可联系管理员处理。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">7. 政策更新</h2>
            <p className="text-sm leading-relaxed">
              我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，并在生效前通知您。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">8. 联系我们</h2>
            <p className="text-sm leading-relaxed">
              如果您对本隐私政策有任何疑问，请通过应用内反馈功能联系我们。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
