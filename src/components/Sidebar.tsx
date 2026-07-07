import React from "react";
import { Home, Compass, PlaySquare, Clock, ThumbsUp, History, MonitorPlay, Settings, LogOut } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  activeTab: string;
  onTabSelect: (tab: string) => void;
  accessToken?: string | null;
}

export function Sidebar({ isOpen, activeTab, onTabSelect, accessToken }: SidebarProps) {
  const handleLogout = () => {
    localStorage.removeItem('yt_access_token');
    localStorage.removeItem('yt_token_expiry');
    window.location.reload();
  };

  if (!isOpen) {
    // Mini sidebar
    return (
      <aside className="w-[72px] h-[calc(100vh-56px)] mt-14 bg-white hidden sm:flex flex-col items-center py-1 fixed left-0 z-40 overflow-hidden">
        <MiniSidebarItem icon={<Home size={24} strokeWidth={1.5} />} label="Home" onClick={() => onTabSelect("Home")} active={activeTab === "Home"} />
        <MiniSidebarItem icon={<Compass size={24} strokeWidth={1.5} />} label="Shorts" onClick={() => onTabSelect("Shorts")} active={activeTab === "Shorts"} />
        <MiniSidebarItem icon={<MonitorPlay size={24} strokeWidth={1.5} />} label="Subscriptions" onClick={() => onTabSelect("Subscriptions")} active={activeTab === "Subscriptions"} />
        <MiniSidebarItem icon={<PlaySquare size={24} strokeWidth={1.5} />} label="You" onClick={() => onTabSelect("You")} active={activeTab === "You"} />
        {accessToken && (
          <MiniSidebarItem icon={<LogOut size={24} strokeWidth={1.5} />} label="Logout" onClick={handleLogout} />
        )}
      </aside>
    );
  }

  // Full sidebar
  return (
    <aside className="w-[240px] h-[calc(100vh-56px)] mt-14 bg-white hidden sm:flex flex-col py-3 fixed left-0 z-40 overflow-y-auto hover:scrollbar-thin scrollbar-thumb-gray-300">
      <div className="flex flex-col border-b border-[#e5e5e5] pb-3 mb-3">
        <SidebarItem icon={<Home size={24} strokeWidth={1.5} />} label="Home" onClick={() => onTabSelect("Home")} active={activeTab === "Home"} />
        <SidebarItem icon={<Compass size={24} strokeWidth={1.5} />} label="Shorts" onClick={() => onTabSelect("Shorts")} active={activeTab === "Shorts"} />
        <SidebarItem icon={<MonitorPlay size={24} strokeWidth={1.5} />} label="Subscriptions" onClick={() => onTabSelect("Subscriptions")} active={activeTab === "Subscriptions"} />
      </div>
      
      <div className="flex flex-col pb-3 mb-3 border-b border-[#e5e5e5]">
        <h3 className="px-3 py-2 text-base font-bold text-[#0f0f0f] flex items-center gap-2 hover:bg-black/5 rounded-lg mx-3 cursor-pointer">
          You <span className="text-[10px]">▶</span>
        </h3>
        <SidebarItem icon={<History size={24} strokeWidth={1.5} />} label="History" />
        <SidebarItem icon={<PlaySquare size={24} strokeWidth={1.5} />} label="Your videos" />
        <SidebarItem icon={<Clock size={24} strokeWidth={1.5} />} label="Watch later" onClick={() => onTabSelect("Watch later")} active={activeTab === "Watch later"} />
        <SidebarItem icon={<ThumbsUp size={24} strokeWidth={1.5} />} label="Liked videos" />
      </div>

      <div className="flex flex-col pb-3 mb-3 border-b border-[#e5e5e5]">
        <SidebarItem icon={<Settings size={24} strokeWidth={1.5} />} label="Settings" onClick={() => onTabSelect("Settings")} active={activeTab === "Settings"} />
        {accessToken && (
          <SidebarItem icon={<LogOut size={24} strokeWidth={1.5} />} label="Logout" onClick={handleLogout} />
        )}
      </div>
    </aside>
  );
}

function MiniSidebarItem({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick?: () => void, active?: boolean }) {
  return (
    <div 
      onClick={onClick}
      className={`w-16 flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl cursor-pointer hover:bg-black/5 transition-colors ${active ? 'bg-black/5' : ''}`}
    >
      <div className={active ? "text-[#0f0f0f] fill-[#0f0f0f]" : "text-[#0f0f0f]"}>
        {icon}
      </div>
      <span className="text-[10px] text-[#0f0f0f] truncate w-full text-center px-1">{label}</span>
    </div>
  );
}

function SidebarItem({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick?: () => void, active?: boolean }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-5 px-3 py-2 mx-3 rounded-lg cursor-pointer hover:bg-black/5 transition-colors ${active ? 'bg-black/5 font-medium' : 'font-normal'}`}
    >
      <div className={active ? "text-[#0f0f0f] fill-[#0f0f0f]" : "text-[#0f0f0f]"}>
        {icon}
      </div>
      <span className="text-sm text-[#0f0f0f] truncate">{label}</span>
    </div>
  );
}
