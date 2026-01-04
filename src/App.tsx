import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MusicProvider } from "@/contexts/MusicContext";
import PhoneFrame from "@/components/phone/PhoneFrame";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import AlbumPage from "./pages/AlbumPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import CustomizePage from "./pages/CustomizePage";
import FriendsPage from "./pages/FriendsPage";
import ChatPage from "./pages/ChatPage";
import SpacePage from "./pages/SpacePage";
import GamesPage from "./pages/GamesPage";
import GroupPage from "./pages/GroupPage";
import GroupChatPage from "./pages/GroupChatPage";
import MusicPage from "./pages/MusicPage";
import BottlePage from "./pages/BottlePage";
import CameraPage from "./pages/CameraPage";
import WerewolfPage from "./pages/WerewolfPage";
import ScriptMurderPage from "./pages/ScriptMurderPage";
import TruthDarePage from "./pages/TruthDarePage";
import RiddlePage from "./pages/RiddlePage";
import DiaryPage from "./pages/DiaryPage";
import StatsPage from "./pages/StatsPage";
import WorkshopPage from "./pages/WorkshopPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import FinancePage from "./pages/FinancePage";
import GiftShopPage from "./pages/GiftShopPage";
import VisualNovelPage from "./pages/VisualNovelPage";
import VisualNovelSpritesPage from "./pages/VisualNovelSpritesPage";
import RequireAuth from "@/components/auth/RequireAuth";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { useEffect } from "react";

const queryClient = new QueryClient();

// Component to load global settings
const GlobalSettingsLoader = ({ children }: { children: React.ReactNode }) => {
  useGlobalSettings();
  return <>{children}</>;
};

// Wrapper component for pages that need global background
const WithPhoneFrame = ({ children }: { children: React.ReactNode }) => (
  <PhoneFrame>{children}</PhoneFrame>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GlobalSettingsLoader>
        <MusicProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/home" element={<Index />} />
                <Route path="/lock" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/album" element={<WithPhoneFrame><AlbumPage /></WithPhoneFrame>} />
                <Route path="/profile" element={<WithPhoneFrame><ProfilePage /></WithPhoneFrame>} />
                <Route path="/settings" element={<WithPhoneFrame><SettingsPage /></WithPhoneFrame>} />
                <Route path="/customize" element={<WithPhoneFrame><CustomizePage /></WithPhoneFrame>} />
                <Route path="/friends" element={<WithPhoneFrame><FriendsPage /></WithPhoneFrame>} />
                <Route path="/chat/:characterId" element={<WithPhoneFrame><ChatPage /></WithPhoneFrame>} />
                <Route path="/space" element={<WithPhoneFrame><SpacePage /></WithPhoneFrame>} />
                <Route path="/games" element={<WithPhoneFrame><GamesPage /></WithPhoneFrame>} />
                <Route path="/werewolf" element={<WithPhoneFrame><WerewolfPage /></WithPhoneFrame>} />
                <Route path="/script-murder" element={<WithPhoneFrame><ScriptMurderPage /></WithPhoneFrame>} />
                <Route path="/truth-dare" element={<WithPhoneFrame><TruthDarePage /></WithPhoneFrame>} />
                <Route path="/riddle" element={<WithPhoneFrame><RiddlePage /></WithPhoneFrame>} />
                <Route path="/group" element={<WithPhoneFrame><GroupPage /></WithPhoneFrame>} />
                <Route path="/group-chat/:groupId" element={<WithPhoneFrame><GroupChatPage /></WithPhoneFrame>} />
                <Route path="/music" element={<WithPhoneFrame><MusicPage /></WithPhoneFrame>} />
                <Route path="/bottle" element={<WithPhoneFrame><BottlePage /></WithPhoneFrame>} />
                <Route path="/camera" element={<WithPhoneFrame><CameraPage /></WithPhoneFrame>} />
                <Route path="/diary" element={<WithPhoneFrame><DiaryPage /></WithPhoneFrame>} />
                <Route path="/stats" element={<WithPhoneFrame><StatsPage /></WithPhoneFrame>} />
                <Route path="/workshop" element={<WithPhoneFrame><WorkshopPage /></WithPhoneFrame>} />
                <Route path="/privacy" element={<WithPhoneFrame><PrivacyPage /></WithPhoneFrame>} />
                <Route path="/terms" element={<WithPhoneFrame><TermsPage /></WithPhoneFrame>} />
                <Route path="/finance" element={<WithPhoneFrame><FinancePage /></WithPhoneFrame>} />
                <Route path="/gift-shop" element={<WithPhoneFrame><GiftShopPage /></WithPhoneFrame>} />
                <Route
                  path="/visual-novel"
                  element={
                    <WithPhoneFrame>
                      <RequireAuth>
                        <VisualNovelPage />
                      </RequireAuth>
                    </WithPhoneFrame>
                  }
                />
                <Route
                  path="/visual-novel/sprites"
                  element={
                    <WithPhoneFrame>
                      <RequireAuth>
                        <VisualNovelSpritesPage />
                      </RequireAuth>
                    </WithPhoneFrame>
                  }
                />
                <Route
                  path="/visual-novel/:characterId"
                  element={
                    <WithPhoneFrame>
                      <RequireAuth>
                        <VisualNovelPage />
                      </RequireAuth>
                    </WithPhoneFrame>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </MusicProvider>
      </GlobalSettingsLoader>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
