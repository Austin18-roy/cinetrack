import React, { useRef, useState } from "react";
import { Star } from "lucide-react";

export const TiltCard: React.FC<{ item: any, onClick: () => void, isMobile: boolean }> = ({ item, onClick, isMobile }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isMobile) return;
    const card = ref.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const midX = rect.width / 2;
    const midY = rect.height / 2;

    const rotateX = ((y - midY) / midY) * -8; // vertical tilt
    const rotateY = ((x - midX) / midX) * 8;  // horizontal tilt

    card.style.transform = `
      perspective(800px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(1.05)
    `;

    card.style.background = `
      radial-gradient(
        circle at ${x}px ${y}px,
        rgba(255,255,255,0.15),
        transparent 60%
      )
    `;
  }

  function handleLeave() {
    if (isMobile) return;
    setIsActive(false);
    if (!ref.current) return;
    ref.current.style.transform = `
      perspective(800px)
      rotateX(0deg)
      rotateY(0deg)
      scale(1)
    `;
    ref.current.style.background = 'transparent';
  }

  function handleEnter() {
    if (!isMobile) setIsActive(true);
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`relative w-[140px] md:w-[180px] flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 transform-style-3d group`}
      style={{ willChange: 'transform' }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onMouseEnter={handleEnter}
    >
      <img
        src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=200&auto=format&fit=crop'}
        alt={item.title || item.name}
        className="w-full aspect-[2/3] object-cover rounded-xl transform translate-Z-[20px] transition-transform duration-300"
      />

      <div className={`absolute bottom-0 w-full p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent transform translate-Z-[40px] transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'} md:group-hover:opacity-100`}>
        <h4 className="font-bold text-white text-xs whitespace-normal line-clamp-2 mb-1">{item.title || item.name}</h4>
        {item.vote_average > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold">
            <Star className="w-3 h-3 fill-yellow-400" />
            {item.vote_average.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}
