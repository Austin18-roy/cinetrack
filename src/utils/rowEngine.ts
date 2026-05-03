import { UserProfile } from '../services/profileService';
import { Mood, moodMap } from '../utils/mood';

export interface RowConfig {
  id: string;
  title: string;
  type: 'trending' | 'discover' | 'provider' | 'personalized' | 'genre' | 'language' | 'curated';
  mediaType: 'movie' | 'tv' | 'anime' | 'mixed';
  filter?: {
    region?: string;
    genreIds?: number[];
    keywords?: number[];
    providerId?: number; 
    language?: string; 
    minRating?: number;
  };
}

export const MOVIE_ROWS: RowConfig[] = [
  { id: 'm_personalized_1', title: 'Top Hits For You', type: 'personalized', mediaType: 'movie' },
  { id: 'm_trending_region', title: 'Top 10 in Your Region', type: 'trending', mediaType: 'movie', filter: { region: 'US' } },
  { id: 'm_trending_today', title: 'Trending Today', type: 'trending', mediaType: 'movie' },
  { id: 'm_genre_action', title: 'Action Movies', type: 'genre', mediaType: 'movie', filter: { genreIds: [28] } },
  { id: 'm_genre_psycho', title: 'Psychological Mind Games', type: 'discover', mediaType: 'movie', filter: { genreIds: [53], keywords: [9673, 12377] } }, 
  { id: 'm_genre_drama', title: 'Heartfelt Dramas', type: 'genre', mediaType: 'movie', filter: { genreIds: [18] } },
  { id: 'm_lang_tamil', title: 'Tamil Hits', type: 'language', mediaType: 'movie', filter: { language: 'ta' } },
  { id: 'm_lang_telugu', title: 'Telugu Hits', type: 'language', mediaType: 'movie', filter: { language: 'te' } },
  { id: 'm_lang_malayalam', title: 'Malayalam Movies', type: 'language', mediaType: 'movie', filter: { language: 'ml' } },
  { id: 'm_prov_netflix', title: 'Only on Netflix', type: 'provider', mediaType: 'movie', filter: { providerId: 8 } },
  { id: 'm_prov_prime', title: 'Only on Prime Video', type: 'provider', mediaType: 'movie', filter: { providerId: 9 } },
  { id: 'm_prov_apple', title: 'Only on Apple TV+', type: 'provider', mediaType: 'movie', filter: { providerId: 350 } },
  { id: 'm_curated_gems', title: 'Hidden Gems', type: 'curated', mediaType: 'movie', filter: { minRating: 7 } },
];

export const SERIES_ROWS: RowConfig[] = [
  { id: 's_personalized_1', title: 'Binge-Worthy Shows', type: 'personalized', mediaType: 'tv' },
  { id: 's_trending_region', title: 'Top 10 Shows in Your Region', type: 'trending', mediaType: 'tv', filter: { region: 'US' } },
  { id: 's_lang_korean', title: 'K-Drama Picks', type: 'language', mediaType: 'tv', filter: { language: 'ko' } },
  { id: 's_genre_crime', title: 'Crime TV Shows', type: 'genre', mediaType: 'tv', filter: { genreIds: [80] } },
  { id: 's_genre_scifi', title: 'Sci-Fi Series', type: 'genre', mediaType: 'tv', filter: { genreIds: [10765] } },
  { id: 's_genre_highschool', title: 'Growing Pains', type: 'discover', mediaType: 'tv', filter: { keywords: [6078, 4344] } },
  { id: 's_prov_netflix', title: 'Netflix Originals', type: 'provider', mediaType: 'tv', filter: { providerId: 8 } },
  { id: 's_prov_prime', title: 'Prime Originals', type: 'provider', mediaType: 'tv', filter: { providerId: 9 } },
  { id: 's_prov_hbo', title: 'HBO Exclusives', type: 'provider', mediaType: 'tv', filter: { providerId: 118 } },
];

export const ANIME_ROWS: RowConfig[] = [
  { id: 'a_top', title: 'Top Anime Today', type: 'curated', mediaType: 'anime' },
  { id: 'a_trending', title: 'Trending Anime', type: 'trending', mediaType: 'anime' },
  { id: 'a_genre_action', title: 'Action Anime', type: 'genre', mediaType: 'anime', filter: { genreIds: [1] } },
  { id: 'a_genre_dark', title: 'Dark Anime', type: 'genre', mediaType: 'anime', filter: { genreIds: [8, 40] } },
  { id: 'a_genre_psycho', title: 'Psychological Anime', type: 'genre', mediaType: 'anime', filter: { genreIds: [40] } },
  { id: 'a_genre_romance', title: 'Romance Anime', type: 'genre', mediaType: 'anime', filter: { genreIds: [22] } },
];

export const COMING_SOON_ROWS: RowConfig[] = [
  { id: 'cs_week', title: 'Coming This Week', type: 'discover', mediaType: 'mixed' },
  { id: 'cs_month', title: 'Coming This Month', type: 'discover', mediaType: 'mixed' },
];

export function scoreItem(item: any, profile: UserProfile, currentMood?: Mood) {
  let score = 0;
  
  const genreIds = item.genre_ids || item.genreIds || [];
  genreIds.forEach((g: number) => {
    if (profile.genres[g]) score += profile.genres[g] * 2; // boost personal taste
  });

  if (item.original_language && profile.languages[item.original_language]) {
    score += profile.languages[item.original_language];
  }

  // Boost for mood
  if (currentMood && currentMood !== 'all' && moodMap[currentMood]) {
    // simplified implementation
  }

  if (item.vote_average && item.vote_average >= 8) score += 2;
  if (item.popularity && item.popularity > 1000) score += 1;

  if (profile.seenItems.includes(item.id?.toString())) score -= 10;

  return score;
}

export function scoreRow(row: RowConfig, profile: UserProfile, currentMood?: Mood) {
  let score = 0;
  if (row.type === 'personalized') score += 10;
  if (row.type === 'trending') score += 6;
  
  if (row.filter?.genreIds) {
    row.filter.genreIds.forEach((g: number) => {
      if (profile.genres[g] > 0) score += 8;
    });
  }

  if (row.filter?.language && profile.languages[row.filter.language] > 0) {
    score += 5;
  }

  // BOOST BASED ON MOOD
  if (currentMood && currentMood !== 'all') {
     const moodKeywords = currentMood === 'hype' ? ['Action', 'Sci-Fi', 'Sports', 'Anime'] :
                          currentMood === 'chill' ? ['Comedy', 'Romance', 'Family', 'Hits'] :
                          currentMood === 'sad' ? ['Drama', 'Romance', 'Heartfelt', 'Gems'] :
                          currentMood === 'dark' ? ['Crime', 'Psychological', 'Thriller', 'Horror', 'Dark'] : [];

     // Naive but effective title matching for row reordering
     if (moodKeywords.some(kw => row.title.includes(kw))) {
         score += 50; // Massively boost to put at top
     }
  }

  return score;
}

export function getRankedRows(rows: RowConfig[], profile: UserProfile, currentMood?: Mood) {
  return [...rows]
    .map(row => ({ ...row, score: scoreRow(row, profile, currentMood) }))
    .sort((a, b) => b.score - a.score);
}
