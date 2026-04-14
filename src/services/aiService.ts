import { GoogleGenAI, Type } from "@google/genai";
import { TMDBItem } from "./tmdbService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AIVerdict {
  verdict: 'Must Watch' | 'Worth Watching' | 'Depends on Taste' | 'Skip';
  reason: string;
  pros: string[];
  cons: string[];
  summary: string;
  targetAudience: string[];
  whyWatch: string;
}

export interface VibeParams {
  media_type?: 'movie' | 'tv';
  with_genres?: string;
  primary_release_year?: number;
  'primary_release_date.gte'?: string;
  'primary_release_date.lte'?: string;
  with_original_language?: string;
  query?: string; // fallback search query
  themes?: string[];
  tone?: string;
}

export interface VibeExplanation {
  id: number;
  explanation: string;
  whyNot: string;
  verdict: 'Must Watch' | 'Worth Watching' | 'Depends on Taste' | 'Skip';
  matchPercentage: number;
}

export const aiService = {
  getVerdictAndSummary: async (
    item: TMDBItem, 
    details: any, 
    watchScore: number | null, 
    userGenres: number[]
  ): Promise<AIVerdict | null> => {
// ... (rest of getVerdictAndSummary) ...
    try {
      const prompt = `
        Analyze the following movie/TV show and provide a verdict and review summary.
        
        Title: ${item.title || item.name}
        Overview: ${item.overview}
        Genres: ${details?.genres?.map((g: any) => g.name).join(', ')}
        WatchScore (out of 10): ${watchScore !== null ? watchScore : 'N/A'}
        Popularity: ${item.popularity}
        
        User's favorite genre IDs (if any): ${userGenres.join(', ')}
        Item's genre IDs: ${item.genre_ids?.join(', ')}
        
        Calculate a match based on:
        - WatchScore
        - Genre match with user's favorites
        - Popularity
        
        Provide:
        1. A verdict: "Must Watch" (score >= 8 and high match), "Worth Watching" (score 6.5-8), "Depends on Taste" (mixed signals), or "Skip" (score < 6).
        2. A 1-sentence reason for the verdict (e.g., "Strong action and emotional depth, highly rated and matches your taste").
        3. 2-3 Pros (short bullets).
        4. 1-2 Cons (short bullets).
        5. A 1-sentence summary line (e.g., "Critically acclaimed for storytelling, but may feel slow to some viewers").
        6. A list of 2-3 target audiences (e.g., ["Action lovers", "Anime fans", "Romance viewers"]).
        7. A short "Why Watch This" explanation (e.g., "Fast-paced thriller with strong emotional story").
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING, enum: ['Must Watch', 'Worth Watching', 'Depends on Taste', 'Skip'] },
              reason: { type: Type.STRING },
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              cons: { type: Type.ARRAY, items: { type: Type.STRING } },
              summary: { type: Type.STRING },
              targetAudience: { type: Type.ARRAY, items: { type: Type.STRING } },
              whyWatch: { type: Type.STRING }
            },
            required: ["verdict", "reason", "pros", "cons", "summary", "targetAudience", "whyWatch"]
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as AIVerdict;
      }
      return null;
    } catch (error) {
      console.error("AI Verdict Error:", error);
      return null;
    }
  },

  parseVibeQuery: async (query: string): Promise<VibeParams | null> => {
// ... (rest of parseVibeQuery) ...
    try {
      const prompt = `
        Parse the following user request for a movie or TV show into search parameters for the TMDb API.
        
        User Request: "${query}"
        
        Extract:
        - media_type: 'movie' or 'tv' (if unspecified, leave null)
        - with_genres: comma-separated genre IDs (e.g., Action=28, Comedy=35, Drama=18, Animation=16, Thriller=53, Romance=10749, Sci-Fi=878, Horror=27, Anime=16)
        - primary_release_year: specific year if mentioned
        - primary_release_date.gte: start date if a period is mentioned (e.g., "1990-01-01" for 90s, "1900-01-01" for all time)
        - primary_release_date.lte: end date if a period is mentioned (e.g., "1999-12-31" for 90s, "2026-12-31" for present)
        - with_original_language: Use language groups if a region is mentioned: 'hi|ta|te|ml' for Indian, 'zh' for Chinese, 'en|fr|de|es|it' for European, 'ja|ko' for Asian, 'ar|ru|tr' for Others. Or specific ISO 639-1 code if a single language is explicitly requested.
        - query: A fallback text search query if specific keywords or titles are mentioned.
        - themes: Array of strings representing the core themes or story elements (e.g., ["revenge", "love", "disability", "space exploration"]).
        - tone: A string representing the emotional tone (e.g., "dark", "funny", "emotional", "scary").
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              media_type: { type: Type.STRING, enum: ['movie', 'tv'] },
              with_genres: { type: Type.STRING },
              primary_release_year: { type: Type.INTEGER },
              'primary_release_date.gte': { type: Type.STRING },
              'primary_release_date.lte': { type: Type.STRING },
              with_original_language: { type: Type.STRING },
              query: { type: Type.STRING },
              themes: { type: Type.ARRAY, items: { type: Type.STRING } },
              tone: { type: Type.STRING }
            }
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as VibeParams;
      }
      return null;
    } catch (error) {
      console.error("AI Parse Query Error:", error);
      return null;
    }
  },

  explainRecommendations: async (query: string, items: TMDBItem[], parsedParams?: VibeParams | null): Promise<VibeExplanation[]> => {
    try {
      const itemsData = items.map(item => ({
        id: item.id,
        title: item.title || item.name,
        overview: item.overview,
        rating: item.vote_average
      }));

      const prompt = `
        The user asked for: "${query}"
        ${parsedParams?.themes ? `Extracted Themes: ${parsedParams.themes.join(', ')}` : ''}
        ${parsedParams?.tone ? `Extracted Tone: ${parsedParams.tone}` : ''}
        
        Here are the top candidate recommendations found:
        ${JSON.stringify(itemsData, null, 2)}
        
        Your task is to act as a semantic, story-based AI recommender.
        1. Analyze the overviews of these candidates against the user's requested themes, tone, and story intent.
        2. Select the TOP 5 most relevant items from the list provided.
        3. For each of the selected 5 items, provide:
           - A matchPercentage (0-100) representing how well the story/themes match the user's intent.
           - A 1-sentence explanation of why it matches the user's specific story/theme request ("Why this?").
           - A 1-sentence caveat or reason it might not be a perfect fit ("Why not?").
           - A verdict based on its rating and relevance: "Must Watch", "Worth Watching", "Depends on Taste", or "Skip".
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                matchPercentage: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                whyNot: { type: Type.STRING },
                verdict: { type: Type.STRING, enum: ['Must Watch', 'Worth Watching', 'Depends on Taste', 'Skip'] }
              },
              required: ["id", "matchPercentage", "explanation", "whyNot", "verdict"]
            }
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as VibeExplanation[];
      }
      return [];
    } catch (error) {
      console.error("AI Explain Error:", error);
      return [];
    }
  }
};
