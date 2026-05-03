export type Mood = 'all' | 'hype' | 'chill' | 'sad' | 'dark';

export const moodThemes: Record<Mood, string> = {
  all: 'default',
  hype: 'neon',
  chill: 'default', // Or maybe 'minimal' but it's light mode. Let's stick to default
  sad: 'warm',
  dark: 'amoled'
};

export const moodMap = {
  hype: ["Action", "Adventure", "Superhero", "Sports"],
  chill: ["Comedy", "Family", "Feel-Good", "Slice of Life"],
  sad: ["Drama", "Romance", "Heartfelt", "Coming-of-Age"],
  dark: ["Thriller", "Crime", "Psychological", "Horror", "Mystery"]
};

export function getMoodScore(item: any, mood?: Mood) {
  if (!mood || mood === 'all') return 0;
  const moodGenres = moodMap[mood];
  if (!moodGenres) return 0;
  
  if (!item.genres && !item.genre_ids) return 0;
  
  // Generic check for now
  return 10; // Basic implementation
}
