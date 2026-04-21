import { TMDBItem } from './tmdbService';

const BASE_URL = 'https://api.jikan.moe/v4';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Jikan API has rate limits (3 requests per second, 60 per minute)
async function fetchJikan(endpoint: string, params: Record<string, string> = {}, retries = 3) {
  const queryParams = new URLSearchParams(params);
  const url = `${BASE_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      await delay(500 + (1000 * i)); // Incremental delay
      const response = await fetch(url);
      if (response.status === 429) {
          console.warn('Jikan Rate Limit (429). Retrying...');
          continue;
      }
      if (!response.ok) {
        console.error('Jikan API Error:', response.status, response.statusText);
        // Only return empty if it's the last retry
        if (i === retries - 1) return { data: [], pagination: { has_next_page: false, last_visible_page: 1 } };
        continue;
      }
      return await response.json();
    } catch (error) {
      console.warn(`Jikan Fetch failed attempt ${i + 1}`, error);
      if (i === retries - 1) {
        console.error('Jikan Fetch Final Error:', error);
        return { data: [], pagination: { has_next_page: false, last_visible_page: 1 } };
      }
    }
  }
}

function mapJikanToTMDB(anime: any): TMDBItem {
  const poster = anime.images?.webp?.large_image_url || 
                 anime.images?.jpg?.large_image_url || 
                 anime.images?.webp?.image_url || 
                 anime.images?.jpg?.image_url || 
                 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop';

  return {
    id: `jikan_${anime.mal_id}`,
    title: anime.title_english || anime.title,
    name: anime.title_english || anime.title,
    poster_path: poster,
    vote_average: anime.score || 0,
    vote_count: anime.scored_by || 0,
    media_type: 'anime',
    first_air_date: anime.aired?.from ? anime.aired.from.split('T')[0] : undefined,
    release_date: anime.aired?.from ? anime.aired.from.split('T')[0] : undefined,
    overview: anime.synopsis || 'No synopsis available.',
    adult: anime.rating === 'Rx - Hentai',
    popularity: anime.members || 0,
    genre_ids: anime.genres?.map((g: any) => g.mal_id) || [],
    trailer_key: anime.trailer?.youtube_id,
    // Extra fields for AI and tracking
    studios: anime.studios?.map((s: any) => ({ mal_id: s.mal_id, name: s.name })) || [],
    themes: anime.themes?.map((t: any) => ({ mal_id: t.mal_id, name: t.name })) || [],
    demographics: anime.demographics?.map((d: any) => ({ mal_id: d.mal_id, name: d.name })) || [],
    score: anime.score,
    status: anime.status,
    episodes: anime.episodes,
  };
}

export const jikanService = {
  getTopAnime: async (page: number = 1) => {
    const data = await fetchJikan('/top/anime', { page: page.toString() });
    return {
      results: (data.data || []).filter((a: any) => a.images?.webp?.image_url || a.images?.jpg?.image_url).map(mapJikanToTMDB),
      totalPages: data.pagination?.last_visible_page || 1
    };
  },
  getTop10ThisMonth: async (): Promise<TMDBItem[]> => {
    const data = await fetchJikan('/top/anime', { filter: 'bypopularity', page: '1' });
    return (data.data || []).filter((a: any) => a.images?.webp?.image_url || a.images?.jpg?.image_url).slice(0, 10).map(mapJikanToTMDB);
  },
  getAiringAnime: async (page: number = 1) => {
    const data = await fetchJikan('/top/anime', { filter: 'airing', page: page.toString() });
    return {
      results: (data.data || []).filter((a: any) => a.images?.webp?.image_url || a.images?.jpg?.image_url).map(mapJikanToTMDB),
      totalPages: data.pagination?.last_visible_page || 1
    };
  },
  getUpcomingAnime: async (page: number = 1) => {
    const data = await fetchJikan('/seasons/upcoming', { page: page.toString() });
    return {
      results: (data.data || []).filter((a: any) => a.images?.webp?.image_url || a.images?.jpg?.image_url).map(mapJikanToTMDB),
      totalPages: data.pagination?.last_visible_page || 1
    };
  },
  getHiddenGems: async (page: number = 1) => {
    // Hidden gems: High score, but not in top popularity
    // We can fetch top rated and filter by popularity or just use a different filter
    const data = await fetchJikan('/top/anime', { filter: 'favorite', page: page.toString() });
    return {
      results: (data.data || []).filter((a: any) => a.images?.webp?.image_url || a.images?.jpg?.image_url).map(mapJikanToTMDB),
      totalPages: data.pagination?.last_visible_page || 1
    };
  },
  getSeasonalAnime: async (page: number = 1) => {
    const data = await fetchJikan('/seasons/now', { page: page.toString() });
    return {
      results: (data.data || []).filter((a: any) => a.images?.webp?.image_url || a.images?.jpg?.image_url).map(mapJikanToTMDB),
      totalPages: data.pagination?.last_visible_page || 1
    };
  },
  searchAnime: async (query: string, page: number = 1) => {
    const data = await fetchJikan('/anime', { q: query, page: page.toString() });
    return {
      results: (data.data || []).filter((a: any) => a.images?.webp?.image_url || a.images?.jpg?.image_url).map(mapJikanToTMDB),
      totalPages: data.pagination?.last_visible_page || 1
    };
  },
  searchAnimeDeep: async (query: string, maxPages: number = 2) => {
    // Jikan has strict rate limits, so we fetch sequentially
    const allItems = [];
    for (let i = 1; i <= maxPages; i++) {
      const data = await fetchJikan('/anime', { q: query, page: i.toString() });
      if (data.data) {
        allItems.push(...data.data.map(mapJikanToTMDB));
      }
      if (!data.pagination?.has_next_page) break;
    }
    // Deduplicate by ID
    const unique = Array.from(new Map(allItems.map(item => [item.id, item])).values());
    return { results: unique };
  },
  getAnimeByGenre: async (genreId: number, page: number = 1) => {
    const data = await fetchJikan('/anime', { genres: genreId.toString(), page: page.toString() });
    return {
      results: (data.data || []).filter((a: any) => a.images?.webp?.image_url || a.images?.jpg?.image_url).map(mapJikanToTMDB),
      totalPages: data.pagination?.last_visible_page || 1
    };
  },
  getAnimeDetails: async (id: number) => {
    const data = await fetchJikan(`/anime/${id}/full`);
    const anime = data.data;
    if (!anime) return null;
    
    // Map to a format similar to TMDB details
    return {
      ...mapJikanToTMDB(anime),
      genres: anime.genres || [],
      runtime: anime.duration ? parseInt(anime.duration) : null,
      original_language: 'ja',
      credits: {
        cast: (anime.characters || []).map((c: any) => ({
          id: c.character.mal_id,
          name: c.character.name,
          character: c.role,
          profile_path: c.character.images?.jpg?.image_url
        })),
        crew: (anime.staff || []).map((s: any) => ({
          id: s.person.mal_id,
          name: s.person.name,
          job: s.positions.join(', '),
          department: s.positions.includes('Director') ? 'Directing' : 'Production',
          profile_path: s.person.images?.jpg?.image_url
        }))
      },
      production_companies: anime.studios || [],
      similar: {
        results: (anime.relations || [])
          .filter((r: any) => r.relation === 'Sequel' || r.relation === 'Prequel' || r.relation === 'Alternative setting')
          .flatMap((r: any) => r.entry)
          .map((e: any) => ({ id: `jikan_${e.mal_id}`, title: e.name, media_type: 'anime' }))
      },
      recommendations: {
        results: [] // Jikan has a separate endpoint for recommendations, but we can leave this empty or fetch it
      },
      videos: {
        results: anime.trailer?.youtube_id ? [{
          key: anime.trailer.youtube_id,
          site: 'YouTube',
          type: 'Trailer'
        }] : []
      }
    };
  },
  getAnimeEpisodes: async (id: number, page: number = 1) => {
    const data = await fetchJikan(`/anime/${id}/episodes`, { page: page.toString() });
    return data;
  }
};
