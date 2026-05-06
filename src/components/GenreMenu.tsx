import React, { useState, useEffect } from 'react';

const movieGenres = [
  { name: "Action", id: 28 },
  { name: "Comedy", id: 35 },
  { name: "Romance", id: 10749 },
  { name: "Drama", id: 18 },
  { name: "Thriller", id: 53 },
  { name: "Horror", id: 27 },
  { name: "Science Fiction", id: 878 },
  { name: "Crime", id: 80 },
  { name: "Fantasy", id: 14 }
];

const seriesGenres = [
  { name: "Action & Adventure", id: 10759 },
  { name: "Comedy", id: 35 },
  { name: "Drama", id: 18 },
  { name: "Sci-Fi & Fantasy", id: 10765 },
  { name: "Crime", id: 80 },
  { name: "Kids", id: 10762 },
  { name: "Documentary", id: 99 },
  { name: "Mystery", id: 9648 },
  { name: "Reality", id: 10764 }
];

export function GenreMenu({ type, onSelectGenre }: { type: 'movie' | 'tv' | 'anime', onSelectGenre: (genre: any) => void }) {
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
        <div className="absolute top-full left-0 mt-2 bg-[#111] p-6 rounded-2xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] grid grid-cols-2 gap-8 min-w-[300px]">
          <div className="flex flex-col gap-3">
            {data.slice(0, 5).map(g => (
              <div
                key={g.id}
                className="font-bold text-sm text-zinc-300 hover:text-white cursor-pointer hover:underline"
                onClick={() => {
                  onSelectGenre(g);
                  setOpen(false);
                }}
              >
                {g.name}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {data.slice(5).map(g => (
              <div
                key={g.id}
                className="font-bold text-sm text-zinc-300 hover:text-white cursor-pointer hover:underline"
                onClick={() => {
                  onSelectGenre(g);
                  setOpen(false);
                }}
              >
                {g.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
