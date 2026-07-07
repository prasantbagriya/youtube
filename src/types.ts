export interface YouTubeVideo {
  id: string | { videoId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: YouTubeThumbnail;
      medium: YouTubeThumbnail;
      high: YouTubeThumbnail;
    };
    channelTitle: string;
    publishedAt: string;
    channelId: string;
  };
  statistics?: {
    viewCount: string;
    likeCount: string;
    commentCount?: string;
  };
}

export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface YouTubeSearchResponse {
  items: YouTubeVideo[];
  nextPageToken?: string;
}
