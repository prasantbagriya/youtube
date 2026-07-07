import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import yts from "yt-search";
import NodeCache from "node-cache";

// Cache for 30 minutes to improve speed and reduce API/scraping load
const cache = new NodeCache({ stdTTL: 1800, checkperiod: 300 });

// Helper to parse YouTube ISO 8601 duration (e.g., PT1M30S) into seconds
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function startServer() {
  const app = express();

  // API Routes
  app.get("/api/youtube/search", async (req, res) => {
    const { q, maxResults = 20, pageToken, order = "relevance" } = req.query;
    const authHeader = req.headers.authorization;
    
    // Check cache first (ignore cache if using personal auth token)
    const cacheKey = `search_${q}_${maxResults}_${pageToken || 'first'}_${order}`;
    if (!authHeader && cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }
    
    // Function to use the free yt-search library as a fallback
    const useFreeFallback = async (searchQuery: string, pageTokenParam?: string) => {
      try {
        console.log("Using yt-search fallback for:", searchQuery);
        const page = parseInt(pageTokenParam as string) || 1;
        const limit = Number(maxResults);
        const start = (page - 1) * limit;
        const end = start + limit;

        const r = await yts(searchQuery);
        const videos = r.videos.slice(start, end);
        const items = videos.map(v => ({
           id: { videoId: v.videoId },
           snippet: {
               title: v.title,
               description: v.description,
               thumbnails: {
                   medium: { url: v.thumbnail },
                   default: { url: v.thumbnail },
                   high: { url: v.thumbnail }
               },
               channelTitle: v.author.name,
               publishedAt: v.ago,
               channelId: v.author.url
           },
           statistics: { viewCount: v.views.toString(), likeCount: "0" }
        }));
        
        // STRICT FILTER: Remove any video under 60 seconds (1 minute)
        const longEnoughItems = items.filter((_, index) => {
          const rawDuration = videos[index].seconds;
          return rawDuration >= 60;
        });
        
        const nextToken = videos.length === limit ? (page + 1).toString() : undefined;
        const responseData = { items: longEnoughItems, nextPageToken: nextToken };
        if (!authHeader) cache.set(cacheKey, responseData);
        return res.json(responseData);
      } catch (err) {
        console.error("yt-search fallback failed:", err);
        return res.status(500).json({ error: "Search failed completely." });
      }
    };

    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "YOUR_YOUTUBE_API_KEY") {
      if (!authHeader) {
        return useFreeFallback(q as string, pageToken as string);
      }
    }

    try {
      const headers: HeadersInit = {};
      let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(q as string)}&order=${order}&relevanceLanguage=hi`;
      if (pageToken && pageToken !== "fallback_token") url += `&pageToken=${pageToken}`;
      if (authHeader) {
        headers.Authorization = authHeader;
      } else {
        url += `&key=${YOUTUBE_API_KEY}`;
      }

      const response = await globalThis.fetch(url, { headers });
      const data = await response.json();
      if (!response.ok) {
        console.warn(`YouTube API failed with status ${response.status}. Using fallback...`);
        return useFreeFallback(q as string, pageToken as string);
      }

      // SECONDARY REQUEST: Fetch contentDetails to get the exact duration of each video
      const videoIds = data.items.map((item: any) => item.id?.videoId).filter(Boolean).join(',');
      if (videoIds) {
        let durUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}`;
        if (!authHeader && YOUTUBE_API_KEY) durUrl += `&key=${YOUTUBE_API_KEY}`;
        
        try {
          const durResponse = await globalThis.fetch(durUrl, { headers });
          if (durResponse.ok) {
            const durData = await durResponse.json();
            const durationMap = new Map();
            durData.items?.forEach((item: any) => {
              durationMap.set(item.id, parseDurationToSeconds(item.contentDetails?.duration || "PT0S"));
            });
            
            // STRICT FILTER: Keep only videos 60 seconds or longer
            data.items = data.items.filter((item: any) => {
              const seconds = durationMap.get(item.id?.videoId);
              return seconds === undefined || seconds >= 60;
            });
          }
        } catch (durErr) {
          console.error("Failed to fetch durations for filtering:", durErr);
        }
      }

      if (!authHeader) cache.set(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error("Search error:", error);
      return useFreeFallback(q as string, pageToken as string);
    }
  });

  app.get("/api/youtube/trending", async (req, res) => {
    const { maxResults = 20, regionCode = "IN", categoryId, pageToken } = req.query;
    const authHeader = req.headers.authorization;
    
    const cacheKey = `trending_${regionCode}_${categoryId || 'all'}_${maxResults}_${pageToken || 'first'}`;
    if (!authHeader && cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }
    
    const useFreeFallback = async (pageTokenParam?: string) => {
      try {
        console.log("Using yt-search fallback for trending");
        let query = "trending india";
        if (categoryId === "10") query = "trending music india";
        if (categoryId === "28") query = "trending tech india";
        if (categoryId === "24") query = "trending comedy india";
        
        const page = parseInt(pageTokenParam as string) || 1;
        const limit = Number(maxResults);
        const start = (page - 1) * limit;
        const end = start + limit;

        const r = await yts(query);
        const videos = r.videos.slice(start, end);
        const items = videos.map(v => ({
           id: { videoId: v.videoId },
           snippet: {
               title: v.title,
               description: v.description,
               thumbnails: { medium: { url: v.thumbnail }, default: { url: v.thumbnail }, high: { url: v.thumbnail } },
               channelTitle: v.author.name,
               publishedAt: v.ago,
               channelId: v.author.url
           },
           statistics: { viewCount: v.views.toString(), likeCount: "0" }
        }));
        
        // STRICT FILTER: Remove any video under 60 seconds
        const longEnoughItems = items.filter((_, index) => {
          const rawDuration = videos[index].seconds;
          return rawDuration >= 60;
        });
        
        const nextToken = videos.length === limit ? (page + 1).toString() : undefined;
        const responseData = { items: longEnoughItems, nextPageToken: nextToken };
        if (!authHeader) cache.set(cacheKey, responseData);
        return res.json(responseData);
      } catch (err) {
        return res.status(500).json({ error: "Trending failed completely." });
      }
    };

    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "YOUR_YOUTUBE_API_KEY") {
      if (!authHeader) {
        return useFreeFallback(pageToken as string);
      }
    }

    try {
      const headers: HeadersInit = {};
      let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&maxResults=${maxResults}&regionCode=${regionCode}`;
      if (categoryId) url += `&videoCategoryId=${categoryId}`;
      if (pageToken && pageToken !== "fallback_token") url += `&pageToken=${pageToken}`;
      
      if (authHeader) {
        headers.Authorization = authHeader;
      } else {
        url += `&key=${YOUTUBE_API_KEY}`;
      }

      const response = await globalThis.fetch(url, { headers });
      const data = await response.json();
      if (!response.ok) {
        console.warn(`YouTube API failed with status ${response.status}. Using fallback...`);
        return useFreeFallback(pageToken as string);
      }

      // STRICT FILTER: Since this is the trending API, contentDetails is already included!
      if (data.items) {
        data.items = data.items.filter((item: any) => {
          const seconds = parseDurationToSeconds(item.contentDetails?.duration || "PT0S");
          return seconds >= 60;
        });
      }

      if (!authHeader) cache.set(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error("Trending error:", error);
      return useFreeFallback(pageToken as string);
    }
  });

  app.get("/api/youtube/suggest", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([q, []]);
    
    const cacheKey = `suggest_${q}`;
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }
    try {
      const url = `http://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q as string)}`;
      const response = await globalThis.fetch(url);
      const data = await response.json();
      cache.set(cacheKey, data, 3600); // cache suggestions longer
      res.json(data); // returns [query, [suggestions...]]
    } catch (error) {
      console.error("Suggest error:", error);
      res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  app.get("/api/youtube/comments", async (req, res) => {
    const { videoId, maxResults = 20 } = req.query;
    const authHeader = req.headers.authorization;

    if (!YOUTUBE_API_KEY && !authHeader) {
      return res.status(500).json({ error: "YouTube API key not configured and no auth token provided" });
    }
    if (!videoId) return res.status(400).json({ error: "videoId is required" });

    try {
      const headers: HeadersInit = {};
      let url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}`;
      if (authHeader) headers.Authorization = authHeader;
      else url += `&key=${YOUTUBE_API_KEY}`;

      const response = await globalThis.fetch(url, { headers });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.error?.message || "Failed to fetch comments" });
      }
      res.json(data);
    } catch (error) {
      console.error("Comments error:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.get("/api/youtube/subscriptions", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Auth token required for subscriptions" });

    try {
      const url = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=10`;
      const response = await globalThis.fetch(url, { headers: { Authorization: authHeader } });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message });
      res.json(data);
    } catch (error) {
      console.error("Subs error:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
