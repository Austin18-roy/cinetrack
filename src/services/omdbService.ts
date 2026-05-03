const OMDB_API_KEY = (import.meta as any).env.VITE_OMDB_API_KEY;
const BASE_URL = 'https://www.omdbapi.com/';

export interface OMDbRatings {
  imdb?: number;
  imdbVotes?: string;
  rottenTomatoes?: number;
  metacritic?: number;
  watchScore?: number;
}

const cache = new Map<string, OMDbRatings>();

export const omdbService = {
  getSeasonEpisodes: async (imdbId: string, season: number) => {
    if (!OMDB_API_KEY) return null;
    try {
      const response = await fetch(`${BASE_URL}?i=${imdbId}&Season=${season}&apikey=${OMDB_API_KEY}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.Episodes;
    } catch (e) {
      console.error("OMDb Fetch Error:", e);
      return null;
    }
  },
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

      // Extract IMDb and validate with votes
      if (data.imdbRating && data.imdbRating !== 'N/A') {
        let imdb = parseFloat(data.imdbRating);
        if (!isNaN(imdb)) {
          const numVotes = parseInt(data.imdbVotes?.replace(/,/g, "") || "0");
          // Low votes -> unreliable, penalize by 0.5
          if (numVotes < 500) {
             imdb = Math.max(0, parseFloat((imdb - 0.5).toFixed(1)));
          }
          ratings.imdb = imdb;
          ratings.imdbVotes = data.imdbVotes;
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
              ratings.rottenTomatoes = rt; // Keep as percentage
              totalScore += (rt / 10);
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
    } catch (error: any) {
      // OMDb typically fails with CORS or "Failed to fetch" if the API key is incorrect or blocked
      console.warn('OMDb Fetch Warning: Failed to fetch ratings. Double check your VITE_OMDB_API_KEY if you want OMDb ratings.');
      return null;
    }
  }
};
