export interface UserProfile {
  genres: Record<number, number>;
  languages: Record<string, number>;
  recentGenres: number[];
  seenItems: (number | string)[];
  // Anime specific tracking
  animeProfile: {
    genres: Record<number, number>;
    themes: Record<number, number>;
    demographics: Record<number, number>;
    studios: Record<number, number>;
    liked: (number | string)[];
  };
}

export const profileService = {
  getProfile: (): UserProfile => {
    try {
      const data = localStorage.getItem('user_profile');
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Error reading profile", e);
    }
    return { 
      genres: {}, 
      languages: {}, 
      recentGenres: [], 
      seenItems: [],
      animeProfile: {
        genres: {},
        themes: {},
        demographics: {},
        studios: {},
        liked: []
      }
    };
  },
  saveProfile: (profile: UserProfile) => {
    try {
      localStorage.setItem('user_profile', JSON.stringify(profile));
    } catch (e) {
      console.error("Error saving profile", e);
    }
  },
  updateInteraction: (item: any, action: 'like' | 'skip' | 'click') => {
    const profile = profileService.getProfile();
    const weight = action === 'like' ? 3 : action === 'click' ? 1 : -2;
    
    const isAnime = item.media_type === 'anime' || (typeof item.id === 'string' && item.id.startsWith('jikan_'));

    if (isAnime) {
      const ap = profile.animeProfile;
      if (item.genre_ids) {
        item.genre_ids.forEach((g: number) => {
          ap.genres[g] = (ap.genres[g] || 0) + weight;
        });
      }
      if (item.themes) {
        item.themes.forEach((t: any) => {
          const tid = typeof t === 'object' ? t.mal_id : t;
          ap.themes[tid] = (ap.themes[tid] || 0) + weight;
        });
      }
      if (item.demographics) {
        item.demographics.forEach((d: any) => {
          const did = typeof d === 'object' ? d.mal_id : d;
          ap.demographics[did] = (ap.demographics[did] || 0) + weight;
        });
      }
      if (item.studios) {
        item.studios.forEach((s: any) => {
          const sid = typeof s === 'object' ? s.mal_id : s;
          ap.studios[sid] = (ap.studios[sid] || 0) + weight;
        });
      }
      if (action === 'like') {
        ap.liked = [...new Set([...ap.liked, item.id])];
      }
    } else {
      if (item.genre_ids) {
        item.genre_ids.forEach((g: number) => {
          profile.genres[g] = (profile.genres[g] || 0) + weight;
        });
      }
      if (item.original_language) {
        profile.languages[item.original_language] = (profile.languages[item.original_language] || 0) + weight;
      }
    }
    
    profileService.saveProfile(profile);
  },
  markSeen: (items: any[]) => {
    const profile = profileService.getProfile();
    const newIds = items.map(i => i.id);
    profile.seenItems = [...new Set([...profile.seenItems, ...newIds])].slice(-2000); // keep last 2000
    
    // update recent genres
    const newGenres = items.flatMap(i => i.genre_ids || []);
    profile.recentGenres = [...newGenres, ...profile.recentGenres].slice(0, 50); // keep last 50
    
    profileService.saveProfile(profile);
  }
};
