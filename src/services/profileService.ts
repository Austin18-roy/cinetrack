export interface UserProfile {
  genres: Record<number, number>;
  languages: Record<string, number>;
  recentGenres: number[];
  seenItems: number[];
}

export const profileService = {
  getProfile: (): UserProfile => {
    try {
      const data = localStorage.getItem('user_profile');
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Error reading profile", e);
    }
    return { genres: {}, languages: {}, recentGenres: [], seenItems: [] };
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
    const weight = action === 'like' ? 2 : action === 'click' ? 1 : -1;
    
    if (item.genre_ids) {
      item.genre_ids.forEach((g: number) => {
        profile.genres[g] = (profile.genres[g] || 0) + weight;
      });
    }
    if (item.original_language) {
      profile.languages[item.original_language] = (profile.languages[item.original_language] || 0) + weight;
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
