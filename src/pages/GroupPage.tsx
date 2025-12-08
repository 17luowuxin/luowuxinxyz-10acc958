import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GroupPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-xl font-bold ml-2">群聊</h1>
      </div>
      <div className="text-center py-20 text-muted-foreground">
        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>创建群聊，和多个AI好友一起聊天</p>
      </div>
    </div>
  );
};
export default GroupPage;
