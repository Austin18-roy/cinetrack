import { TMDBItem } from '../services/tmdbService';

// Custom curated dataset for Tamil web series
const rawTamilSeries = [
  {
    id: "suzhal",
    title: "Suzhal - The Vortex",
    type: "tv",
    language: "ta",
    genres: ["thriller", "crime"],
    platform: "Prime Video",
    rating: 8.4,
    year: 2022,
    poster: "https://m.media-amazon.com/images/M/MV5BMjY5ZGMyYTUtNjIwZS00NGE2LWIwODgtMTYzODE4NDllNTRmXkEyXkFqcGdeQXVyMTE0MzY0NjE1._V1_.jpg",
    backdrop: "https://m.media-amazon.com/images/M/MV5BZDhjMWJiNjctNDIzYi00OTY3LWFmNGMtMjI4OWU1OTg1YmYxXkEyXkFqcGdeQXVyMTE0MzY0NjE1._V1_FMjpg_UX1000_.jpg",
    description: "A small-town mystery unfolds during a festival, pulling a tight-knit community into a dark web of secrets.",
    tags: ["dark", "investigation", "twist"]
  },
  {
    id: "ayali",
    title: "Ayali",
    type: "tv",
    language: "ta",
    genres: ["drama"],
    platform: "ZEE5",
    rating: 8.2,
    year: 2023,
    poster: "https://m.media-amazon.com/images/M/MV5BYzA2ZWI2MTctOWVjNy00NzJiLWE3NTEtYTVhODE0NTEwNzhiXkEyXkFqcGdeQXVyMTEzNzA5NTAy._V1_.jpg",
    backdrop: "https://m.media-amazon.com/images/M/MV5BN2E1ZmM2ZTQtNGJkYy00ZjY2LWFmZTUtNWQwMWQwNjdjMTEwXkEyXkFqcGdeQXVyMTEzNzA5NTAy._V1_FMjpg_UX1000_.jpg",
    description: "A teenage girl battles orthodox village customs and attempts to become the first girl to finish high school.",
    tags: ["social", "inspiring"]
  },
  {
    id: "vadhandhi",
    title: "Vadhandhi: The Fable of Velonie",
    type: "tv",
    language: "ta",
    genres: ["thriller", "crime"],
    platform: "Prime Video",
    rating: 8.0,
    year: 2022,
    poster: "https://m.media-amazon.com/images/M/MV5BYTJlN2UxNDAtNTE4ZC00ZTMwLWEwNzQtNDE5MWIyOWJkNzk1XkEyXkFqcGdeQXVyMTA3MDk2NDg2._V1_FMjpg_UX1000_.jpg",
    backdrop: "https://m.media-amazon.com/images/M/MV5BMjA4ZTdlOTUtMmM0Zi00ZjNmLTg5ZmYtMjI1ZGU5MjEwZTBlXkEyXkFqcGdeQXVyMTE0MzY0NjE1._V1_FMjpg_UX1000_.jpg",
    description: "A troubled cop investigates the murder of a beautiful young girl in a small town.",
    tags: ["mystery", "police"]
  },
  {
    id: "vilangu",
    title: "Vilangu",
    type: "tv",
    language: "ta",
    genres: ["thriller", "crime"],
    platform: "ZEE5",
    rating: 8.1,
    year: 2022,
    poster: "https://m.media-amazon.com/images/M/MV5BZDY1NDllZWUtZmEyZS00OTg5LTg0MzctMTc1NGJlZGRkYTdiXkEyXkFqcGdeQXVyMTI1NDEyNTM5._V1_FMjpg_UX1000_.jpg",
    backdrop: "https://m.media-amazon.com/images/M/MV5BZWQyNWJiMmEtMGVlNi00ZjcxLWE4NzItMTc1NjZlOWMwMDU3XkEyXkFqcGdeQXVyMTI1NDEyNTM5._V1_FMjpg_UX1000_.jpg",
    description: "Paridhi, an honest cop, works in a police station with its own dark politics. Will he solve a series of mysterious murders?",
    tags: ["police", "rural"]
  },
  {
    id: "iru-dhuruvam",
    title: "Iru Dhuruvam",
    type: "tv",
    language: "ta",
    genres: ["crime", "action"],
    platform: "SonyLIV",
    rating: 7.6,
    year: 2019,
    poster: "https://m.media-amazon.com/images/M/MV5BMzIwNjY1NWQtM2RmNi00ODNlLTlmYmMtNzMwNDIzZjgwMjBlXkEyXkFqcGdeQXVyMTEzMTI1Mjk3._V1_.jpg",
    backdrop: "https://m.media-amazon.com/images/M/MV5BZjg3YzQ4OWEtYTlkZi00OTcwLWJhYWQtMjFiZjFkOTcyYWI2XkEyXkFqcGdeQXVyMzgyMTIyNw@@._V1_FMjpg_UX1000_.jpg",
    description: "A seasoned cop searches for a serial killer leaving quotes from Thirukkural at crime scenes.",
    tags: ["serial-killer", "investigation"]
  },
  {
    id: "mathagam",
    title: "Mathagam",
    type: "tv",
    language: "ta",
    genres: ["action", "thriller", "crime"],
    platform: "Disney+ Hotstar",
    rating: 7.2,
    year: 2023,
    poster: "https://m.media-amazon.com/images/M/MV5BM2EyOWExMTMtMGFhNi00NTdjLThkODItMjlkMTVkYzA3NDc5XkEyXkFqcGdeQXVyMTIzMzg0MTM2._V1_FMjpg_UX1000_.jpg",
    backdrop: "https://m.media-amazon.com/images/M/MV5BMTAxOTA4NWEtZGNmZi00OWJjLWJmM2YtNTkwZjE5NGExNmE5XkEyXkFqcGdeQXVyMTQ3Mzk2MDg4._V1_FMjpg_UX1000_.jpg",
    description: "A cat and mouse game between a sincere IAS officer and an underworld kingpin over a single weekend.",
    tags: ["underworld", "gangster"]
  }
];

// Helper to reliably map our JSON dataset strings to TMDB pseudo-genre-IDs so our app filters work
const mapGenresToIds = (genres: string[]) => {
  const mapping: Record<string, number> = {
    "action": 28,
    "adventure": 12,
    "animation": 16,
    "comedy": 35,
    "crime": 80,
    "documentary": 99,
    "drama": 18,
    "family": 10751,
    "fantasy": 14,
    "history": 36,
    "horror": 27,
    "music": 10402,
    "mystery": 9648,
    "romance": 10749,
    "science fiction": 878,
    "thriller": 53
  };
  return genres.map(g => mapping[g.toLowerCase()]).filter(Boolean);
};

export const curatedTamilSeries: TMDBItem[] = rawTamilSeries.map(s => ({
  id: `tamil_${s.id}`,
  title: s.title,
  name: s.title,
  poster_path: s.poster, // Use raw URL, app knows how to handle http
  backdrop_path: s.backdrop,
  vote_average: s.rating,
  vote_count: 500, // Safe default for curated
  media_type: 'tv',
  first_air_date: `${s.year}-01-01`,
  overview: s.description,
  genre_ids: mapGenresToIds(s.genres),
  original_language: s.language,
  platforms: [s.platform] // custom field we add
}));
