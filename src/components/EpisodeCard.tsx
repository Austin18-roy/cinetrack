import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Check, CheckCircle2, Play, VolumeX, Volume2, Youtube } from 'lucide-react';
import { omdbService } from '../services/omdbService';

export const EpisodeCard: React.FC<{
  ep: any;
  epNum: number;
  isWatched: boolean;
  isFavorite?: boolean;
  isNew: boolean;
  image: string;
  airDateLocal: string | null;
  onMarkWatched: (epNum: number) => void;
  onToggleFavorite?: (epNum: number) => void;
  tvId: number;
  seasonNum: number;
}> = ({ ep, epNum, isWatched, isFavorite, isNew, image, airDateLocal, onMarkWatched, onToggleFavorite, tvId, seasonNum }) => {
  const [hovered, setHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadTrailer() {
      try {
        const data = await fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNum}/episode/${epNum}/videos?api_key=42211ea89745daaf87d65f8fa266cdfd`).then(r => r.json());
        if (data.results && data.results.length > 0) {
          const trailer = data.results.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip'));
          if (trailer) setTrailerKey(trailer.key);
        }
      } catch (e) {}
    }
    loadTrailer();
  }, [tvId, seasonNum, epNum]);

  function onEnter() {
    setHovered(true);
    timer.current = setTimeout(() => setShowPreview(true), 400);
  }

  function onLeave() {
    setHovered(false);
    setShowPreview(false);
    if (timer.current) clearTimeout(timer.current);
    if (cardRef.current) {
        cardRef.current.style.transform = `scale(1) rotateX(0deg) rotateY(0deg)`;
    }
  }

  function onMove(e: React.MouseEvent) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    cardRef.current.style.setProperty("--light-x", `${(x / rect.width) * 100}%`);
    cardRef.current.style.setProperty("--light-y", `${(y / rect.height) * 100}%`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = Math.max(Math.min(-(y - centerY) / 25, 4), -4); 
    const rotateY = Math.max(Math.min((x - centerX) / 25, 4), -4); 

    cardRef.current.style.transform = `scale(1.02) translateY(-4px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }

  const shortOverview = (text: string) => {
    if (!text) return "No preview available";
    return text.length > 120 ? text.slice(0, 120) + "..." : text;
  };

  function getPacing(ep: any) {
    const r = ep.imdbRating || ep.vote_average || 0;
    let score = r * 0.6;
    if (ep.runtime) {
      score += ep.runtime < 45 ? 2 : 1;
    } else {
      score += 1.5; 
    }
    return score;
  }

  const pacing = getPacing(ep);
  const pacingColor = pacing >= 5.5 ? "#00ff88" : pacing >= 4.5 ? "#ffcc00" : "#ff4444";
  const pacingLabel = pacing >= 5.5 ? "INTENSE" : pacing >= 4.5 ? "STEADY" : "SLOW";

  const rScore = ep.imdbRating || ep.vote_average || 0;
  const isFiller = rScore > 0 && rScore < 6.5 && (!ep.overview || ep.overview.length < 100);
  const isPeak = rScore >= 8.5;

  return (
    <div 
      ref={cardRef}
      className={`relative rounded-2xl transition-all duration-300 episode-card ${
        hovered ? 'z-30 shadow-2xl shadow-black scale-[1.02]' : isWatched ? 'bg-primary/5 border-primary/20' : 'bg-transparent border-transparent'
      } ${isFiller && !hovered ? 'opacity-60 grayscale-[0.5]' : ''}`}
      style={{ 
        transformStyle: 'preserve-3d', 
        willChange: 'transform', 
        borderLeft: isPeak ? `6px solid #eab308` : `6px solid ${pacingColor}` 
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseMove={onMove}
    >
      {isPeak && !hovered && (
        <div className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-1.5 h-12 bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,1)] rounded-r-md pointer-events-none" />
      )}
      <div 
        className={`flex flex-col md:flex-row gap-4 p-3 rounded-2xl border transition-colors ${
          isWatched ? 'border-primary/20' : hovered ? 'border-border bg-[#1a1a1a]' : 'hover:border-border hover:bg-white/5 border-transparent'
        }`}
      >
        <div className={`relative shrink-0 rounded-xl overflow-hidden transition-all duration-500 bg-black ${
           hovered ? 'w-full md:w-64 h-56 md:h-36 shadow-xl' : 'w-full md:w-40 h-44 md:h-24 shadow-lg border border-border'
        }`}>
          {showPreview && trailerKey ? (
            <div className="absolute inset-0 z-10 bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${trailerKey}`}
                className="w-[150%] h-[150%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                allow="autoplay; encrypted-media"
                title="Trailer Preview"
              />
              <div className="absolute top-2 right-2 flex gap-2 z-20 pointer-events-auto">
                 <Button 
                   size="icon" 
                   variant="ghost" 
                   className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white"
                   onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                 >
                   {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                 </Button>
              </div>
            </div>
          ) : (
            <img 
               className={`w-full h-full object-cover transition-transform duration-700 ${hovered ? 'scale-110' : ''}`} 
               src={image} 
               referrerPolicy="no-referrer" 
               alt={ep.name || ep.title} 
            />
          )}

          {!showPreview && (
            <div className={`absolute inset-0 transition-colors pointer-events-none ${hovered ? 'bg-gradient-to-t from-black via-black/20 to-transparent' : 'bg-black/20'}`} />
          )}
          
          {isWatched && !hovered && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-primary z-10" />
          )}
          
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
            <span className="bg-black/80 backdrop-blur-md text-white font-black text-[10px] px-2 py-0.5 rounded-md shadow-lg border border-border">
              {epNum}
            </span>
          </div>
          
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
            {ep.runtime && (
              <Badge className="bg-black/60 shadow-lg backdrop-blur-md text-zinc-300 border-border text-[9px] font-black uppercase px-2 py-0 hover:bg-black/80">
                {ep.runtime} min
              </Badge>
            )}
          </div>
          
          {hovered && !showPreview && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity z-20 pointer-events-none">
                <Play className="w-10 h-10 text-white drop-shadow-xl" />
             </div>
          )}

          {!hovered && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-20">
               <Button
                size="icon"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); onMarkWatched(epNum); }}
                className={`w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white shadow-2xl transition-transform active:scale-90 ${isWatched ? 'text-primary' : ''}`}
               >
                 {isWatched ? <CheckCircle2 className="w-5 h-5" /> : <Check className="w-5 h-5" />}
               </Button>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 pr-2 flex flex-col justify-center">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={`text-sm md:text-base font-bold truncate transition-colors ${isWatched ? 'text-zinc-300' : 'text-foreground'}`}>
                {ep.name || ep.title || `Episode ${epNum}`}
              </h4>
              <div 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-widest border"
                style={{ color: pacingColor, borderColor: pacingColor + '40', backgroundColor: pacingColor + '10' }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pacingColor }} />
                {pacingLabel}
              </div>
              {isFiller && (
                <Badge className="bg-zinc-800/80 text-zinc-400 border border-zinc-700 text-[8px] font-black uppercase px-1 py-0">Filler</Badge>
              )}
              {isNew && <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-black uppercase px-1 py-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]">New</Badge>}
            </div>
            
            <div className="flex items-center gap-2 z-20">
               {trailerKey && (
                 <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-transparent border-white/10 hover:bg-white/10 hidden sm:flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://www.youtube.com/watch?v=${trailerKey}`, '_blank');
                    }}
                 >
                    <Youtube className="w-3 h-3 mr-1 text-red-500" /> Trailer
                 </Button>
               )}
               {onToggleFavorite && (
                 <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(epNum); }}
                  className={`w-8 h-8 rounded-full transition-colors ${isFavorite ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'text-muted-foreground hover:text-yellow-500 hover:bg-white/5'}`}
                 >
                   <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                 </Button>
               )}
               <Button
                size="icon"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); onMarkWatched(epNum); }}
                className={`w-8 h-8 rounded-full border transition-colors sm:hidden ${isWatched ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-muted-foreground border-border hover:text-white hover:bg-white/10'}`}
               >
                 {isWatched ? <CheckCircle2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
               </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mb-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
            <span>{airDateLocal ? new Date(airDateLocal).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'TBA'}</span>
            {ep.imdbRating ? (
              <span className="flex items-center gap-1 text-[#00ffcc] drop-shadow-[0_0_8px_rgba(0,255,204,0.6)]">
                <Star className="w-2.5 h-2.5 fill-current" /> {ep.imdbRating.toFixed(1)}
              </span>
            ) : ep.vote_average ? (
                <span className="flex items-center gap-1 text-yellow-500"><Star className="w-2.5 h-2.5 fill-current" /> {ep.vote_average.toFixed(1)}</span>
            ) : null}
          </div>
          
          <p className={`text-xs leading-relaxed ${hovered ? 'line-clamp-4 text-zinc-300' : 'line-clamp-3 md:line-clamp-2 text-muted-foreground'}`}>
            {shortOverview(ep.overview)}
          </p>
        </div>
      </div>
    </div>
  );
}
