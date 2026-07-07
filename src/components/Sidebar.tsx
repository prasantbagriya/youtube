import React from "react";
import { Home, Compass, PlaySquare, Clock, ThumbsUp, History, MonitorPlay, Settings, LogOut } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  activeTab: string;
  onTabSelect: (tab: string) => void;
  accessToken?: string | null;
  onClose?: () => void;
}

export function Sidebar({ isOpen, activeTab, onTabSelect, accessToken, onClose }: SidebarProps) {
  const handleLogout = () => {
    localStorage.removeItem('yt_access_token');
    localStorage.removeItem('yt_token_expiry');
    window.location.reload();
  };

  return (
    <>
      {/* Mini sidebar (desktop only) */}
      <aside className={`w-[72px] h-[calc(100vh-56px)] bg-white hidden sm:flex flex-col items-center py-1 flex-shrink-0 overflow-hidden ${isOpen ? 'sm:hidden' : 'sm:flex'}`}>
        <MiniSidebarItem icon={<Home size={24} strokeWidth={1.5} />} label="Home" onClick={() => onTabSelect("Home")} active={activeTab === "Home"} />
        <MiniSidebarItem icon={<Compass size={24} strokeWidth={1.5} />} label="Shorts" onClick={() => onTabSelect("Shorts")} active={activeTab === "Shorts"} />
        <MiniSidebarItem icon={<MonitorPlay size={24} strokeWidth={1.5} />} label="Subscriptions" onClick={() => onTabSelect("Subscriptions")} active={activeTab === "Subscriptions"} />
        <MiniSidebarItem icon={<PlaySquare size={24} strokeWidth={1.5} />} label="You" onClick={() => onTabSelect("You")} active={activeTab === "You"} />
        {accessToken && (
          <MiniSidebarItem icon={<LogOut size={24} strokeWidth={1.5} />} label="Logout" onClick={handleLogout} />
        )}
      </aside>

      {/* Mobile Backdrop */}
      <div 
        className={`sm:hidden fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={onClose}
      />
      
      {/* Full sidebar (Desktop) or Mobile Drawer */}
      <aside className={`w-[240px] h-full sm:h-[calc(100vh-56px)] bg-white flex flex-col py-3 flex-shrink-0 overflow-y-auto hover:scrollbar-thin scrollbar-thumb-gray-300
        fixed sm:relative top-0 left-0 z-[70] sm:z-auto transition-transform duration-300 sm:transform-none pt-safe
        ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'} ${isOpen ? 'sm:flex' : 'hidden sm:hidden'}
      `}>
        {/* Mobile Logo Header */}
        <div className="sm:hidden flex items-center gap-1 px-4 mb-4 pb-2 border-b border-[#e5e5e5]">
          <div className="w-8 h-6 bg-[#FF0000] rounded-lg flex items-center justify-center">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
          </div>
          <span className="font-semibold text-lg tracking-tighter text-[#0f0f0f] -ml-0.5">YouTube</span>
        </div>

        <div className="flex flex-col border-b border-[#e5e5e5] pb-3 mb-3">
          <SidebarItem icon={<Home size={24} strokeWidth={1.5} />} label="Home" onClick={() => { onTabSelect("Home"); onClose?.(); }} active={activeTab === "Home"} />
          <SidebarItem icon={<Compass size={24} strokeWidth={1.5} />} label="Shorts" onClick={() => { onTabSelect("Shorts"); onClose?.(); }} active={activeTab === "Shorts"} />
          <SidebarItem icon={<MonitorPlay size={24} strokeWidth={1.5} />} label="Subscriptions" onClick={() => { onTabSelect("Subscriptions"); onClose?.(); }} active={activeTab === "Subscriptions"} />
        </div>
        
        <div className="flex flex-col pb-3 mb-3 border-b border-[#e5e5e5]">
          <h3 className="px-3 py-2 text-base font-bold text-[#0f0f0f] flex items-center gap-2 hover:bg-black/5 rounded-lg mx-3 cursor-pointer">
            You <span className="text-[10px]">▶</span>
          </h3>
          <SidebarItem icon={<History size={24} strokeWidth={1.5} />} label="History" />
          <SidebarItem icon={<PlaySquare size={24} strokeWidth={1.5} />} label="Your videos" />
          <SidebarItem icon={<Clock size={24} strokeWidth={1.5} />} label="Watch later" onClick={() => { onTabSelect("Watch later"); onClose?.(); }} active={activeTab === "Watch later"} />
          <SidebarItem icon={<ThumbsUp size={24} strokeWidth={1.5} />} label="Liked videos" />
        </div>

        <div className="flex flex-col pb-3 mb-3 border-b border-[#e5e5e5]">
          <SidebarItem icon={<Settings size={24} strokeWidth={1.5} />} label="Settings" onClick={() => { onTabSelect("Settings"); onClose?.(); }} active={activeTab === "Settings"} />
          {accessToken && (
            <SidebarItem icon={<LogOut size={24} strokeWidth={1.5} />} label="Logout" onClick={handleLogout} />
          )}
        </div>
      </aside>
    </>
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
