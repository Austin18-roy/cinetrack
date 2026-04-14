const OMDB_API_KEY = (import.meta as any).env.VITE_OMDB_API_KEY;
const BASE_URL = 'https://www.omdbapi.com/';

export interface OMDbRatings {
  imdb?: number;
  rottenTomatoes?: number;
  metacritic?: number;
  watchScore?: number;
}

const cache = new Map<string, OMDbRatings>();

export const omdbService = {
  getRatings: async (imdbId: string): Promise<OMDbRatings | null> => {
    if (!OMDB_API_KEY) {
      console.warn('OMDb API key is missing.');
      return null;
    }

    if (!imdbId) return null;

    if (cache.has(imdbId)) {
      return cache.get(imdbId)!;
    }

    try {
      const response = await fetch(`${BASE_URL}?i=${imdbId}&apikey=${OMDB_API_KEY}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.Response === 'False') return null;

      const ratings: OMDbRatings = {};
      let totalScore = 0;
      let scoreCount = 0;

      // Extract IMDb
      if (data.imdbRating && data.imdbRating !== 'N/A') {
        const imdb = parseFloat(data.imdbRating);
        if (!isNaN(imdb)) {
          ratings.imdb = imdb;
          totalScore += imdb;
          scoreCount++;
        }
      }

      // Extract others from Ratings array
      if (data.Ratings && Array.isArray(data.Ratings)) {
        for (const r of data.Ratings) {
          if (r.Source === 'Rotten Tomatoes') {
            const rtStr = r.Value.replace('%', '');
            const rt = parseFloat(rtStr);
            if (!isNaN(rt)) {
              ratings.rottenTomatoes = rt / 10; // normalize to 10
              totalScore += ratings.rottenTomatoes;
              scoreCount++;
            }
          } else if (r.Source === 'Metacritic') {
            const mcStr = r.Value.split('/')[0];
            const mc = parseFloat(mcStr);
            if (!isNaN(mc)) {
              ratings.metacritic = mc / 10; // normalize to 10
              totalScore += ratings.metacritic;
              scoreCount++;
            }
          }
        }
      }

      if (scoreCount > 0) {
        ratings.watchScore = totalScore / scoreCount;
      }

      cache.set(imdbId, ratings);
      return ratings;
    } catch (error) {
      console.error('OMDb Fetch Error:', error);
      return null;
    }
  }
};
