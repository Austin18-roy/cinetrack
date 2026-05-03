import { TMDBItem } from './tmdbService';

export function cleanQuery(q: string) {
  const stopWords = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "with", "about", "as", "into", "like", "through", "after", "over", "between", "out", "against", "during", "without", "before", "under", "around", "among", "of", "in", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should", "may", "might", "must", "can", "could", "it", "this", "that", "these", "those", "they", "them", "their", "he", "him", "his", "she", "her", "hers", "we", "us", "our", "you", "your", "yours", "i", "me", "my", "mine", "what", "which", "who", "whom", "whose", "where", "when", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very"]);
  return q.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => Boolean(w) && !stopWords.has(w));
}

const GENRE_MAP: Record<string, number[]> = {
  // TMDB Genres
  action: [28, 10759],
  adventure: [12, 10759],
  animation: [16],
  anime: [16],
  comedy: [35],
  funny: [35],
  laugh: [35],
  crime: [80],
  documentary: [99],
  drama: [18],
  emotional: [18],
  sad: [18],
  family: [10751],
  fantasy: [14],
  history: [36],
  historical: [36],
  horror: [27],
  scary: [27],
  music: [10402],
  mystery: [9648],
  romance: [10749],
  romantic: [10749],
  love: [10749],
  scifi: [878, 10765],
  "sci-fi": [878, 10765],
  science: [878, 10765],
  thriller: [53],
  suspense: [53],
  war: [10752, 10768],
  western: [37],
};

const ANIME_GENRE_MAP: Record<string, number[]> = {
  action: [1],
  adventure: [2],
  comedy: [4],
  drama: [8],
  fantasy: [10],
  horror: [14],
  romance: [22],
  scifi: [24],
  "sci-fi": [24],
  suspense: [41]
};

export function scoreItem(item: any, words: string[]): number {
  let score = 0;

  const text = (
    (item.title || item.name || "") + " " + 
    (item.overview || "") + " " + 
    (item.original_title || "")
  ).toLowerCase();

  let matchedWords = 0;
  words.forEach(word => {
    // Exact word boundary gives high score, partial gives lower
    const regexExact = new RegExp(`\\b${word}\\b`, 'i');
    if (regexExact.test(text)) {
      score += 3;
      matchedWords++;
    } else if (text.includes(word)) {
      score += 1;
    }
  });
  
  // If no words matched text directly, ensure it doesn't get high priority
  
  // Genre boost
  let genreMatched = false;
  words.forEach(word => {
    if (GENRE_MAP[word]) {
      GENRE_MAP[word].forEach(id => {
        if (item.genre_ids?.includes(id)) {
          score += 2;
          genreMatched = true;
        }
      });
    }
    // Anime genre boost if it's an anime item
    if ((item.media_type === 'anime' || (item.id && String(item.id).startsWith('jikan'))) && ANIME_GENRE_MAP[word]) {
      ANIME_GENRE_MAP[word].forEach(id => {
        if (item.genre_ids?.includes(id) || item.genres?.some((g: any) => g.mal_id === id)) {
           score += 2;
           genreMatched = true;
        }
      });
    }
  });

  // Rating boost
  if (item.vote_average > 8) score += 2;
  else if (item.vote_average > 7) score += 1;
  
  // Recency/Popularity boost
  if (item.popularity > 100) score += 1;
  
  // Penalty if nothing matched
  if (matchedWords === 0 && !genreMatched) {
    score -= 10;
  }

  return score;
}

export function explain(item: any, query: string): string {
  const words = cleanQuery(query);
  const text = ((item.title || item.name || "") + " " + (item.overview || "")).toLowerCase();
  
  const matched = words.filter(w => text.includes(w) || GENRE_MAP[w]);
  
  if (matched.length > 0) {
    const tags = matched.slice(0, 3).join(", ");
    return `Matches your interest in ${tags}`;
  }
  
  if (item.vote_average > 8) {
    return `Highly acclaimed match based on your search`;
  }
  
  return `Matches the general vibe of your search`;
}
