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
  media_type?: 'movie' | 'tv' | 'anime';
  with_genres?: string;
  primary_release_year?: number;
  'primary_release_date.gte'?: string;
  'primary_release_date.lte'?: string;
  with_original_language?: string;
  query?: string; // fallback search query
  themes?: string[];
  tone?: string;
  refinement?: 'more action' | 'less romance' | 'darker' | 'funnier' | 'shorter' | 'longer' | string;
}

export interface VibeExplanation {
  id: number | string;
  explanation: string;
  whyNot: string;
  verdict: 'Must Watch' | 'Worth Watching' | 'Depends on Taste' | 'Skip';
  badge: 'Top Pick' | 'Trending' | 'Must Watch' | 'Hidden Gem' | 'Highly Rated';
  rank: number;
}

export const aiService = {
  // ... (getVerdictAndSummary remains similar but can be updated if needed)
  getVerdictAndSummary: async (
    item: TMDBItem, 
    details: any, 
    watchScore: number | null, 
    userGenres: number[]
  ): Promise<AIVerdict | null> => {
    try {
      const cacheKey = `ai-verdict-${item.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Simulate a tiny delay to feel like "AI thinking" (improves perceived value)
      await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 400));

      const rating = item.vote_average || 0;
      const votes = item.vote_count || 0;
      const popularity = item.popularity || 0;
      const genres = Array.from(new Set([
        ...(item.genre_ids || []),
        ...(details?.genres?.map((g: any) => g.id) || [])
      ]));

      // 1. Core Logic Engine
      let pros: string[] = [];
      let cons: string[] = [];
      let verdict: 'Must Watch' | 'Worth Watching' | 'Depends on Taste' | 'Skip' = 'Depends on Taste';

      if (rating >= 8) {
        pros.push("Critically acclaimed and highly rated");
        verdict = "Must Watch";
      } else if (rating >= 7) {
        pros.push("Well received by global audiences");
        verdict = "Worth Watching";
      } else if (rating > 0 && rating < 6) {
        cons.push("Mixed or below average reception");
        verdict = "Skip";
      }

      if (popularity > 150) {
        pros.push("Trending globally right now");
      } else if (rating > 0 && popularity < 15) {
        cons.push("Niche title with limited widespread appeal");
      }

      const isComedy = genres.includes(35) || genres.includes(4);
      const isDrama = genres.includes(18) || genres.includes(8);
      const isAction = genres.includes(28) || genres.includes(1);
      const isSciFi = genres.includes(878) || genres.includes(24);
      const isHorror = genres.includes(27) || genres.includes(14);
      const isRomance = genres.includes(10749) || genres.includes(22);
      const isAnimation = genres.includes(16) || genres.includes(2);

      if (isDrama) pros.push("Strong emotional storytelling");
      if (isComedy) pros.push("Entertaining and light-hearted");
      if (isHorror) cons.push("Intense themes; not suitable for all audiences");
      if (isAction) pros.push("Fast-paced action sequences");
      if (isSciFi) pros.push("Engaging and immersive concepts");
      
      const extraPros = [
        "Engaging character development",
        "Strong performances by the cast",
        "Visually appealing cinematography",
        "Great pacing"
      ];

      // Smart randomization for higher rated films
      if (rating > 7) {
        pros.push(extraPros[Math.floor(Math.random() * extraPros.length)]);
      }

      if (votes > 0 && votes < 50) {
        cons.push("Limited audience feedback so far");
      }

      let matchesTaste = false;
      if (userGenres && userGenres.length > 0) {
        const matchingGenres = genres.filter(g => userGenres.includes(g));
        if (matchingGenres.length > 0) {
          pros.unshift("Matches your taste perfectly");
          matchesTaste = true;
          if (verdict === 'Depends on Taste' && rating >= 6.5) {
            verdict = 'Worth Watching';
          }
        }
      }

      // Cleanup pros and cons to reasonable bounds
      pros = Array.from(new Set(pros)).slice(0, 4);
      cons = Array.from(new Set(cons)).slice(0, 2);

      if (pros.length === 0) pros.push("An intriguing concept");
      if (cons.length === 0) cons.push("Pacing may not appeal to everyone");

      // 2. Audience Fitting
      let targetAudience = ["General audiences"];
      if (isRomance) targetAudience = ["Romance lovers", "Fans of emotional stories"];
      else if (isAction) targetAudience = ["Action fans", "Thrill seekers"];
      else if (isAnimation) targetAudience = ["Animation enthusiasts", "Families"];
      else if (isDrama) targetAudience = ["Drama audience", "Story-driven viewers"];

      // 3. Why Watch
      let whyWatch = "A solid title based on standard metrics.";
      if (popularity > 200) {
        whyWatch = "It's trending worldwide and widely discussed.";
      } else if (rating > 7.5) {
        whyWatch = "Highly rated by audiences and critically praised.";
      } else if (matchesTaste) {
        whyWatch = "It aligns excellently with your specific genre preferences.";
      }

      // 4. Reason
      let reason = "Analysis based on global metadata and your preferences.";
      if (verdict === 'Must Watch') reason = "Exceptional critical acclaim and matching elements make this a top tier recommendation.";
      else if (verdict === 'Worth Watching') reason = "Solid ratings and engaging themes make this an enjoyable watch.";
      else if (verdict === 'Depends on Taste') reason = "Reception is mixed; relies heavily on your personal genre preferences.";
      else if (verdict === 'Skip') reason = "Low ratings and mixed reception suggest spending your time elsewhere.";

      const summary = item.overview ? (item.overview.length > 120 ? item.overview.substring(0, 117) + '...' : item.overview) : 'A popular title worth checking out.';

      const result: AIVerdict = {
        verdict,
        reason,
        pros,
        cons,
        summary,
        targetAudience: targetAudience.slice(0, 3),
        whyWatch
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (e) {
        // Handle local storage quota exceptions silently
      }

      return result;
    } catch (error) {
      console.error("Local Insight Engine Error:", error);
      return null;
    }
  },

  parseVibeQuery: async (query: string, history?: string): Promise<VibeParams | null> => {
    try {
      const prompt = `
        Parse the following user request for a movie, TV show, or Anime into search parameters.
        
        User Request: "${query}"
        ${history ? `Context (previous feedback): "${history}"` : ''}
        
        Extract:
        - media_type: 'movie', 'tv', or 'anime' (if unspecified, leave null)
        - with_genres: comma-separated genre IDs (TMDb: Action=28, Comedy=35, Drama=18, Animation=16, Thriller=53, Romance=10749, Sci-Fi=878, Horror=27. Jikan/Anime: Action=1, Adventure=2, Comedy=4, Drama=8, Fantasy=10, Romance=22, Sci-Fi=24, Horror=14)
        - primary_release_year: specific year if mentioned
        - primary_release_date.gte: start date if a period is mentioned (e.g., "1990-01-01" for 90s)
        - primary_release_date.lte: end date if a period is mentioned
        - with_original_language: ISO 639-1 code (e.g., 'ja' for Japanese, 'ko' for Korean, 'hi' for Hindi)
        - query: A fallback text search query if specific keywords or titles are mentioned.
        - themes: Array of strings representing core themes (e.g., ["revenge", "love", "disability", "space exploration"]).
        - tone: A string representing the emotional tone (e.g., "dark", "funny", "emotional", "scary").
        - refinement: If the user says "more action" or "less romance", extract that specific feedback.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              media_type: { type: Type.STRING, enum: ['movie', 'tv', 'anime'] },
              with_genres: { type: Type.STRING },
              primary_release_year: { type: Type.INTEGER },
              'primary_release_date.gte': { type: Type.STRING },
              'primary_release_date.lte': { type: Type.STRING },
              with_original_language: { type: Type.STRING },
              query: { type: Type.STRING },
              themes: { type: Type.ARRAY, items: { type: Type.STRING } },
              tone: { type: Type.STRING },
              refinement: { type: Type.STRING }
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
        rating: item.vote_average,
        genres: item.genre_ids
      }));

      const prompt = `
        The user asked for: "${query}"
        ${parsedParams?.themes ? `Extracted Themes: ${parsedParams.themes.join(', ')}` : ''}
        ${parsedParams?.tone ? `Extracted Tone: ${parsedParams.tone}` : ''}
        ${parsedParams?.refinement ? `User Refinement: ${parsedParams.refinement}` : ''}
        
        Here are the top candidate recommendations found:
        ${JSON.stringify(itemsData, null, 2)}
        
        Your task is to act as a semantic, story-based AI recommender.
        1. Analyze the overviews of these candidates against the user's requested themes, tone, and story intent.
        2. Rank the TOP 5 items from #1 to #5.
        3. For each of the selected 5 items, provide:
           - A rank (1-5).
           - A badge: "Top Pick" (for #1), "Trending" (if popular), "Must Watch" (high rating), "Hidden Gem" (low popularity but high quality), or "Highly Rated".
           - A 1-sentence explanation of why it matches the user's specific story/theme request ("Why this?").
           - A 1-sentence caveat or reason it might not be a perfect fit ("Why not?").
           - A verdict: "Must Watch", "Worth Watching", "Depends on Taste", or "Skip".
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                rank: { type: Type.INTEGER },
                badge: { type: Type.STRING, enum: ["Top Pick", "Trending", "Must Watch", "Hidden Gem", "Highly Rated"] },
                explanation: { type: Type.STRING },
                whyNot: { type: Type.STRING },
                verdict: { type: Type.STRING, enum: ['Must Watch', 'Worth Watching', 'Depends on Taste', 'Skip'] }
              },
              required: ["id", "rank", "badge", "explanation", "whyNot", "verdict"]
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
  },
  getStoryDNA: async (item: TMDBItem): Promise<string[]> => {
    try {
      const prompt = `Extract 3-5 core story themes (DNA) for "${item.title || item.name}". 
      Examples: "Revenge", "Survival", "Betrayal", "Redemption", "Underdog", "Forbidden Love".
      Return as a JSON array of strings.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "[]");
    } catch { return []; }
  },
  getWatchOrder: async (title: string): Promise<{ step: string; type: string }[]> => {
    try {
      const prompt = `Provide the recommended watch order for the "${title}" franchise. 
      Include movies, series, and OVAs. 
      Return as a JSON array of objects: { "step": "Title", "type": "Movie/Series/OVA" }.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "[]");
    } catch { return []; }
  },
  getContinueVsDrop: async (title: string, currentEp: number, totalEp: number): Promise<{ advice: string; reason: string }> => {
    try {
      const prompt = `The user is at episode ${currentEp} of ${totalEp} for "${title}". 
      Should they continue or drop? 
      Provide a JSON object: { "advice": "Continue" | "Drop" | "Depends", "reason": "Short explanation (e.g., 'Gets better after Ep 5')" }.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{ \"advice\": \"Depends\", \"reason\": \"Watch a few more episodes to decide.\" }");
    } catch { return { advice: "Depends", reason: "Watch a few more episodes to decide." }; }
  }
};
