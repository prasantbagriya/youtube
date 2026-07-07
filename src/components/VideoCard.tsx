import React from "react";
import { YouTubeVideo } from "../types";
import { motion } from "motion/react";

interface VideoCardProps {
  video: YouTubeVideo;
  onClick: (video: YouTubeVideo) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
  const { title, thumbnails, channelTitle, publishedAt } = video.snippet;
  
  // Handle both ISO dates (from official API) and strings like "2 months ago" (from yt-search)
  let timeText = "";
  if (publishedAt && typeof publishedAt === 'string' && publishedAt.includes("ago")) {
    timeText = publishedAt;
  } else if (publishedAt) {
    const daysAgo = Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 3600 * 24));
    timeText = daysAgo === 0 ? "Today" : daysAgo < 30 ? `${daysAgo} days ago` : daysAgo < 365 ? `${Math.floor(daysAgo / 30)} months ago` : `${Math.floor(daysAgo / 365)} years ago`;
  } else {
    timeText = "Recently";
  }
  
  // Fake views for UI
  const views = video.statistics?.viewCount ? parseInt(video.statistics.viewCount) : Math.floor(Math.random() * 900000) + 10000;
  const viewText = views > 1000000 ? `${(views / 1000000).toFixed(1)}M views` : views > 1000 ? `${Math.floor(views / 1000)}K views` : `${views} views`;

  return (
    <div
      className="flex flex-col gap-3 cursor-pointer group"
      onClick={() => onClick(video)}
    >
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#e5e5e5]">
        <img
          src={thumbnails.high?.url || thumbnails.medium?.url}
          alt={title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
        {/* Fake duration */}
        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-medium px-1 rounded">
          {Math.floor(Math.random() * 10) + 2}:{Math.floor(Math.random() * 50) + 10}
        </div>
      </div>

      <div className="flex gap-3 pr-6">
        <div className="shrink-0 mt-0.5">
          <div className="w-9 h-9 rounded-full bg-[#f2f2f2] flex items-center justify-center text-[#606060] font-bold text-sm">
            {channelTitle.charAt(0)}
          </div>
        </div>
        <div className="flex flex-col overflow-hidden">
          <h3 
            className="text-base font-medium text-[#0f0f0f] truncate leading-tight mb-1 group-hover:text-blue-600 transition-colors" 
            dangerouslySetInnerHTML={{ __html: title }} 
          />
          <span className="text-[14px] text-[#606060] hover:text-[#0f0f0f] transition-colors truncate">
            {channelTitle}
          </span>
          <span className="text-[14px] text-[#606060] truncate">
            {viewText} • {timeText}
          </span>
        </div>
      </div>
    </div>
  );
}
