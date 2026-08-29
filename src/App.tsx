import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MusicProvider } from "@/contexts/MusicContext";
import PhoneFrame from "@/components/phone/PhoneFrame";
import RequireAuth from "@/components/auth/RequireAuth";
import ForcedCloudMigrationGate from "@/components/data/ForcedCloudMigrationGate";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import React, { lazy, Suspense } from "react";

const AlbumPage = lazy(() => import("./pages/AlbumPage"));
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CustomizePage = lazy(() => import("./pages/CustomizePage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const SpacePage = lazy(() => import("./pages/SpacePage"));
const GamesPage = lazy(() => import("./pages/GamesPage"));
const GroupPage = lazy(() => import("./pages/GroupPage"));
const GroupChatPage = lazy(() => import("./pages/GroupChatPage"));
const MusicPage = lazy(() => import("./pages/MusicPage"));
const BottlePage = lazy(() => import("./pages/BottlePage"));
const CameraPage = lazy(() => import("./pages/CameraPage"));
const WerewolfPage = lazy(() => import("./pages/WerewolfPage"));
const ScriptMurderPage = lazy(() => import("./pages/ScriptMurderPage"));
const TruthDarePage = lazy(() => import("./pages/TruthDarePage"));
const RiddlePage = lazy(() => import("./pages/RiddlePage"));
const DiaryPage = lazy(() => import("./pages/DiaryPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const WorkshopPage = lazy(() => import("./pages/WorkshopPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const FinancePage = lazy(() => import("./pages/FinancePage"));
const GiftShopPage = lazy(() => import("./pages/GiftShopPage"));
const VisualNovelPage = lazy(() => import("./pages/VisualNovelPage"));
const VisualNovelSpritesPage = lazy(() => import("./pages/VisualNovelSpritesPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Component to load global settings
const GlobalSettingsLoader = ({ children }: { children: React.ReactNode }) => {
  useGlobalSettings();
  return <>{children}</>;
};

// Wrapper component for pages that need global background
const WithPhoneFrame = ({ children }: { children: React.ReactNode }) => (
  <PhoneFrame>{children}</PhoneFrame>
);

const ProtectedPhoneFrame = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth><PhoneFrame>{children}</PhoneFrame></RequireAuth>
);

const RouteLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const App = () => (
  <AuthProvider>
    <ForcedCloudMigrationGate>
      <GlobalSettingsLoader>
        <MusicProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/home" element={<Index />} />
                <Route path="/lock" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/album" element={<ProtectedPhoneFrame><AlbumPage /></ProtectedPhoneFrame>} />
                <Route path="/profile" element={<ProtectedPhoneFrame><ProfilePage /></ProtectedPhoneFrame>} />
                <Route path="/settings" element={<ProtectedPhoneFrame><SettingsPage /></ProtectedPhoneFrame>} />
                <Route path="/customize" element={<ProtectedPhoneFrame><CustomizePage /></ProtectedPhoneFrame>} />
                <Route path="/friends" element={<ProtectedPhoneFrame><FriendsPage /></ProtectedPhoneFrame>} />
                <Route path="/chat/:characterId" element={<ProtectedPhoneFrame><ChatPage /></ProtectedPhoneFrame>} />
                <Route path="/space" element={<ProtectedPhoneFrame><SpacePage /></ProtectedPhoneFrame>} />
                <Route path="/games" element={<ProtectedPhoneFrame><GamesPage /></ProtectedPhoneFrame>} />
                <Route path="/werewolf" element={<ProtectedPhoneFrame><WerewolfPage /></ProtectedPhoneFrame>} />
                <Route path="/script-murder" element={<ProtectedPhoneFrame><ScriptMurderPage /></ProtectedPhoneFrame>} />
                <Route path="/truth-dare" element={<ProtectedPhoneFrame><TruthDarePage /></ProtectedPhoneFrame>} />
                <Route path="/riddle" element={<ProtectedPhoneFrame><RiddlePage /></ProtectedPhoneFrame>} />
                <Route path="/group" element={<ProtectedPhoneFrame><GroupPage /></ProtectedPhoneFrame>} />
                <Route path="/group-chat/:groupId" element={<ProtectedPhoneFrame><GroupChatPage /></ProtectedPhoneFrame>} />
                <Route path="/music" element={<ProtectedPhoneFrame><MusicPage /></ProtectedPhoneFrame>} />
                <Route path="/bottle" element={<ProtectedPhoneFrame><BottlePage /></ProtectedPhoneFrame>} />
                <Route path="/camera" element={<ProtectedPhoneFrame><CameraPage /></ProtectedPhoneFrame>} />
                <Route path="/diary" element={<ProtectedPhoneFrame><DiaryPage /></ProtectedPhoneFrame>} />
                <Route path="/stats" element={<ProtectedPhoneFrame><StatsPage /></ProtectedPhoneFrame>} />
                <Route path="/workshop" element={<ProtectedPhoneFrame><WorkshopPage /></ProtectedPhoneFrame>} />
                <Route path="/privacy" element={<WithPhoneFrame><PrivacyPage /></WithPhoneFrame>} />
                <Route path="/terms" element={<WithPhoneFrame><TermsPage /></WithPhoneFrame>} />
                <Route path="/finance" element={<ProtectedPhoneFrame><FinancePage /></ProtectedPhoneFrame>} />
                <Route path="/gift-shop" element={<ProtectedPhoneFrame><GiftShopPage /></ProtectedPhoneFrame>} />
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
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </MusicProvider>
      </GlobalSettingsLoader>
    </ForcedCloudMigrationGate>
  </AuthProvider>
);

export default App;
