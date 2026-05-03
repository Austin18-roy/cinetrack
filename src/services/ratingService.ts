import { tmdbService } from './tmdbService';
import { omdbService } from './omdbService';

export function normalizeRatings({ imdb, tmdb, rotten }: { imdb?: number | null, tmdb?: number | null, rotten?: number | string | null }) {
  const imdbScore = imdb ? parseFloat(imdb as any) : null;
  const tmdbScore = tmdb ? parseFloat(tmdb as any) : null;
  const rottenScore = rotten 
    ? typeof rotten === 'string' 
      ? parseInt(rotten.replace("%", "")) / 10
      : (rotten as number) / 10
    : null;
    
  return { imdbScore, tmdbScore, rottenScore };
}

export function getWeightedScore({ imdbScore, rottenScore, tmdbScore }: { imdbScore: number | null, rottenScore: number | null, tmdbScore: number | null }) {
  let score = 0;
  let totalWeight = 0;
  
  if (imdbScore) {
    score += imdbScore * 0.5;
    totalWeight += 0.5;
  }
  if (rottenScore) {
    score += rottenScore * 0.3;
    totalWeight += 0.3;
  }
  if (tmdbScore) {
    score += tmdbScore * 0.2;
    totalWeight += 0.2;
  }
  
  if (totalWeight === 0) return null;
  return (score / totalWeight).toFixed(1);
}

export function getFinalRating(data: { imdb?: number | null, tmdb?: number | null, rotten?: number | string | null }) {
  const { imdbScore, rottenScore, tmdbScore } = normalizeRatings(data);
  return getWeightedScore({ imdbScore, rottenScore, tmdbScore });
}

export function getRatingBadge(scoreStr: string | null) {
  if (!scoreStr) return "❌ No Rating";
  const score = parseFloat(scoreStr);
  if (score >= 8.5) return "🔥 Masterpiece";
  if (score >= 7.5) return "⭐ Excellent";
  if (score >= 6.5) return "👍 Good";
  if (score >= 5.5) return "⚠️ Average";
  return "❌ Poor";
}

export async function fetchUniversalRatings(tmdbId: number | string, type: 'movie' | 'tv') {
  // 1. Get IMDb ID from TMDb
  const imdbId = await tmdbService.getExternalIds(tmdbId, type);
  if (!imdbId) return null;
  
  // 2. Fetch OMDb using IMDb ID
  const omdbData = await omdbService.getRatings(imdbId);
  return omdbData;
}
