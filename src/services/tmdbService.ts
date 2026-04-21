const getApiKey = () => {
  try {
    return (import.meta as any).env.VITE_TMDB_API_KEY || (process as any).env.VITE_TMDB_API_KEY;
  } catch {
    return null;
  }
};

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
}

const EXPLICIT_KEYWORDS = ['porn', 'xxx', 'erotic', 'sex', 'nude', 'hentai', 'adult only'];

function isSafeContent(item: TMDBItem): boolean {
  if (item.adult) return false;
  
  // Basic quality filter to avoid spam/junk which often hides inappropriate content
  // Relaxed to allow more global and niche content
  if (item.vote_average !== undefined && item.vote_count !== undefined) {
    if (item.vote_average < 4 || item.vote_count < 5) return false;
  }

  const textToSearch = `${item.title || ''} ${item.name || ''} ${item.overview || ''}`.toLowerCase();
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (textToSearch.includes(keyword)) {
      return false;
    }
  }
  return true;
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
    const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('TMDb API Error:', errorData.status_message);
      return { results: [] };
    }
    const data = await response.json();
    
    // Apply safety filter if results array exists
    if (data.results && Array.isArray(data.results)) {
      data.results = data.results.filter((item: any) => isSafeContent(item) && item.poster_path);
    }
    
    return data;
  } catch (error) {
    console.error('TMDb Fetch Error:', error);
    return { results: [] };
  }
}

export const tmdbService = {
  getTrendingMovies: async (page: number = 1) => {
    const data = await fetchTMDB('/trending/movie/day', { page: page.toString() });
    return {
      results: data.results as TMDBItem[],
      totalPages: data.total_pages as number
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
      totalPages: data.total_pages as number
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
  searchMulti: async (query: string, page: number = 1) => {
    const data = await fetchTMDB('/search/multi', { query, page: page.toString() });
    return {
      results: data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv') as TMDBItem[],
      totalPages: data.total_pages as number
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
  getWatchProviders: async (id: number, type: 'movie' | 'tv') => {
    const data = await fetchTMDB(`/${type}/${id}/watch/providers`);
    return data.results;
  },
  getTranslations: async (id: number, type: 'movie' | 'tv') => {
    const data = await fetchTMDB(`/${type}/${id}/translations`);
    return data.translations as any[];
  },
  getVideos: async (id: number, type: 'movie' | 'tv') => {
    const data = await fetchTMDB(`/${type}/${id}/videos`);
    return data.results as any[];
  },
  getTrailer: async (id: string | number, type: 'movie' | 'tv' | 'anime' = 'movie') => {
    if (!API_KEY) return null;
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
  getDetails: async (id: number, type: 'movie' | 'tv') => {
    const data = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'credits,videos,recommendations,similar,release_dates,content_ratings,external_ids' });
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
      results: data.results as TMDBItem[],
      totalPages: data.total_pages as number
    };
  },
  getUpcomingSeries: async (page: number = 1) => {
    const data = await fetchTMDB('/tv/on_the_air', { page: page.toString() });
    return {
      results: data.results as TMDBItem[],
      totalPages: data.total_pages as number
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
  getSeasonDetails: async (id: number, seasonNumber: number) => {
    const data = await fetchTMDB(`/tv/${id}/season/${seasonNumber}`);
    return data;
  },
  getEpisodeDetails: async (id: number, seasonNumber: number, episodeNumber: number) => {
    const data = await fetchTMDB(`/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`);
    return data;
  }
};
