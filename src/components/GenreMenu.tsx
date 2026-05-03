import React, { useState, useEffect } from 'react';

const movieGenres = [
  ["Match Your Mood", "Astrology", "Hindi", "Tamil", "Telugu", "Malayalam", "English", "International", "Independent"],
  ["Comedies", "Action", "Romance", "Dramas", "Thriller", "Horror", "Sci-Fi", "Crime", "Fantasy"],
  ["Bollywood", "Hollywood", "Children & Family", "Sports", "Award-Winning", "Documentaries", "Shorts", "Stand-Up Comedy", "Anime"]
];

const seriesGenres = [
  ["It's a Strange World", "Adventure Awaits", "Match Your Mood", "Astrology"],
  ["Reality & Talk", "Action", "Dramas", "Comedies", "Sci-Fi & Fantasy", "Crime", "Sports", "Family", "Kids"],
  ["Documentary Series", "Romance", "Thriller", "Horror", "Teen", "Anime", "Science & Nature", "Food & Travel"]
];

export function GenreMenu({ type, onSelectGenre }: { type: 'movie' | 'tv' | 'anime', onSelectGenre: (g: string) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (type !== 'movie' && type !== 'tv') return null;
  const data = type === 'movie' ? movieGenres : seriesGenres;

  return (
    <div 
      className="relative inline-block ml-4 z-[9999]"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-bold text-sm tracking-wider uppercase">
        Genres <span className="text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-[#111] p-6 rounded-2xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] grid grid-cols-3 gap-8 min-w-[500px]">
          {data.map((column, i) => (
            <div key={i} className="flex flex-col gap-3">
              {column.map(g => (
                <div
                  key={g}
                  className="font-bold text-sm text-zinc-300 hover:text-white cursor-pointer hover:underline"
                  onClick={() => {
                    onSelectGenre(g);
                    setOpen(false);
                  }}
                >
                  {g}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
