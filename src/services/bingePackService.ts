import { tmdbService } from './tmdbService';
import { jikanService } from './jikanService';
import { UserProfile } from './profileService';
import { TMDB_GENRE_MAP } from '../App'; // Need to export TMDB_GENRE_MAP from App.tsx or move it to constants

// Binge pack definition
export interface BingePack {
  id: string;
  title: string;
  description: string;
  reason: string;
  tags: string[];
  durationEstimate: string; // e.g. "8h 30m"
  items: any[];
}

const BINGE_TYPES = [
  { id: 'thriller_marathon', title: '🔥 Weekend Thriller Marathon', desc: 'Dark, intense, edge-of-seat binge', keywords: [53, 80], type: 'movie' }, // Thriller, Crime
  { id: 'anime_binge', title: '🎌 Late Night Anime Binge', desc: 'Perfect for your anime nights', keywords: [], type: 'anime' },
  { id: 'feel_good', title: '☀️ Feel Good Collection', desc: 'Lighthearted and fun to watch', keywords: [35, 10751], type: 'movie' }, // Comedy, Family
  { id: 'sci_fi_journey', title: '🚀 Sci-Fi Journey', desc: 'Mind-bending science fiction adventures', keywords: [878], type: 'movie' }, // Sci-Fi
  { id: 'romantic_night', title: '💔 Emotional Rollercoaster', desc: 'Love, heartbreak, and everything in between', keywords: [10749, 18], type: 'movie' }, // Romance, Drama
];

function orderBinge(items: any[]) {
  // Netflix-style flow: strong start, core binge, lighter ending
  if (items.length <= 4) return items;
  // This is a naive implementation. In a real app we'd sort by pacing or intensity.
  // We'll just take the highest rated for start and end, and rest in middle.
  const sorted = [...items].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  
  const start = sorted.splice(0, 2);
  const end = sorted.splice(-2);
  const core = sorted;

  return [...start, ...core, ...end];
}

export const bingePackService = {
  generateForUser: async (profile: UserProfile): Promise<BingePack[]> => {
    // Determine which packs fit the user best based on top genres
    const topGenreIds = Object.entries(profile.genres)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => parseInt(id));

    const packs: BingePack[] = [];

    for (const bingeType of BINGE_TYPES) {
      // Check if user likes this type (simplified logic)
      let score = 0;
      if (bingeType.type === 'anime' && profile.genres[16] > 0) {
          score += 10;
      }
      for (const keyword of bingeType.keywords) {
         if (profile.genres[keyword]) score += profile.genres[keyword];
      }
      
      // If none of the top genres match and score is 0, maybe skip? Let's just generate a few anyway.
      
      let items: any[] = [];
      if (bingeType.type === 'anime') {
        const data = await jikanService.getTopAnime(1);
        items = data.results || [];
      } else {
        // Fetch movies from TMDB for these genres
        const genreQuery = bingeType.keywords.join(',');
        const data = await tmdbService.getDiscover('movie', { with_genres: genreQuery, sort_by: 'popularity.desc' }, 1, 1);
        items = data.results || [];
      }

      // Personalize & Score
      const scoredItems = items.map(item => {
         let itemScore = 0;
         if (item.genre_ids) {
            for (const g of item.genre_ids) {
               if (profile.genres[g]) itemScore += profile.genres[g];
            }
         }
         return { ...item, score: itemScore };
      }).sort((a, b) => b.score - a.score).slice(0, 8); // 8 items per pack

      if (scoredItems.length >= 4) {
         const orderedItems = orderBinge(scoredItems);
         
         const avgRuntime = bingeType.type === 'tv' || bingeType.type === 'anime' ? 24 : 110;
         const totalMins = orderedItems.length * avgRuntime;
         const hours = Math.floor(totalMins / 60);
         const mins = totalMins % 60;

         packs.push({
            id: bingeType.id,
            title: bingeType.title,
            description: bingeType.desc,
            reason: `Based on your interest in ${bingeType.type === 'anime' ? 'Anime' : 'these genres'}`,
            tags: ['🧠 For You', `⏳ ${hours}h ${mins > 0 ? mins+'m' : ''} binge`, '🔥 High Intensity'],
            durationEstimate: `${hours}h ${mins > 0 ? mins+'m' : ''}`,
            items: orderedItems,
         });
      }
    }

    // Return top 2 packs based on user preference, plus 1 random
    return packs.slice(0, 3);
  }
};
