import { profileService } from "./profileService";

export const GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics"
};

export function getTimeSlot(hour: number) {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 24) return "night";
  return "late-night";
}

export function getSlotLabel(slot: string) {
  switch (slot) {
    case 'morning': return "🌅 Morning Picks for You";
    case 'afternoon': return "☀️ Afternoon Picks for You";
    case 'night': return "🌙 Night Picks for You";
    case 'late-night': return "🦉 Late Night Picks for You";
    default: return "Picks for You";
  }
}

export function buildHabitProfile(history: any[]) {
  const profile = {
    timePreference: {} as Record<string, number>,
    genrePreference: {} as Record<number, number>,
    typePreference: {} as Record<string, number>
  };

  history.forEach(item => {
    // Determine the time it was interacted with
    const timestamp = (item.lastWatchedAt?.toMillis?.()) || 
                    (item.updatedAt?.toMillis?.()) || 
                    (item.createdAt?.toMillis?.()) || 
                    null;
    
    if (timestamp) {
      const hour = new Date(timestamp).getHours();
      const slot = getTimeSlot(hour);
      profile.timePreference[slot] = (profile.timePreference[slot] || 0) + 1;
    }

    if (item.genreIds && Array.isArray(item.genreIds)) {
      item.genreIds.forEach((g: number) => {
        profile.genrePreference[g] = (profile.genrePreference[g] || 0) + 1;
      });
    }

    if (item.type) {
      profile.typePreference[item.type] = (profile.typePreference[item.type] || 0) + 1;
    }
  });

  return profile;
}

export function getContextAwareRecommendations(allContent: any[], habitProfile: any, historyIds: string[]) {
  const currentHour = new Date().getHours();
  const currentSlot = getTimeSlot(currentHour);
  const explicitProfile = profileService.getProfile();

  return allContent
    .filter(item => !historyIds.includes(String(item.id)) && !historyIds.includes(String(item.externalId)))
    .map(item => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Time match (Habitual matching)
      if (habitProfile.timePreference[currentSlot]) {
        const timeWeight = (habitProfile.timePreference[currentSlot] * 1.5);
        score += timeWeight;
        if (timeWeight > 5) reasons.push(`Fits your ${currentSlot} watching habit`);
      }

      // 2. Genre match (Combined Habit + Explicit Likes/Dislikes)
      if (item.genre_ids && Array.isArray(item.genre_ids)) {
        let genreScore = 0;
        const topMatchedGenres: string[] = [];

        item.genre_ids.forEach((g: number) => {
          const habitWeight = habitProfile.genrePreference[g] || 0;
          const explicitWeight = explicitProfile.genres[g] || 0;
          
          const totalGenreWeight = habitWeight + explicitWeight;
          genreScore += totalGenreWeight;
          
          if (totalGenreWeight > 10) topMatchedGenres.push(GENRE_MAP[g]);
        });
        
        score += genreScore;
        if (topMatchedGenres.length > 0) {
          reasons.push(`Matches your love for ${topMatchedGenres.slice(0, 2).join(' & ')}`);
        }
        
        // Dynamic Penalty for Dislikes
        if (genreScore < -10) {
          score -= 40; // Strong burial for content in disliked domains
        }
      }

      // 3. Type match (Movie vs TV preference)
      const itemType = item.media_type || (item.name ? 'tv' : 'movie');
      const habitTypeWeight = habitProfile.typePreference[itemType] || 0;
      score += (habitTypeWeight * 1.2);

      // 4. Quality & Popularity
      if (item.vote_average) score += (item.vote_average * 2);
      if (item.popularity) score += Math.log10(item.popularity + 1) * 2;

      // 5. Language Match
      const explicitLangWeight = explicitProfile.languages[item.original_language] || 0;
      score += (explicitLangWeight * 3);

      return { ...item, score, matchSlot: currentSlot, dynamicReasons: reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

export function surpriseMeSmart(allContent: any[], profile: any, historyIds: string[]) {
  return allContent
    .filter(item => item.vote_average >= 6.5 && !historyIds.includes(String(item.id)) && !historyIds.includes(String(item.externalId)))
    .map(item => {
      let diversityScore = 0;

      // Reward diversity: genres user HASN'T explored much
      if (item.genre_ids && Array.isArray(item.genre_ids)) {
        item.genre_ids.forEach((g: number) => {
          const pref = profile.genrePreference[g] || 0;
          if (pref < 5) {
             diversityScore += 10; // New frontiers
          } else if (pref > 30) {
             diversityScore -= 10; // Too familiar
          }
        });
      }

      // Base quality still matters for a good surprise
      if (item.vote_average) diversityScore += item.vote_average;

      return { ...item, diversityScore };
    })
    .sort((a, b) => b.diversityScore - a.diversityScore)
    .slice(0, 10);
}

export function generateReason(item: any, profile: any, currentSlot: string) {
  // Use pre-calculated dynamic reasons if available, otherwise fallback to heuristics
  if (item.dynamicReasons && item.dynamicReasons.length > 0) {
    return item.dynamicReasons;
  }

  const reasons: string[] = [];
  const userTopGenres = Object.entries(profile.genrePreference)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)
    .map(e => parseInt(e[0]));

  if (item.genre_ids && Array.isArray(item.genre_ids)) {
    const matchingGenres = item.genre_ids.filter((g: number) => userTopGenres.includes(g));
    if (matchingGenres.length > 0) {
      reasons.push(`You like ${GENRE_MAP[matchingGenres[0]] || 'this genre'}`);
    }
  }

  if (item.vote_average && item.vote_average >= 8) {
    reasons.push("Critically acclaimed");
  } else if (item.vote_average && item.vote_average >= 7) {
    reasons.push("Highly rated by others");
  }

  if (item.popularity > 500) {
    reasons.push("Trending globally");
  }

  if (reasons.length === 0) {
    reasons.push("Based on your viewing history");
  }

  return reasons;
}
