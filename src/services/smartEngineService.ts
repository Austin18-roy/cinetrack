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
    const timestamp = item.lastWatchedAt?.toMillis ? item.lastWatchedAt.toMillis() 
                    : item.updatedAt?.toMillis ? item.updatedAt.toMillis() 
                    : item.createdAt?.toMillis ? item.createdAt.toMillis() 
                    : null;
    
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

export function getContextAwareRecommendations(allContent: any[], profile: any, historyIds: string[]) {
  const currentHour = new Date().getHours();
  const currentSlot = getTimeSlot(currentHour);

  return allContent
    .filter(item => !historyIds.includes(String(item.id)) && !historyIds.includes(String(item.externalId)))
    .map(item => {
      let score = 0;

      // Time match (If they watch a lot during this time slot globally, boost items that match those genres/types)
      if (profile.timePreference[currentSlot]) score += (profile.timePreference[currentSlot] * 0.5);

      // Genre match
      if (item.genre_ids && Array.isArray(item.genre_ids)) {
        item.genre_ids.forEach((g: number) => {
          if (profile.genrePreference[g]) score += profile.genrePreference[g];
        });
      }

      // Type match 
      const itemType = item.media_type || (item.name ? 'tv' : 'movie');
      if (profile.typePreference[itemType]) score += (profile.typePreference[itemType] * 0.8);

      // Rating boost
      if (item.vote_average) score += item.vote_average;

      return { ...item, score, matchSlot: currentSlot };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

export function surpriseMeSmart(allContent: any[], profile: any, historyIds: string[]) {
  return allContent
    .filter(item => item.vote_average >= 7 && !historyIds.includes(String(item.id)) && !historyIds.includes(String(item.externalId)))
    .map(item => {
      let diversityScore = 0;

      // Penalize heavily watched genres, reward completely new ones
      if (item.genre_ids && Array.isArray(item.genre_ids)) {
        item.genre_ids.forEach((g: number) => {
          if (!profile.genrePreference[g]) {
            diversityScore += 5; // Strong boost for discovering new genres
          } else {
            diversityScore -= (profile.genrePreference[g] * 0.5); // Slight penalization
          }
        });
      }

      // Base quality
      if (item.vote_average) diversityScore += (item.vote_average * 0.5);

      return { ...item, diversityScore };
    })
    .sort((a, b) => b.diversityScore - a.diversityScore)
    .slice(0, 10);
}

export function generateReason(item: any, profile: any, currentSlot: string) {
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

  if (item.vote_average && item.vote_average >= 7.5) {
    reasons.push("Highly rated");
  }

  // If user actually has a strong habit in this slot
  if (profile.timePreference[currentSlot] && profile.timePreference[currentSlot] > 2) {
    reasons.push(`Perfect for ${currentSlot.replace('-', ' ')}`);
  }

  // Provide defaults if nothing hits
  if (reasons.length === 0) {
    reasons.push("Trending right now");
  }

  return reasons;
}
