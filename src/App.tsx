import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Home, Compass, MonitorPlay, Settings as SettingsIcon } from "lucide-react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { CategoryChips } from "./components/CategoryChips";
import { VideoGrid } from "./components/VideoGrid";
import { VideoPlayer } from "./components/VideoPlayer";
import { getTrendingVideos, searchVideos } from "./lib/youtube";
import { YouTubeVideo, YouTubeSearchResponse } from "./types";
import { App as CapacitorApp } from '@capacitor/app';

export default function App() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 640);
  const [activeTab, setActiveTab] = useState("Home");
  const [homePreferences, setHomePreferences] = useState(() => {
    const saved = localStorage.getItem("yt_home_prefs");
    return saved ? JSON.parse(saved) : { query: "" };
  });

  const [watchHistory, setWatchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem("yt_watch_history");
    return saved ? JSON.parse(saved) : [];
  });

  const [watchLaterVideos, setWatchLaterVideos] = useState<YouTubeVideo[]>(() => {
    const saved = localStorage.getItem("yt_watch_later");
    return saved ? JSON.parse(saved) : [];
  });

  const handleVideoSelect = (video: YouTubeVideo) => {
    setSelectedVideo(video);
    if (video && video.snippet && video.snippet.channelTitle) {
      setWatchHistory(prev => {
        const newHistory = [video.snippet.channelTitle, ...prev.filter(t => t !== video.snippet.channelTitle)].slice(0, 10);
        localStorage.setItem("yt_watch_history", JSON.stringify(newHistory));
        return newHistory;
      });
    }
  };

  const addToWatchLater = (video: YouTubeVideo) => {
    setWatchLaterVideos(prev => {
      const videoId = typeof video.id === 'string' ? video.id : video.id.videoId;
      const exists = prev.some(v => (typeof v.id === 'string' ? v.id : v.id.videoId) === videoId);
      if (exists) return prev;
      const newList = [...prev, video];
      localStorage.setItem("yt_watch_later", JSON.stringify(newList));
      return newList;
    });
    alert("Added to Watch Later!");
  };

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const savedToken = localStorage.getItem("yt_access_token");
    const expiry = localStorage.getItem("yt_token_expiry");
    if (savedToken && expiry && Date.now() < parseInt(expiry)) {
      return savedToken;
    }
    localStorage.removeItem("yt_access_token");
    localStorage.removeItem("yt_token_expiry");
    return null;
  });

  // Capacitor Android Back Button Handler
  useEffect(() => {
    const handleBackButton = () => {
      if (selectedVideo) {
        // If a video is playing, close it and go back to home feed
        setSelectedVideo(null);
      } else {
        // Otherwise, exit the app
        CapacitorApp.exitApp();
      }
    };
    
    CapacitorApp.addListener('backButton', handleBackButton);
    
    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [selectedVideo]);

  const loadTrending = async (isLoadMore = false) => {
    if (isLoadMore) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
      setSelectedVideo(null); // Go to home
      setPageToken(undefined);
    }
    
    try {
      if (homePreferences.query) {
        const data = await searchVideos(homePreferences.query, accessToken, isLoadMore ? pageToken : undefined);
        if (!isLoadMore) setTitle(""); 
        setVideos(prev => isLoadMore ? [...prev, ...(data.items || [])] : (data.items || []));
        setPageToken(data.nextPageToken);
      } else {
        // Fetch a HIGH QUALITY category (using a single specific keyword so the fallback scraper understands it perfectly)
        const premiumKeywords = [
          "official trailer 2024 HD",
          "official music video 4K",
          "tech review HD MKBHD",
          "netflix india official trailer",
          "amazon prime video official",
          "sony music india official 4k",
          "t-series official song 4k",
          "stand up comedy special official HD",
          "best podcast episode HD"
        ];
        
        // Pick ONE random category to ensure top production value
        const randomKeyword = premiumKeywords[Math.floor(Math.random() * premiumKeywords.length)];
        
        // Simple query without negative operators so the scraper finds maximum results
        // (Appended "this month" to force YouTube to return highly recent videos)
        const homeQuery = `${randomKeyword} this month`;
        const data = await searchVideos(homeQuery, accessToken, isLoadMore ? pageToken : undefined, "relevance");
        
        // Aggressive Shorts/Reels Blocklist
        const blockedTerms = ["#shorts", "shorts", "short", "reel", "#reels", "reels", "tiktok", "youtube shorts", "yt shorts", "whatsapp status", "status"];
        
        const filteredVideos = (data.items || []).filter(v => {
          const title = v.snippet?.title?.toLowerCase() || "";
          const desc = v.snippet?.description?.toLowerCase() || "";
          // Check if ANY blocked term is inside the title or description
          const isBlocked = blockedTerms.some(term => {
             // For exact word matches for "short", we use regex to avoid blocking "shortcut" or "shortfilm"
             if (term === "short" || term === "reel") {
               const regex = new RegExp(`\\b${term}\\b`, 'i');
               return regex.test(title) || regex.test(desc);
             }
             return title.includes(term) || desc.includes(term);
          });
          return !isBlocked;
        });

        setVideos(prev => {
          const newVideos = isLoadMore ? [...prev, ...filteredVideos] : filteredVideos;
          // STRICT DEDUPLICATION: Ensure no video ever repeats in the feed
          const uniqueVideos = Array.from(new Map(newVideos.map(v => {
            const id = typeof v.id === 'string' ? v.id : v.id.videoId;
            return [id, v];
          })).values());
          return uniqueVideos;
        });
        
        setPageToken(data.nextPageToken);
        if (!isLoadMore) setTitle("");
      }
    } catch (err: any) {
      console.error("loadTrending error:", err);
      if (!isLoadMore) {
        if (err.message && err.message.includes('401')) {
          setError("Authentication Required. Please log in with Google to continue.");
        } else {
          setError("Failed to load videos. YouTube API Quota might be exceeded, or there is a network error.");
        }
      }
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  const handleSearch = async (query: string, isLoadMore = false) => {
    if (isLoadMore) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
      setSelectedVideo(null); // Go to home
      setPageToken(undefined);
    }

    try {
      let data: YouTubeSearchResponse;
      
      if (query === "Subscriptions") {
        try {
          const subRes = await globalThis.fetch("/api/youtube/subscriptions", {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const subData = await subRes.json();
          if (subRes.ok && subData.items && subData.items.length > 0) {
            const channelNames = subData.items.map((s: any) => s.snippet.title).slice(0, 3).join(" OR ");
            data = await searchVideos(`${channelNames} latest videos -shorts`, accessToken, isLoadMore ? pageToken : undefined, "date");
          } else {
            data = await searchVideos("latest subscription videos -shorts", accessToken, isLoadMore ? pageToken : undefined);
          }
        } catch (e) {
          data = await searchVideos("latest subscription videos -shorts", accessToken, isLoadMore ? pageToken : undefined);
        }
      } else {
        // STRICT CATEGORY FOCUS
        // Keep the query extremely simple so that the fallback scraper (yt-search) understands it perfectly
        // Added "this month" to guarantee fresh results
        const categoryQuery = `${query} HD this month`.trim();
        data = await searchVideos(categoryQuery, accessToken, isLoadMore ? pageToken : undefined, "relevance");
      }
      
      const blockedTerms = ["#shorts", "shorts", "short", "reel", "#reels", "reels", "tiktok", "youtube shorts", "yt shorts", "whatsapp status", "status"];
      
      const noShortsVideos = (data.items || []).filter(v => {
        const title = v.snippet?.title?.toLowerCase() || "";
        const desc = v.snippet?.description?.toLowerCase() || "";
        const isBlocked = blockedTerms.some(term => {
           if (term === "short" || term === "reel") {
             const regex = new RegExp(`\\b${term}\\b`, 'i');
             return regex.test(title) || regex.test(desc);
           }
           return title.includes(term) || desc.includes(term);
        });
        return !isBlocked;
      });

      // STRICT CATEGORY MATCHING (As requested by user: Title & Description Match)
      const isStrictCategory = query !== "Subscriptions" && query !== "All";
      const categoryTerms = query.toLowerCase().replace(/&/g, "").split(" ").filter(w => w.length > 2);

      const filteredVideos = noShortsVideos.filter(v => {
        if (!isStrictCategory) return true;
        
        const title = v.snippet?.title?.toLowerCase() || "";
        const desc = v.snippet?.description?.toLowerCase() || "";
        const channel = v.snippet?.channelTitle?.toLowerCase() || "";
        const fullText = `${title} ${desc} ${channel}`;

        // Check if ANY of the category words are present in text
        const hasMatch = categoryTerms.some(term => fullText.includes(term));
        
        // Add synonyms for common categories so we don't accidentally block valid videos
        let synonyms: string[] = [];
        if (query === "Movies") synonyms = ["trailer", "film", "movie", "teaser", "cinema", "bollywood", "hollywood"];
        if (query === "Music") synonyms = ["song", "music", "audio", "lyric", "album", "singer", "track", "concert"];
        if (query === "Gaming") synonyms = ["game", "gaming", "playthrough", "walkthrough", "gameplay", "ps5", "xbox", "pc", "minecraft", "gta"];
        if (query === "News") synonyms = ["news", "breaking", "update", "aaj tak", "report", "live", "journalism"];
        if (query === "Comedy") synonyms = ["comedy", "standup", "funny", "joke", "laugh", "roast", "humor", "prank"];
        if (query === "Sports") synonyms = ["sport", "cricket", "football", "highlights", "match", "tournament", "wwe", "ufc", "tennis"];
        if (query === "Tech Reviews") synonyms = ["tech", "review", "unboxing", "smartphone", "gadget", "laptop", "apple", "samsung"];
        if (query === "Food & Travel") synonyms = ["food", "travel", "recipe", "cooking", "vlog", "restaurant", "street food", "tour"];
        if (query === "Podcasts") synonyms = ["podcast", "interview", "episode", "discussion", "talk show", "chat"];
        if (query === "Programming") synonyms = ["programming", "coding", "developer", "software", "python", "javascript", "react", "tutorial", "code"];
        if (query === "Live Streams") synonyms = ["live", "stream", "live stream", "live broadcast"];

        const hasSynonymMatch = synonyms.some(term => fullText.includes(term));

        // Let either the direct category terms or the synonyms match.
        // Special case: For "Podcasts", "podcasts" is checked by categoryTerms, but now "podcast" is checked via synonyms.
        return hasMatch || hasSynonymMatch;
      });

      // FRESHNESS FILTER (As requested by user: No old videos, block anything with "year")
      const freshVideos = filteredVideos.filter(v => {
        const pub = (v.snippet?.publishedAt || "").toLowerCase();
        
        // If it's a yt-search string and has "year", instantly block
        if (pub.includes("year")) return false;
        
        // If we want to be ultra-strict, we can block videos older than 6 months (yt-search)
        if (pub.match(/([6-9]|10|11)\s*months/)) return false;

        // If it's an ISO date from the Official API
        if (pub.includes("t") || pub.includes("z")) {
          let timeText = "";
          const publishedAt = v.snippet?.publishedAt;
          if (publishedAt && typeof publishedAt === 'string' && publishedAt.includes("ago")) {
            timeText = publishedAt;
          } else if (publishedAt) {
            const daysAgo = Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 3600 * 24));
            timeText = daysAgo === 0 ? "Today" : daysAgo < 30 ? `${daysAgo} days ago` : daysAgo < 365 ? `${Math.floor(daysAgo / 30)} months ago` : `${Math.floor(daysAgo / 365)} years ago`;
          } else {
            timeText = "Recently";
          }
          if (timeText.includes("year") || (timeText.includes("months") && parseInt(timeText) > 6)) return false;
        }
        
        return true;
      });

      setVideos(prev => {
        const newVideos = isLoadMore ? [...prev, ...freshVideos] : freshVideos;
        // STRICT DEDUPLICATION FOR CATEGORIES TOO
        return Array.from(new Map(newVideos.map(v => {
          const id = typeof v.id === 'string' ? v.id : v.id.videoId;
          return [id, v];
        })).values());
      });
      
      if (!isLoadMore) setTitle(query === "Subscriptions" ? "Your Subscriptions" : `Results for "${query}"`);
      setPageToken(data.nextPageToken);
    } catch (err) {
      if (!isLoadMore) setError("Search failed. Please try again later.");
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  const handleTabSelect = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Home") {
      loadTrending();
    } else if (tab === "Shorts") {
      handleSearch("#shorts");
    } else if (tab === "Watch later") {
      setVideos(watchLaterVideos);
      setTitle("Watch Later");
      setSelectedVideo(null);
    } else if (tab === "Settings") {
      // Just change tab, UI will render Settings page
      setSelectedVideo(null);
    }
  };

useEffect(() => {
    loadTrending();
  }, [accessToken]);

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] w-full max-w-[2000px] mx-auto app-container">
      <div className="flex flex-col h-full bg-white relative pt-safe pb-safe overflow-x-hidden w-full">
        <Header 
          onSearch={handleSearch} 
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          onHomeClick={loadTrending}
          accessToken={accessToken}
          setAccessToken={setAccessToken}
        />

        <div className="flex flex-1 h-[calc(100vh-56px)] overflow-hidden">
          <Sidebar 
            isOpen={isSidebarOpen} 
            activeTab={activeTab}
            onTabSelect={handleTabSelect}
            onClose={() => setIsSidebarOpen(false)}
          />
          <main 
            className={`flex-1 overflow-y-auto overflow-x-hidden bg-[#f9f9f9] pb-16 sm:pb-0 transition-all pt-[56px] ${isSidebarOpen ? 'sm:ml-[240px]' : 'sm:ml-[72px]'}`}
          >
          {selectedVideo ? (
            <VideoPlayer 
              video={selectedVideo} 
              videos={videos}
              onVideoSelect={handleVideoSelect}
              onAddToWatchLater={addToWatchLater}
              watchLaterVideos={watchLaterVideos}
            />
          ) : activeTab === "Settings" ? (
            <div className="flex flex-col max-w-3xl mx-auto p-8 pt-12">
              <h1 className="text-3xl font-bold text-[#0f0f0f] mb-2">Home Feed Settings</h1>
              <p className="text-[#606060] mb-8">Customize the default videos shown on your Home page.</p>
              
              <div className="bg-white p-6 rounded-xl border border-[#e5e5e5] shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-[#0f0f0f]">Preferred Categories / Search Terms</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 border border-[#ccc] rounded-lg focus:outline-none focus:border-[#065fd4] text-[15px]"
                    placeholder="e.g. Hindi Tech, Gaming, Bollywood..."
                    defaultValue={homePreferences.query}
                    id="pref-query"
                  />
                  <p className="text-sm text-[#606060]">Leave empty to show global trending videos.</p>
                </div>

                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#e5e5e5]">
                  <label className="text-sm font-medium text-[#0f0f0f]">Watch History Preferences</label>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#606060]">Clear your local watch history to reset recommendations.</p>
                    <button 
                      onClick={() => {
                        setWatchHistory([]);
                        localStorage.removeItem("yt_watch_history");
                        alert("Watch history cleared!");
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-[#ccc] hover:bg-black/5 text-[#0f0f0f] transition-colors"
                    >
                      Clear History
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#e5e5e5]">
                  <label className="text-sm font-medium text-[#0f0f0f]">📱 Android App (APK)</label>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#606060]">Download VidStream Android App for background audio support.</p>
                    <a
                      href="https://github.com/prasantbagriya/youtube/raw/main/releases/VidStream.apk"
                      download="VidStream.apk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#0f0f0f] text-white hover:bg-[#272727] transition-colors whitespace-nowrap"
                    >
                      ⬇️ Download APK
                    </a>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-[#e5e5e5]">
                  <button 
                    onClick={() => setActiveTab("Home")}
                    className="px-5 py-2.5 rounded-full font-medium text-[#0f0f0f] hover:bg-black/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      const query = (document.getElementById("pref-query") as HTMLInputElement).value;
                      const newPrefs = { query };
                      setHomePreferences(newPrefs);
                      localStorage.setItem("yt_home_prefs", JSON.stringify(newPrefs));
                      setActiveTab("Home");
                      if (query) {
                        handleSearch(query);
                      } else {
                        // Wait for state to settle, then load trending which will use the new empty query
                        setTimeout(() => loadTrending(), 0);
                      }
                    }}
                    className="px-5 py-2.5 rounded-full font-medium bg-[#065fd4] text-white hover:bg-[#0056bf] transition-colors shadow-sm"
                  >
                    Save & Apply
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col w-full h-full bg-white">
              <CategoryChips onSelect={(cat) => cat === "All" ? loadTrending() : handleSearch(cat)} />
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
                  <Loader2 className="w-10 h-10 text-[#606060] animate-spin" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <div className="max-w-md">
                    <h2 className="text-2xl font-bold text-[#0f0f0f] mb-2">
                    {error.includes("Authentication") ? "Authentication Required" : "Oops! Something went wrong"}
                  </h2>
                    <p className="text-[#606060] text-sm leading-relaxed mb-6">{error}</p>
                  </div>
                </div>
              ) : (
                <VideoGrid 
                  videos={videos || []} 
                  onVideoSelect={handleVideoSelect} 
                  title={title}
                  onLoadMore={() => {
                    if (title.startsWith("Search results")) {
                      handleSearch(title.replace('Search results for "', '').replace('"', ''), true);
                    } else {
                      loadTrending(true);
                    }
                  }}
                  isLoadingMore={isFetchingMore}
                />
              )}
            </div>
          )}
        </main>
        </div>
        
        {/* Bottom Navigation for Mobile */}
        <div className="sm:hidden fixed bottom-0 w-full bg-white border-t border-[#e5e5e5] flex justify-around items-center py-1.5 z-40 px-2 pb-safe">
            <button 
              onClick={() => handleTabSelect("Home")}
              className="flex flex-col items-center p-2 w-16"
            >
              <Home size={24} className={activeTab === "Home" ? "fill-[#0f0f0f] text-[#0f0f0f]" : "text-[#0f0f0f]"} strokeWidth={1.5} />
              <span className="text-[10px] mt-1 text-[#0f0f0f] truncate w-full text-center">Home</span>
            </button>
            <button 
              onClick={() => handleTabSelect("Shorts")}
              className="flex flex-col items-center p-2 w-16"
            >
              <Compass size={24} className={activeTab === "Shorts" ? "fill-[#0f0f0f] text-[#0f0f0f]" : "text-[#0f0f0f]"} strokeWidth={1.5} />
              <span className="text-[10px] mt-1 text-[#0f0f0f] truncate w-full text-center">Shorts</span>
            </button>
            <button 
              onClick={() => handleTabSelect("Watch later")}
              className="flex flex-col items-center p-2 w-16"
            >
              <MonitorPlay size={24} className={activeTab === "Watch later" ? "fill-[#0f0f0f] text-[#0f0f0f]" : "text-[#0f0f0f]"} strokeWidth={1.5} />
              <span className="text-[10px] mt-1 text-[#0f0f0f] truncate w-full text-center">Watch later</span>
            </button>
          </div>
      </div>
    </div>
  );
}
