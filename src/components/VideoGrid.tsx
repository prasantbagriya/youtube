import React, { useEffect, useRef } from "react";
import { YouTubeVideo } from "../types";
import { VideoCard } from "./VideoCard";

interface VideoGridProps {
  videos: YouTubeVideo[];
  onVideoSelect: (video: YouTubeVideo) => void;
  title?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export function VideoGrid({ videos, onVideoSelect, title, onLoadMore, isLoadingMore }: VideoGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isLoadingMore) {
        onLoadMore();
      }
    }, { rootMargin: "200px" });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [onLoadMore, isLoadingMore]);

  return (
    <div className="flex flex-col w-full bg-white">
      {title && (
        <h2 className="text-xl font-bold text-[#0f0f0f] px-6 py-4">{title}</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-10 px-6 pb-12">
        {videos.map((video, idx) => {
          const videoId = typeof video.id === 'string' ? video.id : video.id.videoId || `video-${idx}`;
          return (
            <VideoCard 
              key={videoId} 
              video={video} 
              onClick={onVideoSelect} 
            />
          );
        })}
      </div>
      {onLoadMore && (
        <div ref={sentinelRef} className="w-full h-20 flex items-center justify-center mb-8">
          {isLoadingMore && (
            <div className="w-8 h-8 border-4 border-[#ccc] border-t-[#606060] rounded-full animate-spin"></div>
          )}
        </div>
      )}
    </div>
  );
}
