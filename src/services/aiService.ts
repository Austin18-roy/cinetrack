import { GoogleGenAI, Type } from "@google/genai";
import { TMDBItem } from "./tmdbService";
import { UserProfile } from "./profileService";
import { toast } from "sonner";

let _ai: any = null;
function getAIClient() {
  if (!_ai) {
    const apiKey = typeof process.env.GEMINI_API_KEY === 'string' ? process.env.GEMINI_API_KEY : (import.meta as any).env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("An API Key must be set for full AI features. Falling back.");
      _ai = {
        models: {
          generateContent: async () => {
            throw new Error("API Key missing");
          }
        }
      };
      return _ai;
    }
    
    try {
      _ai = new GoogleGenAI({ apiKey });
    } catch(e) {
      console.error("Failed to initialize GoogleGenAI:", e);
      _ai = {
        models: {
          generateContent: async () => {
             throw new Error("Failed to initialize AI");
          }
        }
      };
    }
  }
  return _ai;
}

export interface AIVerdict {
  verdict: 'Must Watch' | 'Worth Watching' | 'Depends on Taste' | 'Skip';
  reason: string;
  pros: string[];
  cons: string[];
  summary: string;
  targetAudience: string[];
  whyWatch: string;
  recommendationReason?: string;
  moodKeywords?: string[];
  moodTags?: {
    intensity: 'Low' | 'Medium' | 'High' | string;
    complexity: 'Low' | 'Medium' | 'High' | string;
    pace: 'Slow' | 'Balanced' | 'Fast' | string;
    emotion: string;
  };
  moodScores?: {
    thrill: number;
    story: number;
    emotion: number;
    pacing: number;
    intensity: number;
  };
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

// Rate Limiting Config

async function safeGeminiApiCall<T>(
  cacheKey: string, 
  apiCall: () => Promise<T>, 
  fallback: () => T
): Promise<T> {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // ignore parsing errors
  }

  
  try {
    const result = await apiCall();
    try {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.message?.includes('quota') || e.message?.includes('Quota')) {
         const keysToRemove = [];
         for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith('ai-c-') || k?.startsWith('ai-verdict-')) keysToRemove.push(k);
         }
         keysToRemove.slice(0, Math.floor(keysToRemove.length / 2)).forEach(k => localStorage.removeItem(k));
         try {
           localStorage.setItem(cacheKey, JSON.stringify(result));
         } catch(e2) {}
      }
    }
    return result;
  } catch (error: any) {
    console.error("Gemini API Error (Quota/Network), using fallback:", error);
return fallback();
  }
}

