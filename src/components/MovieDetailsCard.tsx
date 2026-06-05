import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Play, Plus, CheckCircle2, Star } from 'lucide-react';
import { useWatchlist, TMDB_GENRE_MAP } from '../App';

let activeVideo: HTMLVideoElement | null = null;
const previewCache: Record<string, number> = {};

function getBestStartTime(duration: number) {
  const min = duration * 0.25;
  const max = duration * 0.45;
  return Math.floor(Math.random() * (max - min) + min);
}

function fadeAudio(video: HTMLVideoElement) {
  video.muted = false;
  video.volume = 0;
  let vol = 0;
  const interval = setInterval(() => {
    vol += 0.05;
    video.volume = Math.min(vol, 0.5);
    if (vol >= 0.5) clearInterval(interval);
  }, 100);
}

export function MovieDetailsCard({ item, aiVerdict, trailerKey, onWatchTrailer }: { item: any; aiVerdict?: any; trailerKey?: string; onWatchTrailer?: (k: string) => void }) {
  const { watchlistItems, addToWatchlist, removeFromWatchlist, updateItemRating } = useWatchlist();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const watchlistItem = watchlistItems.find((i: any) => String(i.externalId) === String(item.id || item.mal_id));
  const isSaved = !!watchlistItem;

  function handleEnter() {
    timer.current = setTimeout(() => {
      setHovered(true);
      if (videoRef.current) {
        if (activeVideo && activeVideo !== videoRef.current) {
          activeVideo.pause();
        }
        activeVideo = videoRef.current;

        const setupVideo = () => {
          if (!videoRef.current) return;
          const duration = videoRef.current.duration;
          if (isNaN(duration)) return;

          const id = item.id?.toString() || item.mal_id?.toString() || 'unknown';
          if (!previewCache[id]) {
            previewCache[id] = getBestStartTime(duration);
          }
          videoRef.current.currentTime = previewCache[id];
          videoRef.current.muted = true;
          videoRef.current.play().then(() => {
            setTimeout(() => {
              if (videoRef.current === activeVideo) fadeAudio(videoRef.current!);
            }, 1200);
          }).catch(() => {});
        };

        if (videoRef.current.readyState >= 1) {
          setupVideo();
        } else {
          videoRef.current.onloadedmetadata = setupVideo;
          videoRef.current.load();
        }
      }
    }, 450); // Delay before expand
  }

  function handleLeave() {
    if (timer.current) clearTimeout(timer.current);
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.volume = 0;
    }
  }

  const poster = item.poster_path?.startsWith('http')
    ? item.poster_path
    : item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop';
  
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
  const genres = (item.genre_ids || item.genreIds || []).slice(0, 3).map((id: number) => TMDB_GENRE_MAP[id] || 'Other').join(' • ');

  return (
    <div 
      className={`relative rounded-xl transition-transform duration-[350ms] cubic-bezier(0.22,1,0.36,1) ${hovered ? 'scale-[1.15] -translate-y-5 z-50' : 'scale-100 z-10'}`}
      style={{ width: '220px', height: '330px', transformStyle: 'preserve-3d' }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Card className="w-full h-full overflow-hidden bg-card border-none shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <img src={poster} alt={item.title || item.name} className="w-full h-full object-cover transition-opacity duration-300" style={{ opacity: hovered ? 0 : 1 }} />
        
        <div className={`absolute inset-0 bg-[#0a0a0a] flex flex-col transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="relative w-full h-1/2">
            <video
              ref={videoRef}
              src={item.preview || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
          </div>
          
          <CardContent className="flex flex-col flex-1 p-4 pt-0 justify-between">
            <div>
              <h3 className="font-display font-black text-white leading-tight line-clamp-1 mb-1 shadow-sm">
                {item.title || item.name}
              </h3>
              
              <div className="flex items-center gap-2 text-xs font-bold mb-2">
                <span className="text-emerald-400 flex items-center gap-1"><Star className="w-3 h-3 fill-emerald-400" /> {rating}</span>
                <span className="text-zinc-500">{genres}</span>
              </div>
              
              {item.overview && (
                <p className="text-[10px] text-zinc-400 line-clamp-3 leading-snug">
                  {item.overview}
                </p>
              )}
            </div>
            
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" className="flex-1 bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-wider text-[10px] h-8">
                  <Play className="w-3 h-3 mr-1 fill-black" /> Play
                </Button>
                {trailerKey && onWatchTrailer && (
                  <Button 
                    size="sm" 
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold uppercase tracking-wider text-[10px] h-8"
                    onClick={(e) => {
                       e.stopPropagation();
                       onWatchTrailer(trailerKey);
                    }}
                  >
                    <Play className="w-3 h-3 mr-1 fill-white" /> Trailer
                  </Button>
                )}
              </div>
              
              <Button 
                size="sm" 
                variant="outline"
                className={`w-full rounded-lg border-zinc-600 bg-transparent hover:bg-zinc-800 transition-colors uppercase font-bold tracking-wider text-[10px] h-8 ${isSaved ? 'text-primary border-primary' : 'text-white'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSaved) {
                    removeFromWatchlist(item.id || item.mal_id);
                  } else {
                    addToWatchlist(item, item.media_type || 'movie');
                  }
                }}
              >
                {isSaved ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Update Watchlist</> : <><Plus className="w-3 h-3 mr-1" /> Add to Watchlist</>}
              </Button>
              
              {isSaved && watchlistItem && (
                 <div className="flex items-center justify-between bg-white/5 px-2 py-1.5 rounded-lg border border-white/10" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Rate</span>
                    <div className="flex items-center gap-0.5">
                       {[1, 2, 3, 4, 5].map((star) => {
                          const val = star * 2;
                          return (
                            <button
                               key={val}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 updateItemRating(watchlistItem.id, val);
                               }}
                               className={`p-0.5 transition-colors hover:scale-110 ${(watchlistItem.rating || watchlistItem.personalRating) >= val ? 'text-yellow-500' : 'text-zinc-600'}`}
                            >
                               <Star className="w-3 h-3 fill-current" />
                            </button>
                          );
                       })}
                    </div>
                 </div>
              )}

              {aiVerdict && (
                 <div className="mt-2 text-[9px] leading-tight flex flex-col gap-1.5 bg-white/5 border border-white/10 rounded-lg p-2">
                    <p className="text-zinc-300"><span className="text-primary font-bold">AI:</span> {aiVerdict.summary}</p>
                    <div className="flex flex-col gap-1">
                      {aiVerdict.pros && aiVerdict.pros.length > 0 && (
                         <div className="text-emerald-400 font-bold uppercase tracking-widest">Pros: <span className="font-normal normal-case text-zinc-400 ml-1">{aiVerdict.pros.join(', ')}</span></div>
                      )}
                      {aiVerdict.cons && aiVerdict.cons.length > 0 && (
                         <div className="text-red-400 font-bold uppercase tracking-widest">Cons: <span className="font-normal normal-case text-zinc-400 ml-1">{aiVerdict.cons.join(', ')}</span></div>
                      )}
                    </div>
                 </div>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
