const fs = require('fs');

const path = 'src/App.tsx';
const code = fs.readFileSync(path, 'utf-8');

const regex = /function MediaCard\(\{[^\}]+\}\s*:\s*\{[^\}]+\}\) \{[\s\S]*?(?=function SearchResults)/;

const newMediaCard = `function MediaCard({ item, type, onClick, onHover }: { key?: any; item: any; type: 'movie' | 'tv' | 'anime'; onClick: () => void; onHover?: (url: string | null) => void }) {
  const { activeId, setActiveId } = useActive();
  const [ready, setReady] = useState(false);
  const [nextEpisode, setNextEpisode] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuth();
  const { setHoveredBackdrop } = useBackdrop();
  const { watchlistItems, addToWatchlist, removeFromWatchlist } = useWatchlist();

  const isSaved = watchlistItems.some(i => i.externalId === item.id);
  const isActive = activeId === (item.id || item.mal_id);

  function getShift() {
    if (!cardRef.current) return 0;
    const rect = cardRef.current.getBoundingClientRect();
    const center = window.innerWidth / 2;
    const cardCenter = rect.left + rect.width / 2;
    return center - cardCenter;
  }

  const fetchNextEpisode = async () => {
     if (type === 'tv' && !nextEpisode) {
        tmdbService.getDetails(item.id, type).then(details => {
           if (details?.next_episode_to_air) {
              setNextEpisode(details.next_episode_to_air);
           }
        });
     }
  };

  const onEnter = () => {
    const backdrop = item.backdrop_path 
      ? \`https://image.tmdb.org/t/p/original\${item.backdrop_path}\`
      : item.poster_path?.startsWith('http') ? item.poster_path : \`https://image.tmdb.org/t/p/original\${item.poster_path}\`;
    
    if (onHover) onHover(backdrop);
    setHoveredBackdrop(backdrop);

    if (window.innerWidth < 768) return;

    timeoutRef.current = setTimeout(() => {
      setActiveId(item.id || item.mal_id);
      fetchNextEpisode();
      if (cardRef.current) {
        const shift = getShift();
        cardRef.current.style.setProperty("--shift", \`\${shift}px\`);
      }

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.load();
        videoRef.current.play().then(() => setReady(true)).catch(() => {});
      }
    }, 250);
  };

  const onLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveId(null);
    setReady(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const posterUrl = item.poster_path?.startsWith('http') 
    ? item.poster_path 
    : item.poster_path 
      ? \`https://image.tmdb.org/t/p/w500\${item.poster_path}\`
      : 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop';

  const progress = item.totalEpisodes && item.currentEpisode 
    ? (item.currentEpisode / item.totalEpisodes) * 100 
    : (item.watchedEpisodes?.length && item.totalEpisodes) 
      ? (item.watchedEpisodes.length / item.totalEpisodes) * 100
      : item.status === 'watching' ? 35 : 0;

  return (
    <div 
      ref={cardRef}
      className={\`media-card bg-surface-card border border-border group \${isActive ? 'active z-[30]' : 'z-10'}\`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={() => {
        if (window.innerWidth < 768 && !isActive) {
          setActiveId(item.id || item.mal_id);
        } else {
          profileService.updateInteraction(item, 'click');
          onClick();
        }
      }}
    >
      <img 
        className="w-full h-full object-cover transition-opacity duration-300 pointer-events-none" 
        src={posterUrl}
        alt={item.title || item.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000';
        }}
      />

      {item.preview && (
        <video
          ref={videoRef}
          className={\`preview-video \${ready ? "opacity-100" : "opacity-0"}\`}
          src={item.preview}
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
         <Button
             size="icon"
             variant="ghost"
             className={\`w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-border shadow-xl transition-all \${isSaved ? 'text-primary' : 'text-white'}\`}
             onClick={(e) => {
               e.stopPropagation();
               if (isSaved) {
                 removeFromWatchlist(item.id);
               } else {
                 addToWatchlist(item, type);
               }
             }}
         >
            {isSaved ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
         </Button>
      </div>

      {(item.status === 'watching' || (progress > 0 && progress < 100)) && (
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 backdrop-blur-sm z-20">
          <div 
            className="h-full bg-primary shadow-[0_0_15px_rgba(255,191,0,0.6)]" 
            style={{ width: \`\${progress}%\` }} 
          />
        </div>
      )}

      {isActive && (
        <div className="media-card-overlay flex flex-col justify-end z-20">
          {nextEpisode && (() => {
             const date = new Date(nextEpisode.air_date);
             const diff = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
             return (
                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-black/80 px-2 py-1 rounded inline-block self-start">
                   {diff <= 0 ? "🔥 New Episode Available" : \`⏳ Next Ep: \${diff} days\`}
                </div>
             );
          })()}
          <h4 className="text-[12px] font-black text-white leading-tight truncate uppercase">
              {item.title || item.name}
          </h4>
          <div className="flex items-center gap-1.5 mt-1">
              <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-400">{item.vote_average?.toFixed(1) || '0.0'}</span>
              <span className="text-[9px] text-muted-foreground font-bold ml-1">{(item.release_date || item.first_air_date)?.split('-')[0]}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
             <Button 
                size="sm"
                className="flex-1 bg-white hover:bg-zinc-200 text-black font-black rounded h-7 transition-all flex items-center justify-center gap-1 text-[10px]"
                onClick={(e) => {
                   e.stopPropagation();
                   profileService.updateInteraction(item, 'click');
                   onClick();
                }}
             >
                <Play className="w-3 h-3 fill-black" /> Play
             </Button>
          </div>
        </div>
      )}
    </div>
  );
}

`;

if (!code.match(regex)) {
  console.log("Could not find MediaCard regex match!");
} else {
  const newCode = code.replace(regex, newMediaCard);
  fs.writeFileSync(path, newCode, 'utf-8');
  console.log("MediaCard upgraded successfully!");
}