export const aiService = {
  // ... (getVerdictAndSummary remains similar but can be updated if needed)
  getVerdictAndSummary: async (
    item: TMDBItem, 
    details: any, 
    watchScore: number | null, 
    profile: UserProfile,
    viewingHistoryTitles: string[] = []
  ): Promise<AIVerdict | null> => {
    return safeGeminiApiCall<AIVerdict | null>(
      `ai-verdict-v7-${item.id}-${profile.recentGenres.join(',')}`,
      async () => {
         const prompt = `
         You are a film and TV expert AI. Generate a personalized summary and verdict for the following title.
         
         Title: "${item.title || item.name}"
         Overview: "${item.overview}"
         Genres: ${details?.genres?.map((g: any) => g.name).join(', ') || item.genre_ids?.join(', ')}
         User's Recently Watched Titles (Viewing History): ${viewingHistoryTitles.slice(0, 10).join(', ') || 'None provided'}
         
         Structure your response as follows:
         - "verdict": "Must Watch", "Worth Watching", "Depends on Taste", or "Skip"
         - "reason": 1 short sentence reason for the verdict
         - "summary": A neutral but insightful overview (2-3 sentences), no spoilers, focusing on pacing and style
         - "pros": EXACTLY what this specific title does well (max 5 bullet points) (e.g. NOT "matches your preference", but "Stunning cinematography", "Great performance by [Actor]", "Unique take on [Theme]"). Must be specific to the content itself.
         - "cons": EXACTLY where this specific title may fall short (max 3 bullet points) (e.g. NOT "pacing issues", but "The middle act drags", "CGI in climax is weak"). Must be specific to the content.
         - "targetAudience": Who should watch this (2-3 short descriptive phrases like "Fans of crime thrillers")
         - "whyWatch": 1 sentence summarizing the core appeal
         - "recommendationReason": "Why Watch": A personalized 2-3 sentence paragraph explaining exactly why the user should watch this based on their "User's Recently Watched Titles (Viewing History)", mentioning specific common themes. If no history is provided, base it on the genre.
         - "moodKeywords": an array of 3-5 specific mood-based tags (e.g., 'Intense', 'Calm', 'Nostalgic', 'Thought-Provoking', 'Gritty')
         - "moodTags": object with intensity, complexity, pace, emotion
         - "moodScores": object with thrill, story, emotion, pacing, intensity (scores from 1 to 10)
         `;

         const response = await getAIClient().models.generateContent({
           model: 'gemini-2.5-flash',
           contents: prompt,
           config: {
             responseMimeType: "application/json",
             responseSchema: {
               type: Type.OBJECT,
               properties: {
                 verdict: { type: Type.STRING },
                 reason: { type: Type.STRING },
                 summary: { type: Type.STRING },
                 pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                 cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                 targetAudience: { type: Type.ARRAY, items: { type: Type.STRING } },
                 whyWatch: { type: Type.STRING },
                 recommendationReason: { type: Type.STRING },
                 moodKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                 moodTags: {
                   type: Type.OBJECT,
                   properties: {
                     intensity: { type: Type.STRING },
                     complexity: { type: Type.STRING },
                     pace: { type: Type.STRING },
                     emotion: { type: Type.STRING }
                   }
                 },
                 moodScores: {
                   type: Type.OBJECT,
                   properties: {
                     thrill: { type: Type.INTEGER },
                     story: { type: Type.INTEGER },
                     emotion: { type: Type.INTEGER },
                     pacing: { type: Type.INTEGER },
                     intensity: { type: Type.INTEGER }
                   }
                 }
               }
             }
           }
         });
         
         if (response.text) {
           return JSON.parse(response.text) as AIVerdict;
         }
         return null;
      },
      () => {
        // Fallback logic
        const rating = item.vote_average || 0;
        const popularity = item.popularity || 0;
        const genres = Array.from(new Set([
          ...(item.genre_ids || []),
          ...(details?.genres?.map((g: any) => g.id) || [])
        ]));
  
        let userAffinity = 0;
        const matchedGenresTitle: string[] = [];
        
        genres.forEach(gid => {
          const weight = profile.genres[gid] || 0;
          userAffinity += weight;
          if (weight > 10) {
             const gName = (details?.genres?.find((g: any) => g.id === gid)?.name) || "this genre";
             matchedGenresTitle.push(gName);
          }
        });
  
        let pros: string[] = [];
        let cons: string[] = [];
        let verdict: 'Must Watch' | 'Worth Watching' | 'Depends on Taste' | 'Skip' = 'Depends on Taste';
  
        if (rating >= 8) {
           verdict = "Must Watch";
        } else if (rating >= 7) {
           verdict = "Worth Watching";
        } else if (rating > 0 && rating < 6) {
           verdict = "Skip";
        }
  
        if (userAffinity > 20 && verdict === 'Depends on Taste' && rating >= 6) {
          verdict = 'Worth Watching';
        }
        if (userAffinity < -20) {
          verdict = 'Skip';
        }
  
        let castNames: string[] = [];
        if (details?.credits?.cast && details.credits.cast.length > 0) {
          castNames = details.credits.cast.slice(0, 2).map((c: any) => c.name);
          pros.push(`The dynamic performances by ${castNames.join(' and ')} anchor the entire narrative beautifully`);
        }
         
        const runtime = details?.runtime || (details?.episode_run_time?.[0]);
        if (runtime && runtime > 140) cons.push(`With a runtime of over ${Math.floor(runtime/60)} hours, the middle act can feel noticeably bloated`);
        else if (runtime && runtime < 30) cons.push("The short runtime doesn't allow enough breathing room for character development");
         
        const networks = details?.networks?.map((n:any) => n.name) || [];
        if (networks.length > 0) pros.push(`Features the consistently high production value you'd expect from a ${networks[0]} release`);

        const director = details?.credits?.crew?.find((c: any) => c.job === 'Director');
        if (director) pros.push(`Strong, deliberate visual direction guided by ${director.name}`);

        const keywords = details?.keywords?.keywords || details?.keywords?.results || [];
        const topKeyword = keywords[0]?.name;
        if (topKeyword) pros.push(`Offers a really compelling and nuanced take on the underlying theme of ${topKeyword}`);

        if (rating >= 8) pros.push(`Masterfully executes its concept, earning universal praise and critical acclaim`);
        else if (rating >= 7) pros.push(`Effectively balances its dramatic tension to keep audiences hooked throughout`);

        if (popularity > 150) pros.push(`Its breathtaking visual scale and set pieces are genuinely impressive`);
        
        const isDrama = genres.includes(18) || genres.includes(8);
        const isAction = genres.includes(28) || genres.includes(1);
        const isComedy = genres.includes(35) || genres.includes(4);
        const isHorror = genres.includes(27) || genres.includes(14);
        
        if (isDrama) pros.push("Delivers emotionally resonant storytelling with deeply layered character arcs");
        if (isAction) pros.push("Features meticulously choreographed action sequences with palpably high stakes");
        if (isComedy) pros.push("Consistently lands its comedic timing while maintaining heart and charm");
        if (isHorror) pros.push("Builds genuine, unrelenting suspense rather than relying on cheap jump scares");
        
        if (rating > 0 && rating < 5.5) cons.push("Suffers from severe narrative cohesion issues and inconsistent tone");
        if (rating > 0 && rating < 6.5) cons.push("The script occasionally falls into familiar cliches and predictable tropes");

        if (userAffinity < -10) cons.push(`Divides its audience, possibly alienating viewers looking for traditional ${matchedGenresTitle[0] || 'genre'} fare`);
        
        if (cons.length < 2) {
           cons.push("Certain secondary subplots feel underdeveloped and lack satisfying resolution");
        }
  
        let recommendationReason = "";
        if (userAffinity > 30) {
          recommendationReason = `Because you have a strong history with ${matchedGenresTitle.slice(0, 2).join(' and ')} content, this fits your profile perfectly.`;
        } else if (userAffinity > 10) {
          recommendationReason = `Aligns with your recent interest in ${matchedGenresTitle[0] || 'similar stories'}.`;
        } else if (rating > 8.5) {
          recommendationReason = `Highly acclaimed regardless of genre; a potential new favorite.`;
        } else {
          recommendationReason = `Based on current global trends and your general browsing habits.`;
        }
  
        pros = Array.from(new Set(pros)).slice(0, 4);
        cons = Array.from(new Set(cons)).slice(0, 2);
  
        if (pros.length === 0) pros.push("An intriguing concept");
        if (cons.length === 0) cons.push("Pacing may not appeal to everyone");
  
        const title = item.title || item.name || "This title";
        const genreNames = matchedGenresTitle.length > 0 ? matchedGenresTitle : ["various genres"];
        const tone = rating >= 8 ? "critically acclaimed" : rating >= 7 ? "well-liked" : rating >= 6 ? "mixed reception" : "divisive";
        const castInfo = (details?.credits?.cast && details.credits.cast.length > 0) 
          ? ` starring ${details.credits.cast.slice(0, 2).map((c: any) => c.name).join(' and ')}` 
          : "";
        
        const shortOverview = item.overview ? item.overview.split('. ')[0] + '.' : '';
        
        const summary = `${title} is a ${tone} ${genreNames.slice(0,2).join("-").toLowerCase()} title${castInfo}. ${shortOverview} Why people like it: Strong performances, ${isDrama ? "emotional storytelling" : isAction ? "fast-paced action sequences" : "entertaining pacing"}, and memorable scenes that keep viewers hooked. Overall: A ${rating >= 7 ? "worth-watching" : "casual"} pick for ${genreNames[0]} fans.`;
  
        const result: AIVerdict = {
          verdict,
          reason: userAffinity > 15 ? `Strong match! Based on your love for ${matchedGenresTitle.slice(0, 2).join(' & ')}.` : "Analysis based on global metadata and your preferences.",
          pros,
          cons,
          summary,
          targetAudience: ["General audiences"],
          whyWatch: recommendationReason,
          recommendationReason,
          moodTags: {
            intensity: rating >= 8 ? 'High' : 'Medium',
            complexity: 'Medium',
            pace: isAction ? 'Fast' : 'Balanced',
            emotion: isDrama ? 'Emotional' : isAction ? 'Intense' : 'Light'
          },
          moodScores: {
            thrill: isAction ? 8 : 5,
            story: rating > 7 ? 8 : 6,
            emotion: isDrama ? 8 : 5,
            pacing: isAction ? 8 : 6,
            intensity: isAction ? 9 : 5
          }
        };
  
        try {
          localStorage.setItem(`ai-verdict-${item.id}-${profile.recentGenres.join(',')}`, JSON.stringify(result));
        } catch (e) {
        }
  
        return result;
      }
    );
  },

  parseVibeQuery: async (query: string, history?: string): Promise<VibeParams | null> => {
    return safeGeminiApiCall<VibeParams | null>(
      `vibe-${query}-${history || ''}`,
      async () => {
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

        const response = await getAIClient().models.generateContent({
          model: 'gemini-2.5-flash',
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

        if (response.text) return JSON.parse(response.text) as VibeParams;
        return null;
      },
      () => null
    );
  },

  explainRecommendations: async (query: string, items: TMDBItem[], parsedParams?: VibeParams | null): Promise<VibeExplanation[]> => {
    return safeGeminiApiCall<VibeExplanation[]>(
      `explain-${query}-${items.map(i => i.id).join('-')}`,
      async () => {
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

        const response = await getAIClient().models.generateContent({
          model: 'gemini-2.5-flash',
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

        if (response.text) return JSON.parse(response.text) as VibeExplanation[];
        return [];
      },
      () => [] // Fallback is empty array
    );
  },
  getStoryDNA: async (item: TMDBItem): Promise<string[]> => {
    return safeGeminiApiCall<string[]>(
      `dna-v2-${item.id}`,
      async () => {
        const prompt = `Extract 3-5 core story themes (DNA) for "${item.title || item.name}". 
        Examples: "Revenge", "Survival", "Betrayal", "Redemption", "Underdog", "Forbidden Love".
        Return as a JSON array of strings.`;
        const response = await getAIClient().models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "[]");
      },
      () => [] // Fallback to offline genre tags if needed, but empty array handles it gracefully
    );
  },
  getWatchOrder: async (title: string): Promise<{ step: string; type: string }[]> => {
    return safeGeminiApiCall<{ step: string; type: string }[]>(
      `order-${title}`,
      async () => {
        const prompt = `Provide the recommended watch order for the "${title}" franchise. 
        Include movies, series, and OVAs. 
        Return as a JSON array of objects: { "step": "Title", "type": "Movie/Series/OVA" }.`;
        const response = await getAIClient().models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "[]");
      },
      () => []
    );
  },
  getBestEpisodes: async (showTitle: string, seasonNum: number, episodes: any[]): Promise<{ episode: number, reason: string }[]> => {
    return safeGeminiApiCall<{ episode: number, reason: string }[]>(
      `best-episodes-${showTitle}-s${seasonNum}`,
      async () => {
         const prompt = `
         Rank the best episodes (top 3) based on intensity, payoff, and impact.
         
         Show: ${showTitle}
         Season: ${seasonNum}
         Episodes:
         ${episodes.map(e => `${e.episode_number}: ${e.name} - ${e.overview}`).join("\n")}
         `;

         const response = await getAIClient().models.generateContent({
           model: 'gemini-2.5-flash',
           contents: prompt,
           config: {
             responseMimeType: "application/json",
             responseSchema: {
               type: Type.ARRAY,
               items: {
                 type: Type.OBJECT,
                 properties: {
                   episode: { type: Type.INTEGER },
                   reason: { type: Type.STRING }
                 }
               }
             }
           }
         });
         
         if (response.text) {
           return JSON.parse(response.text);
         }
         return [];
      },
      () => {
        // Fallback: pick highest rated
        return episodes
           .sort((a,b) => (b.vote_average || 0) - (a.vote_average || 0))
           .slice(0, 3)
           .map(e => ({ episode: e.episode_number, reason: "Highly rated by audiences." }));
      }
    );
  },

  getContinueVsDrop: async (title: string, currentEp: number, totalEp: number): Promise<{ advice: string; reason: string }> => {
    return safeGeminiApiCall<{ advice: string; reason: string }>(
      `cvd-${title}-${currentEp}`,
      async () => {
        const prompt = `The user is at episode ${currentEp} of ${totalEp} for "${title}". 
        Should they continue or drop? 
        Provide a JSON object: { "advice": "Continue" | "Drop" | "Depends", "reason": "Short explanation (e.g., 'Gets better after Ep 5')" }.`;
        const response = await getAIClient().models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "{ \"advice\": \"Depends\", \"reason\": \"Watch a few more episodes to decide.\" }");
      },
      () => ({ advice: "Depends", reason: "Watch a few more episodes to decide." })
    );
  }
};
