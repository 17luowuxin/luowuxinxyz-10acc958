import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/album" element={<AlbumPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/customize" element={<CustomizePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/chat/:characterId" element={<ChatPage />} />
            <Route path="/space" element={<SpacePage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/werewolf" element={<WerewolfPage />} />
            <Route path="/script-murder" element={<ScriptMurderPage />} />
            <Route path="/group" element={<GroupPage />} />
            <Route path="/group-chat/:groupId" element={<GroupChatPage />} />
            <Route path="/music" element={<MusicPage />} />
            <Route path="/bottle" element={<BottlePage />} />
            <Route path="/camera" element={<CameraPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
