import { YouTubeSearchResponse } from "../types";

export async function searchVideos(query: string, token: string | null = null, pageToken?: string, order?: string): Promise<YouTubeSearchResponse> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let url = `/api/youtube/search?q=${encodeURIComponent(query)}`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  if (order) url += `&order=${order}`;

  const response = await globalThis.fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to search videos: ${response.status}`);
  }
  return response.json();
}

export async function getTrendingVideos(token: string | null = null, categoryId?: string, pageToken?: string): Promise<YouTubeSearchResponse> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let url = `/api/youtube/trending?`;
  if (categoryId) url += `categoryId=${categoryId}&`;
  if (pageToken) url += `pageToken=${pageToken}&`;
  
  const response = await globalThis.fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to get trending videos: ${response.status}`);
  }
  return response.json();
}

export async function getSuggestions(query: string): Promise<string[]> {
  const response = await globalThis.fetch(`/api/youtube/suggest?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data[1] || []; // google suggest returns [query, [suggestions]]
}

export async function getVideoComments(videoId: string, token: string | null = null): Promise<any> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await globalThis.fetch(`/api/youtube/comments?videoId=${videoId}`, { headers });
  if (!response.ok) {
    throw new Error("Failed to fetch comments");
  }
  return response.json();
}

export function getVideoId(video: any): string {
  if (typeof video.id === 'string') return video.id;
  if (video.id && video.id.videoId) return video.id.videoId;
  return '';
}
