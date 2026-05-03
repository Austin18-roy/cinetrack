const getApiKey = () => {
  try {
    return (import.meta as any).env.VITE_TMDB_API_KEY || (typeof process !== 'undefined' ? (process as any).env.VITE_TMDB_API_KEY : undefined);
  } catch {
    return null;
  }
};
import { toast } from 'sonner';

const API_KEY = getApiKey();
const BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBItem {
  id: number | string;
  title?: string;
  name?: string;
  poster_path: string;
  vote_average: number;
  vote_count?: number;
  media_type?: 'movie' | 'tv' | 'anime';
  first_air_date?: string;
  release_date?: string;
  overview: string;
  adult?: boolean;
  popularity?: number;
  genre_ids?: number[];
  original_language?: string;
  trailer_key?: string;
  // Anime specific
  studios?: { mal_id: number; name: string }[];
  themes?: { mal_id: number; name: string }[];
  demographics?: { mal_id: number; name: string }[];
  score?: number;
  status?: string;
  episodes?: number;
  rating?: string;
}

const EXPLICIT_KEYWORDS = ['porn', 'xxx', 'erotic', 'sex', 'nude', 'hentai', 'adult only'];

function isSafeContent(item: TMDBItem): boolean {
  if (item.adult) return false;

  const textToSearch = `${item.title || ''} ${item.name || ''} ${item.overview || ''}`.toLowerCase();
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (textToSearch.includes(keyword)) {
      return false;
    }
  }
  return true;
}

const CACHE_TIME = 10 * 60 * 1000; // 10 min

async function smartFetch(url: string) {
  const key = `tmdb_cache_${btoa(url)}`;
  const cached = localStorage.getItem(key);
  const now = Date.now();

  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (now - timestamp < CACHE_TIME) {
        return data;
      }
    } catch(e) {}
  }

  const res = await fetch(url);
  const data = await res.json();
  
  if (res.ok) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: now }));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.message?.includes('quota') || e.message?.includes('Quota')) {
         const keysToRemove = [];
         for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith('tmdb_cache_')) {
              keysToRemove.push(k);
            }
         }
         keysToRemove.slice(0, Math.floor(keysToRemove.length / 2)).forEach(k => localStorage.removeItem(k));
         try {
           localStorage.setItem(key, JSON.stringify({ data, timestamp: now }));
         } catch(e2) {}
      }
    }
  }

  return { ok: res.ok, data };
}

async function fetchTMDB(endpoint: string, params: Record<string, string> = {}) {
  if (!API_KEY) {
    console.warn('TMDb API key is missing. Discovery features will be disabled.');
    return { results: [] };
  }

  const queryParams = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
    include_adult: 'false',
    ...params,
  });

  try {
    const url = `${BASE_URL}${endpoint}?${queryParams}`;
    const result = await smartFetch(url);
    const data = result.data || result;
    
    if (result.ok === false) {
      console.error('TMDb API Error:', data.status_message || data);
      toast.error(`TMDb API Error: ${data.status_message || 'Could not fetch data'}`, { id: 'tmdb-error' });
      return { results: [] };
    }
    
    // Apply safety filter if results array exists
    if (data.results && Array.isArray(data.results)) {
      const today = new Date();
      data.results = data.results.filter((item: any) => {
         if (!isSafeContent(item) || !item.poster_path) return false;
         
         // If endpoint explicitly is for upcoming/discover, don't filter.
         if (endpoint.includes('/upcoming') || params['primary_release_date.gte'] || params['first_air_date.gte']) {
             return true;
         }

         const dateStr = item.release_date || item.first_air_date;
         if (!dateStr) return true;
         const date = new Date(dateStr);
         return date <= today;
      });
    }
    
    return data;
  } catch (error: any) {
    console.error('TMDb Fetch Error:', error);
    if (error?.message === 'Failed to fetch') {
      toast.error('Network Error: Could not reach TMDB.', { id: 'tmdb-network-error' });
    } else {
      toast.error('TMDb Error: Error fetching data.', { id: 'tmdb-error' });
    }
    return { results: [] };
  }
}

