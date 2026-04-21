import { GENRE_MAP } from './smartEngineService';

export function getGenres(item: any): string[] {
  if (item.genre_ids && Array.isArray(item.genre_ids)) {
    return item.genre_ids.map((id: number) => GENRE_MAP[id]).filter(Boolean);
  }
  if (item.genres && Array.isArray(item.genres)) {
    return item.genres.map((g: any) => g.name || g).filter(Boolean);
  }
  return [];
}

export function normalizeItem(item: any) {
  return {
    ...item,
    normalizedGenres: getGenres(item),
    normalizedLanguage: item.original_language || item.language,
    normalizedRating: item.vote_average || item.score || 0,
    normalizedYear: parseInt((item.release_date || item.first_air_date || item.year?.toString() || "").split("-")[0] || "0")
  };
}

export function applyFilters(data: any[], filters: { genres: string[], language: string | null, rating: number | null, year: number | null }) {
  return data.filter(rawItem => {
    const item = normalizeItem(rawItem);

    // 🎭 Genre
    if (filters.genres.length > 0) {
      if (!filters.genres.every(g => item.normalizedGenres.some((ig: string) => ig.toLowerCase() === g.toLowerCase()))) return false;
    }

    // 🌍 Language
    if (filters.language && filters.language !== 'all') {
      if (item.normalizedLanguage !== filters.language) return false;
    }

    // ⭐ Rating (Threshold)
    if (filters.rating && filters.rating > 0) {
      if (item.normalizedRating < filters.rating) return false;
    }

    // 📅 Year (Threshold, e.g., 2020+)
    if (filters.year && filters.year > 0) {
      if (item.normalizedYear < filters.year) return false;
    }

    return true;
  });
}
