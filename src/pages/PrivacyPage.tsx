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
            <p className="text-sm text-gray-500">最后更新日期：2025年1月1日</p>
            
            <h2 className="text-base font-bold text-purple-700 mt-4">1. 信息收集</h2>
            <p className="text-sm leading-relaxed">
              我们收集您在使用本应用时提供的信息，包括但不限于：账户信息（邮箱地址）、用户创建的内容（角色设定、对话记录、日记等）、自定义设置。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">2. 信息使用</h2>
            <p className="text-sm leading-relaxed">
              我们使用收集的信息用于：提供、维护和改进我们的服务；处理您的请求和交易；发送服务相关通知。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">3. 信息存储</h2>
            <p className="text-sm leading-relaxed">
              您的数据存储在安全的云服务器上。我们采取合理的技术和组织措施来保护您的个人信息。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">4. 信息共享</h2>
            <p className="text-sm leading-relaxed">
              我们不会出售、交易或以其他方式向外部各方转让您的个人信息，除非法律要求或您明确同意。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">5. 数据安全</h2>
            <p className="text-sm leading-relaxed">
              我们实施适当的安全措施来保护您的个人信息免受未经授权的访问、更改、披露或销毁。
            </p>

            <h2 className="text-base font-bold text-purple-700 mt-4">6. 您的权利</h2>
            <p className="text-sm leading-relaxed">
              您有权访问、更正或删除您的个人信息。如需行使这些权利，请通过应用内的设置功能操作或联系我们。
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
