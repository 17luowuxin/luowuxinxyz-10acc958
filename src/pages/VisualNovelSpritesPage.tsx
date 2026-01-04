import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SpriteManager from "@/components/visual-novel/SpriteManager";

const VisualNovelSpritesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm">
      <header className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold">立绘管理</h1>
        </div>
      </header>

      <main className="p-4 pb-24">
        <section aria-label="立绘管理">
          <SpriteManager />
        </section>
      </main>
    </div>
  );
};

export default VisualNovelSpritesPage;