export const tmdbService = {
  getExternalIds: async (id: number | string, type: 'movie' | 'tv') => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return null;
    const data = await fetchTMDB(`/${type}/${id}/external_ids`);
    return data.imdb_id;
  },
  getSeasonExternalIds: async (id: number | string, seasonNumber: number) => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return null;
    const data = await fetchTMDB(`/tv/${id}/season/${seasonNumber}/external_ids`);
    return data;
  },
  getEpisodeExternalIds: async (id: number | string, seasonNumber: number, episodeNumber: number) => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return null;
    const data = await fetchTMDB(`/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}/external_ids`);
    return data;
  },
  getSeasonEpisodes: async (id: number | string, seasonNumber: number) => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return [];
    const data = await fetchTMDB(`/tv/${id}/season/${seasonNumber}`);
    return data.episodes || [];
  },
  getTrendingMovies: async (page: number = 1) => {
    const data = await fetchTMDB('/trending/movie/day', { page: page.toString() });
    return {
      results: (data.results || []) as TMDBItem[],
      totalPages: (data.total_pages as number) || 1
    };
  },
  getTrendingSeries: async (page: number = 1) => {
    const data = await fetchTMDB('/trending/tv/day', { page: page.toString() });
    let results = (data.results || []) as TMDBItem[];
    // Filter out anime from TV trends (Language: ja + Genre: Animation)
    results = results.filter((item: TMDBItem) => 
      !(item.original_language === 'ja' && item.genre_ids?.includes(16))
    );
    return {
      results,
      totalPages: (data.total_pages as number) || 1
    };
  },
  getTop10ThisMonth: async (type: 'movie' | 'tv' = 'movie'): Promise<TMDBItem[]> => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const params: Record<string, string> = {
      sort_by: 'popularity.desc',
      'vote_average.gte': '6',
      page: '1'
    };

    if (type === 'movie') {
      params['primary_release_date.gte'] = firstDay;
      params['primary_release_date.lte'] = lastDay;
    } else {
      params['first_air_date.gte'] = firstDay;
      params['first_air_date.lte'] = lastDay;
    }

    const data = await fetchTMDB(`/discover/${type}`, params);
    let results = (data.results || []) as TMDBItem[];
    
    if (type === 'tv') {
      results = results.filter((item: TMDBItem) => 
        !(item.original_language === 'ja' && item.genre_ids?.includes(16))
      );
    }

    return results.slice(0, 10);
  },
  discover: async (type: 'movie' | 'tv', params: Record<string, string | number | undefined>): Promise<{results: TMDBItem[], totalPages: number}> => {
    const cleanedParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) cleanedParams[k] = String(v);
    }
    const data = await fetchTMDB(`/discover/${type}`, cleanedParams);
    return {
      results: (data.results || []) as TMDBItem[],
      totalPages: (data.total_pages as number) || 1
    };
  },
  searchMulti: async (query: string, page: number = 1) => {
    const data = await fetchTMDB('/search/multi', { query, page: page.toString() });
    return {
      results: (data.results || []).filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv') as TMDBItem[],
      totalPages: (data.total_pages as number) || 1
    };
  },
  searchMultiDeep: async (query: string, maxPages: number = 5) => {
    const promises = Array.from({ length: maxPages }, (_, i) => 
      fetchTMDB('/search/multi', { query, page: (i + 1).toString() })
    );
    const responses = await Promise.all(promises);
    
    const allItems = responses.flatMap(r => r.results || [])
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
      
    // Deduplicate by ID
    const unique = Array.from(new Map(allItems.map(item => [item.id, item])).values());
    return { results: unique as TMDBItem[] };
  },
  getWatchProviders: async (id: number | string, type: 'movie' | 'tv') => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return {};
    const data = await fetchTMDB(`/${type}/${id}/watch/providers`);
    return data.results || {};
  },
  getTranslations: async (id: number | string, type: 'movie' | 'tv') => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return [];
    const data = await fetchTMDB(`/${type}/${id}/translations`);
    return data.translations as any[] || [];
  },
  getVideos: async (id: number | string, type: 'movie' | 'tv') => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return [];
    const data = await fetchTMDB(`/${type}/${id}/videos`);
    return data.results as any[];
  },
  getTrailer: async (id: string | number, type: 'movie' | 'tv' | 'anime' = 'movie') => {
    if (!API_KEY || !id || id === 'undefined' || id === 'null') return null;
    try {
      const endpointType = type === 'anime' ? 'tv' : type;
      const res = await fetch(`https://api.themoviedb.org/3/${endpointType}/${id}/videos?api_key=${API_KEY}`);
      if (!res.ok) return null;
      const data = await res.json();
      
      if (!data?.results?.length) return null;

      const videos = data.results
        .filter((v: any) => v.site === "YouTube")
        .sort((a: any, b: any) => {
           // Prioritize official videos globally
           if (a.official && !b.official) return -1;
           if (!a.official && b.official) return 1;
           
           const priority = ["Clip", "Teaser", "Trailer"];
           const aIndex = priority.indexOf(a.type);
           const bIndex = priority.indexOf(b.type);
           
           if (aIndex === -1 && bIndex === -1) return 0;
           if (aIndex === -1) return 1;
           if (bIndex === -1) return -1;
           
           return aIndex - bIndex;
        });

      return videos.length > 0 ? videos[0].key : null;
    } catch {
      return null;
    }
  },
  getDetails: async (id: number | string, type: 'movie' | 'tv') => {
    if (!id || id === 'undefined' || id === 'null') return null;
    const data = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'credits,videos,recommendations,similar,release_dates,content_ratings,external_ids,keywords,reviews,watch/providers' });
    return data;
  },
  getRecommendations: async (id: number, type: 'movie' | 'tv') => {
    const data = await fetchTMDB(`/${type}/${id}/recommendations`);
    return data.results as TMDBItem[];
  },
  getPopularAnime: async (page: number = 1) => {
    // TMDb doesn't have a direct "anime" type, but we can filter by animation genre (16) and Japanese language (ja)
    const data = await fetchTMDB('/discover/tv', {
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
      page: page.toString()
    });
    return {
      results: data.results as TMDBItem[],
      totalPages: data.total_pages as number
    };
  },
  getTopRated: async (type: 'movie' | 'tv', page: number = 1) => {
    const data = await fetchTMDB(`/${type}/top_rated`, { page: page.toString() });
    return data.results as TMDBItem[];
  },
  getPopular: async (type: 'movie' | 'tv', page: number = 1) => {
    const data = await fetchTMDB(`/${type}/popular`, { page: page.toString() });
    return data.results as TMDBItem[];
  },
  getUpcomingMovies: async (page: number = 1) => {
    const data = await fetchTMDB('/movie/upcoming', { page: page.toString() });
    return {
      results: (data.results || []) as TMDBItem[],
      totalPages: (data.total_pages as number) || 1
    };
  },
  getUpcomingSeries: async (page: number = 1) => {
    const data = await fetchTMDB('/tv/on_the_air', { page: page.toString() });
    return {
      results: (data.results || []) as TMDBItem[],
      totalPages: (data.total_pages as number) || 1
    };
  },
  getDiscover: async (type: 'movie' | 'tv', params: Record<string, string> = {}, chunkIndex: number = 1, pagesPerChunk: number = 3) => {
    const startPage = (chunkIndex - 1) * pagesPerChunk + 1;
    const promises = Array.from({ length: pagesPerChunk }, (_, i) => 
      fetchTMDB(`/discover/${type}`, { ...params, page: (startPage + i).toString() })
    );
    const responses = await Promise.all(promises);
    
    const allItems = responses.flatMap(r => r.results || []);
    const unique = Array.from(new Map(allItems.map(item => [item.id, item])).values());
    
    return {
      results: unique as TMDBItem[],
      totalPages: Math.ceil((responses[0]?.total_pages || 1) / pagesPerChunk)
    };
  },
  getGenres: async (type: 'movie' | 'tv') => {
    const data = await fetchTMDB(`/genre/${type}/list`);
    return data.genres as { id: number; name: string }[];
  },
  getSeasonDetails: async (id: number | string, seasonNumber: number) => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return {};
    const data = await fetchTMDB(`/tv/${id}/season/${seasonNumber}`);
    return data;
  },
  getEpisodeDetails: async (id: number | string, seasonNumber: number, episodeNumber: number) => {
    if (!id || String(id) === 'undefined' || String(id) === 'null') return {};
    const data = await fetchTMDB(`/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`);
    return data;
  }
};
