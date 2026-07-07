import { useState, useEffect, useRef } from "react";
import { YouTubeVideo } from "../types";
import { getVideoId, searchVideos, getVideoComments } from "../lib/youtube";
import { ThumbsUp, ThumbsDown, Share, Clock, MoreHorizontal, Headphones, Video, Download } from "lucide-react";
import { MediaSession } from "@capgo/capacitor-media-session";

interface VideoPlayerProps {
  video: YouTubeVideo | null;
  videos: YouTubeVideo[];
  onVideoSelect: (video: YouTubeVideo) => void;
  onAddToWatchLater: (video: YouTubeVideo) => void;
  watchLaterVideos: YouTubeVideo[];
}

export function VideoPlayer({ video, videos, onVideoSelect, onAddToWatchLater, watchLaterVideos }: VideoPlayerProps) {
  const [isAudioMode, setIsAudioMode] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<YouTubeVideo[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const wakeLockRef = useRef<any>(null);

  // ── BACKGROUND PLAY BYPASS SYSTEM ────────────────────────────────────
  // Strategy:
  // 1. Use Web Audio API oscillator at gain=0 (true silence, keeps audio session alive)
  // 2. Listen to visibilitychange — resume AudioContext if browser suspended it
  // 3. Send YouTube iframe a "play" postMessage when user comes back
  // 4. Request WakeLock to keep the screen/CPU active

  const startBackgroundAudio = () => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') return;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Oscillator at 0 Hz, connected to gain=0 → true silence but keeps audio session alive
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNodeRef.current = gainNode;
      gainNode.gain.value = 0; // completely silent
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      console.log('[VidStream] Background audio session started!');
    } catch (e) {
      console.warn('[VidStream] Background audio failed:', e);
    }
  };

  const resumeAudioContext = () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().then(() => {
        console.log('[VidStream] AudioContext resumed after page became active');
      });
    }
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('[VidStream] WakeLock acquired!');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (e) {
      console.warn('[VidStream] WakeLock not available:', e);
    }
  };

  const sendPlayToIframe = () => {
    // Send play command to YouTube iframe via postMessage
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo' }),
      '*'
    );
  };

  // We intentionally do not use visibilitychange to force the iframe to play,
  // because that interrupts the native audio tag playback in MP3 mode when the screen turns off.

  // Unlock AudioContext and WakeLock on first user interaction
  useEffect(() => {
    const unlock = () => {
      startBackgroundAudio();
      requestWakeLock();
    };
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    return () => {
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      wakeLockRef.current?.release();
    };
  }, []);


  const videoId = video ? (typeof video.id === 'string' ? video.id : video.id.videoId || '') : '';

  useEffect(() => {
    if (!video || !videoId) return;

    // Fetch related videos based on channel title or video title
    const fetchRelated = async () => {
      setIsLoadingRelated(true);
      try {
        const query = `${video.snippet.channelTitle} ${video.snippet.title.split(' ').slice(0, 3).join(' ')}`;
        const data = await searchVideos(query);
        // Filter out the current video
        const filtered = (data.items || []).filter((v: any) => getVideoId(v) !== videoId);
        setRelatedVideos(filtered);
      } catch (err) {
        console.error("Error fetching related videos", err);
        setRelatedVideos(videos); // Fallback
      } finally {
        setIsLoadingRelated(false);
      }
    };

    // Fetch comments
    const fetchComments = async () => {
      try {
        const data = await getVideoComments(videoId);
        setComments(data.items || []);
      } catch (err) {
        console.error("Error fetching comments", err);
        setComments([]);
      }
    };

    setIsDescExpanded(false);
    fetchRelated();
    fetchComments();

    // ── MEDIA SESSION API ──────────────────────────────────────────────
    // Sets up Lock Screen / Notification bar controls for background audio
    if (video) {
      const thumb = video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || '';
      
      // Web API (for browsers)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: video.snippet.title,
          artist: video.snippet.channelTitle,
          album: 'VidStream',
          artwork: [{ src: thumb, sizes: '512x512', type: 'image/jpeg' }]
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          const idx = (relatedVideos.length > 0 ? relatedVideos : videos).findIndex(v => getVideoId(v) === videoId);
          if (idx > 0) onVideoSelect((relatedVideos.length > 0 ? relatedVideos : videos)[idx - 1]);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          const list = relatedVideos.length > 0 ? relatedVideos : videos;
          const idx = list.findIndex(v => getVideoId(v) === videoId);
          if (idx < list.length - 1) onVideoSelect(list[idx + 1]);
          else if (list.length > 0) onVideoSelect(list[0]);
        });
      }

      // Native Plugin (for Android Foreground Service)
      try {
        MediaSession.setMetadata({
          title: video.snippet.title,
          artist: video.snippet.channelTitle,
          album: 'VidStream',
          artwork: [{ src: thumb, sizes: '512x512', type: 'image/jpeg' }]
        });
        MediaSession.setPlaybackState({ playbackState: 'playing' });
        // Native Audio Playback Integration
        if (isAudioMode) {
          import('@capawesome-team/capacitor-android-foreground-service').then(({ ForegroundService }) => {
             ForegroundService.startForegroundService({
                id: 12345,
                title: 'VidStream Audio',
                body: `Playing: ${video.snippet?.title || 'Audio'}`,
                smallIcon: 'ic_launcher' // fallback default capacitor icon
             }).catch(console.warn);
          });
          
          import('@capgo/capacitor-native-audio').then(({ NativeAudio }) => {
            NativeAudio.preload({
                assetId: 'youtube-audio',
                assetPath: `https://youtube-j5r4.onrender.com/api/youtube/audio/${videoId}`,
                audioChannelNum: 1,
                isUrl: true
            }).then(() => {
                NativeAudio.play({ assetId: 'youtube-audio' });
            }).catch(console.warn);
            
            MediaSession.setActionHandler({ action: 'play' }, () => {
               NativeAudio.play({ assetId: 'youtube-audio' });
               MediaSession.setPlaybackState({ playbackState: 'playing' });
            });
            MediaSession.setActionHandler({ action: 'pause' }, () => {
               NativeAudio.pause({ assetId: 'youtube-audio' });
               MediaSession.setPlaybackState({ playbackState: 'paused' });
            });
          });
        } else {
          import('@capawesome-team/capacitor-android-foreground-service').then(({ ForegroundService }) => {
             ForegroundService.stopForegroundService().catch(() => {});
          });
          
          import('@capgo/capacitor-native-audio').then(({ NativeAudio }) => {
            NativeAudio.stop({ assetId: 'youtube-audio' }).catch(() => {});
            NativeAudio.unload({ assetId: 'youtube-audio' }).catch(() => {});
          });
          
          MediaSession.setActionHandler({ action: 'play' }, () => {
             iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
             MediaSession.setPlaybackState({ playbackState: 'playing' });
          });
          MediaSession.setActionHandler({ action: 'pause' }, () => {
             iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*');
             MediaSession.setPlaybackState({ playbackState: 'paused' });
          });
        }
      } catch (e) {
        console.warn('Native MediaSession not available', e);
      }
    }
    return () => {
       import('@capawesome-team/capacitor-android-foreground-service').then(({ ForegroundService }) => {
          ForegroundService.stopForegroundService().catch(() => {});
       });
       import('@capgo/capacitor-native-audio').then(({ NativeAudio }) => {
          NativeAudio.stop({ assetId: 'youtube-audio' }).catch(() => {});
          NativeAudio.unload({ assetId: 'youtube-audio' }).catch(() => {});
       });
    };
  }, [video, videoId, videos, isAudioMode]);

  // Autoplay Next Video logic
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        // YouTube API state: 0 = ended
        if (data.event === "onStateChange" && data.info === 0) {
          if (relatedVideos && relatedVideos.length > 0) {
            onVideoSelect(relatedVideos[0]);
          }
        }
      } catch (err) {}
    };

    window.addEventListener("message", handleMessage);

    // Send a listening event to the iframe to ensure it broadcasts state changes
    const hookIframe = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: "listening",
          id: iframeRef.current.id,
          channel: "widget"
        }), "*");
      }
    }, 1000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(hookIframe);
    };
  }, [relatedVideos, onVideoSelect]);

  if (!video) return null;

  const { title, channelTitle, description, publishedAt } = video.snippet;
  
  // Calculate relative time
  const daysAgo = Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 3600 * 24));
  const timeText = daysAgo === 0 ? "Today" : daysAgo < 30 ? `${daysAgo} days ago` : daysAgo < 365 ? `${Math.floor(daysAgo / 30)} months ago` : `${Math.floor(daysAgo / 365)} years ago`;
  
  // Fake stats
  const views = video.statistics?.viewCount ? parseInt(video.statistics.viewCount) : Math.floor(Math.random() * 900000) + 10000;
  const viewText = views > 1000000 ? `${(views / 1000000).toFixed(1)}M views` : views > 1000 ? `${Math.floor(views / 1000)}K views` : `${views} views`;
  const likes = video.statistics?.likeCount ? parseInt(video.statistics.likeCount) : Math.floor(views * 0.05);
  const likeText = likes > 1000 ? `${(likes / 1000).toFixed(1)}K` : `${likes}`;

  return (
    <div className="flex flex-col lg:flex-row gap-6 sm:p-4 md:px-6 md:py-6 max-w-[1800px] mx-auto bg-[#f9f9f9] min-h-full">
      {/* Primary Column */}
      <div className="flex-1 flex flex-col gap-3 min-w-[65%]">
        <div className="w-full bg-black sm:rounded-xl overflow-hidden shadow-sm relative group" style={{ aspectRatio: '16/9' }}>
          {isAudioMode && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900 bg-cover bg-center" style={{ backgroundImage: `url(${video.snippet.thumbnails.high?.url})` }}>
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
              <div className="z-30 flex flex-col items-center gap-4 w-full px-8">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl animate-[spin_10s_linear_infinite]">
                   <img src={video.snippet.thumbnails.default?.url} className="w-full h-full object-cover" alt="Audio Thumbnail" />
                </div>
                <div className="text-white font-bold text-xl flex items-center gap-2">
                  <Headphones size={24} /> Audio Mode Active
                </div>
                <p className="text-white/70 text-sm mb-4">Audio is streaming from server...</p>
              </div>
            </div>
          )}
          <iframe
            id="player"
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&playsinline=1&fs=1`}
            className={`w-full h-full border-none ${isAudioMode ? 'opacity-0 absolute w-[1px] h-[1px] pointer-events-none' : 'visible relative'}`}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; background-sync"
          />
        </div>

        <div className="px-4 sm:px-0">
          <h1 className="text-xl font-bold text-[#0f0f0f] mt-2 leading-tight truncate" dangerouslySetInnerHTML={{ __html: title }} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#f2f2f2] flex items-center justify-center text-[#606060] font-bold text-lg cursor-pointer">
              {channelTitle.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[#0f0f0f] text-base leading-tight cursor-pointer">{channelTitle}</span>
              <span className="text-xs text-[#606060]">{Math.floor(Math.random() * 5 + 1)}M subscribers</span>
            </div>
            <button className="ml-2 px-4 py-2 bg-[#0f0f0f] text-white text-sm font-medium rounded-full hover:bg-[#272727] transition-colors">
              Subscribe
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <div className="flex bg-[#f2f2f2] rounded-full overflow-hidden hover:bg-[#e5e5e5] transition-colors cursor-pointer">
              <button className="flex items-center gap-2 px-4 py-2 border-r border-[#cccccc]">
                <ThumbsUp size={18} strokeWidth={1.5} className="text-[#0f0f0f]" />
                <span className="text-sm font-medium text-[#0f0f0f]">{likeText}</span>
              </button>
              <button className="px-4 py-2">
                <ThumbsDown size={18} strokeWidth={1.5} className="text-[#0f0f0f]" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#f2f2f2] hover:bg-[#e5e5e5] rounded-full transition-colors font-medium text-sm text-[#0f0f0f]">
              <Share size={18} strokeWidth={1.5} /> Share
            </button>
            <button 
              onClick={() => {
                window.open(`https://www.y2mate.com/youtube/${videoId}`, '_system');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#f2f2f2] hover:bg-[#e5e5e5] rounded-full transition-colors font-medium text-sm text-[#0f0f0f]"
            >
              <Download size={18} strokeWidth={1.5} /> Download
            </button>
            <button 
              onClick={() => onAddToWatchLater(video)}
              className="flex items-center gap-2 px-4 py-2 bg-[#f2f2f2] hover:bg-[#e5e5e5] rounded-full transition-colors font-medium text-sm text-[#0f0f0f] hidden md:flex"
            >
              <Clock size={18} strokeWidth={1.5} /> Save
            </button>
            <button 
              onClick={() => setIsAudioMode(!isAudioMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-medium text-sm border border-[#e5e5e5] ${isAudioMode ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-[#f2f2f2] text-[#0f0f0f] hover:bg-[#e5e5e5]'}`}
            >
              {isAudioMode ? <Video size={18} /> : <Headphones size={18} />} 
              {isAudioMode ? "Video" : "MP3"}
            </button>
            <button className="p-2 bg-[#f2f2f2] hover:bg-[#e5e5e5] rounded-full transition-colors hidden sm:flex">
              <MoreHorizontal size={18} className="text-[#0f0f0f]" />
            </button>
          </div>
        </div>

        <div 
          className="bg-[#f2f2f2] hover:bg-[#e5e5e5] transition-colors rounded-xl p-3 mt-2 cursor-pointer"
          onClick={() => setIsDescExpanded(!isDescExpanded)}
        >
          <div className="flex gap-2 text-sm font-medium text-[#0f0f0f] mb-1">
            <span>{viewText}</span>
            <span>{timeText}</span>
          </div>
          <p className={`text-sm text-[#0f0f0f] whitespace-pre-wrap leading-relaxed ${isDescExpanded ? '' : 'line-clamp-3'}`}>
            {description || "No description provided."}
          </p>
          <div className="text-sm font-bold mt-2">
            {isDescExpanded ? "Show less" : "Show more"}
          </div>
        </div>
        
        {/* Actual comments section */}
        <div className="mt-4 mb-8">
           <div className="flex items-center gap-6 mb-6">
             <h2 className="text-xl font-bold">{video.statistics?.commentCount ? parseInt(video.statistics.commentCount).toLocaleString() : comments.length} Comments</h2>
             <span className="text-sm font-medium text-[#0f0f0f] flex items-center gap-1 cursor-pointer"><MenuIcon /> Sort by</span>
           </div>
           
           <div className="flex gap-4 mb-8">
             <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">ME</div>
             <div className="flex-1 border-b border-[#e5e5e5] pb-1">
               <input type="text" placeholder="Add a comment..." className="w-full bg-transparent outline-none text-sm" />
             </div>
           </div>

           <div className="flex flex-col gap-6">
             {comments.length > 0 ? comments.map((comment) => {
               const topLevel = comment.snippet.topLevelComment.snippet;
               return (
                 <div key={comment.id} className="flex gap-4">
                   <img src={topLevel.authorProfileImageUrl} alt={topLevel.authorDisplayName} className="w-10 h-10 rounded-full bg-[#f2f2f2]" />
                   <div className="flex flex-col flex-1">
                     <div className="flex items-center gap-2 mb-1">
                       <span className="font-bold text-sm text-[#0f0f0f]">{topLevel.authorDisplayName}</span>
                       <span className="text-xs text-[#606060]">{(new Date(topLevel.publishedAt)).toLocaleDateString()}</span>
                     </div>
                     <p className="text-sm text-[#0f0f0f] whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: topLevel.textDisplay }}></p>
                     <div className="flex items-center gap-4 mt-2 text-[#0f0f0f]">
                       <button className="flex items-center gap-1"><ThumbsUp size={16} strokeWidth={1.5} /><span className="text-xs">{topLevel.likeCount > 0 ? topLevel.likeCount : ''}</span></button>
                       <button><ThumbsDown size={16} strokeWidth={1.5} /></button>
                       <button className="text-xs font-bold ml-2">Reply</button>
                     </div>
                   </div>
                 </div>
               );
             }) : (
               <div className="text-center text-[#606060] py-8">No comments found or comments are disabled.</div>
             )}
           </div>
        </div>
        </div>
      </div>

      {/* Secondary Column: Dynamic Related Videos */}
      <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-3">
        {isLoadingRelated ? (
          <div className="w-full py-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#ccc] border-t-[#606060] rounded-full animate-spin"></div></div>
        ) : (
          (relatedVideos.length > 0 ? relatedVideos : videos).map((v, i) => {
           const id = typeof v.id === 'string' ? v.id : v.id.videoId || `upnext-${i}`;
           const t = v.snippet.title;
           const c = v.snippet.channelTitle;
           const fakeV = Math.floor(Math.random() * 900) + 10;
           return (
             <div key={id} onClick={() => onVideoSelect(v)} className="flex gap-2 cursor-pointer group">
               <div className="w-[168px] shrink-0 relative rounded-lg overflow-hidden bg-[#e5e5e5]">
                 <img src={v.snippet.thumbnails.medium?.url || v.snippet.thumbnails.default?.url} className="w-full h-24 object-cover" />
                 <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1 rounded">10:01</div>
               </div>
               <div className="flex flex-col flex-1 py-0.5 pr-6">
                 <h3 className="text-sm font-medium text-[#0f0f0f] truncate leading-tight mb-1" dangerouslySetInnerHTML={{ __html: t }} />
                 <span className="text-xs text-[#606060] hover:text-[#0f0f0f] truncate">{c}</span>
                 <span className="text-xs text-[#606060]">{fakeV}K views • {Math.floor(Math.random() * 11) + 1} months ago</span>
               </div>
             </div>
           );
          })
        )}
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" className="w-5 h-5 fill-current"><path d="M21,6H3V5h18V6z M15,11H3v1h12V11z M9,17H3v1h6V17z"></path></svg>
  );
}
