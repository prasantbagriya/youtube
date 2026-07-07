import { Search, Menu, Bell, Video, Mic, ArrowLeft, Clock } from "lucide-react";
import { useState, useEffect, FormEvent, useRef } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { getSuggestions } from "../lib/youtube";

interface HeaderProps {
  onSearch: (query: string) => void;
  onMenuClick: () => void;
  onHomeClick: () => void;
  accessToken: string | null;
  setAccessToken: (token: string) => void;
}

export function Header({ onSearch, onMenuClick, onHomeClick, accessToken, setAccessToken }: HeaderProps) {
  const [query, setQuery] = useState("");
  const [isMobileSearch, setIsMobileSearch] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggest = async () => {
      if (query.trim().length > 1) {
        const sugg = await getSuggestions(query);
        setSuggestions(sugg.slice(0, 8)); // top 8 suggestions
      } else {
        setSuggestions([]);
      }
    };
    const timeoutId = setTimeout(fetchSuggest, 200);
    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: FormEvent, submitQuery?: string) => {
    e.preventDefault();
    const finalQuery = submitQuery || query;
    if (finalQuery.trim()) {
      onSearch(finalQuery);
      setQuery(finalQuery);
      setIsMobileSearch(false);
      setShowSuggestions(false);
    }
  };

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem("yt_access_token", tokenResponse.access_token);
      const expiry = Date.now() + (tokenResponse.expires_in * 1000);
      localStorage.setItem("yt_token_expiry", expiry.toString());
    },
    scope: "https://www.googleapis.com/auth/youtube.readonly",
  });

  return (
    <header className="h-14 bg-white flex items-center justify-between px-4 shrink-0 w-full fixed top-0 z-50">
      
      {/* Mobile Search Overlay */}
      {isMobileSearch ? (
        <div className="flex w-full items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
          <button 
            onClick={() => setIsMobileSearch(false)}
            className="p-2 hover:bg-black/5 rounded-full transition-colors shrink-0"
          >
            <ArrowLeft size={24} className="text-[#0f0f0f]" />
          </button>
          <div ref={searchContainerRef} className="flex-1 relative">
            <form onSubmit={(e) => handleSubmit(e)} className="flex flex-1 items-center">
              <div className="flex w-full border border-[#ccc] rounded-l-full overflow-hidden bg-white focus-within:border-[#1c62b9]">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search YouTube"
                  className="w-full h-10 px-4 text-base focus:outline-none placeholder-[#606060]"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="h-10 px-4 bg-[#f8f8f8] border border-l-0 border-[#ccc] rounded-r-full flex items-center justify-center shrink-0"
              >
                <Search size={20} className="text-[#0f0f0f]" strokeWidth={1.5} />
              </button>
            </form>

            {/* Mobile Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-12 left-0 w-full bg-white rounded-xl shadow-lg border border-[#e5e5e5] py-2 z-50">
                {suggestions.map((s, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-[#f2f2f2] cursor-pointer"
                    onClick={(e) => handleSubmit(e as any, s)}
                  >
                    <Search size={16} className="text-[#0f0f0f]" />
                    <span className="text-[#0f0f0f] font-medium">{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="p-2.5 bg-[#f8f8f8] rounded-full shrink-0">
             <Mic size={20} className="text-[#0f0f0f]" strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <button 
              onClick={onMenuClick}
              className="p-2 hover:bg-black/5 rounded-full transition-colors hidden sm:block"
            >
              <Menu size={24} className="text-[#0f0f0f]" strokeWidth={1.5} />
            </button>
            <div 
              className="flex items-center gap-1 cursor-pointer"
              onClick={onHomeClick}
              title="YouTube Home"
            >
              <div className="w-8 h-6 bg-[#FF0000] rounded-lg flex items-center justify-center">
                <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
              </div>
              <span className="font-semibold text-lg tracking-tighter text-[#0f0f0f] -ml-0.5">YouTube</span>
            </div>
          </div>

          <div ref={searchContainerRef} className="hidden sm:flex flex-1 items-center justify-center max-w-[720px] px-8 relative">
            <form onSubmit={(e) => handleSubmit(e)} className="flex w-full items-center">
              <div className="flex w-full border border-[#ccc] rounded-l-full overflow-hidden ml-8 bg-white focus-within:border-[#1c62b9] focus-within:ml-0 group transition-all relative">
                <div className="pl-4 pr-2 items-center hidden group-focus-within:flex">
                  <Search size={18} className="text-[#0f0f0f]" strokeWidth={1} />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search"
                  className="w-full h-10 px-4 text-base focus:outline-none placeholder-[#606060]"
                />
              </div>
              <button
                type="submit"
                className="h-10 px-5 bg-[#f8f8f8] border border-l-0 border-[#ccc] rounded-r-full hover:bg-[#f0f0f0] flex items-center justify-center transition-colors"
                title="Search"
              >
                <Search size={20} className="text-[#0f0f0f]" strokeWidth={1} />
              </button>
              <button type="button" className="ml-4 p-2.5 bg-[#f8f8f8] rounded-full hover:bg-[#e5e5e5] transition-colors shrink-0" title="Search with your voice">
                 <Mic size={20} className="text-[#0f0f0f]" strokeWidth={1.5} />
              </button>
            </form>

            {/* Desktop Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-12 left-8 right-[52px] bg-white rounded-xl shadow-lg border border-[#e5e5e5] py-4 z-50">
                {suggestions.map((s, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-4 px-4 py-1.5 hover:bg-[#f2f2f2] cursor-pointer"
                    onClick={(e) => handleSubmit(e as any, s)}
                  >
                    <Search size={16} className="text-[#0f0f0f]" />
                    <span className="text-[#0f0f0f] font-medium">{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 pr-2">
            <button 
              onClick={() => setIsMobileSearch(true)}
              className="p-2 hover:bg-black/5 rounded-full transition-colors sm:hidden"
            >
               <Search size={24} className="text-[#0f0f0f]" strokeWidth={1.5} />
            </button>
            <button className="p-2 hover:bg-black/5 rounded-full transition-colors hidden sm:block">
               <Video size={24} className="text-[#0f0f0f]" strokeWidth={1.5} />
            </button>
            <button className="p-2 hover:bg-black/5 rounded-full transition-colors hidden sm:block">
               <Bell size={24} className="text-[#0f0f0f]" strokeWidth={1.5} />
            </button>
            
            {accessToken ? (
              <div className="w-8 h-8 rounded-full bg-[#717171] text-white flex items-center justify-center font-medium ml-2 cursor-pointer">
                U
              </div>
            ) : (
              <button 
                onClick={() => login()}
                className="ml-2 px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-[#065fd4] border border-[#e5e5e5] rounded-full hover:bg-[#def1ff] hover:border-transparent transition-colors"
              >
                <div className="w-5 h-5 rounded-full border border-[#065fd4] flex items-center justify-center">
                   <div className="w-2.5 h-2.5 bg-[#065fd4] rounded-t-full rounded-b-sm"></div>
                </div>
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )}
          </div>
        </>
      )}
    </header>
  );
}
