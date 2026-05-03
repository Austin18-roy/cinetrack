const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /  return \(\n    <AnimatePresence>([\s\S]*?)<\/AnimatePresence>\n  \);/;
const match = content.match(regex);
if (!match) {
  console.log("Could not find return statement in DetailModal");
  process.exit(1);
}

const replacement = `  const [activeTab, setActiveTab] = useState('overview');
  return (
    <AnimatePresence>
      {isOpen && item && (
        <div className="detail-page">
          <button className="detail-page-close" onClick={onClose}><X className="w-6 h-6" /></button>
          
          <div className="top-section">
            <Poster 
              poster={item.poster_path ? (item.poster_path.startsWith('http') ? item.poster_path : \`https://image.tmdb.org/t/p/w500\${item.poster_path}\`) : 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop'} 
              trailerKey={details?.videos?.results?.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip'))?.key}
            />

            <div className="main-info">
              <span className="type">{item.media_type || (item.title ? 'movie' : 'tv')}</span>
              <h1>{item.title || item.name}</h1>
              <div className="meta">
                <span>{(item.release_date || item.first_air_date)?.split('-')[0]}</span>
                <span>{item.vote_average?.toFixed(1)} ★</span>
                {details?.number_of_seasons && <span>{details.number_of_seasons} Seasons</span>}
                {ageRating && <span className="bg-white/10 px-2 py-0.5 rounded">{ageRating}</span>}
              </div>
              <p className="desc">{details?.overview || item.overview || 'No description available.'}</p>
              
              <div className="genres">
                {(details?.genres || []).map((g: any) => (
                  <span key={g.id}>{g.name || g}</span>
                ))}
              </div>

              <div className="actions">
                <button className="btn-play">
                  <Play className="w-5 h-5 fill-current" /> Play Trailer
                </button>
                <button 
                  className="btn-action"
                  onClick={() => onAdd(item)}
                >
                  {watchlistItem ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />} 
                  {watchlistItem ? 'Update Watchlist' : 'Add to Watchlist'}
                </button>
              </div>
            </div>

            <div className="side-info">
              {details?.created_by?.length > 0 && (
                <p><b>Creator:</b> {details.created_by.map((c: any) => c.name).join(', ')}</p>
              )}
              {details?.credits?.cast?.length > 0 && (
                <p><b>Cast:</b> {details.credits.cast.slice(0, 3).map((c: any) => c.name).join(', ')}</p>
              )}
              {details?.networks?.length > 0 && (
                <p><b>Network:</b> {details.networks.map((n: any) => n.name).join(', ')}</p>
              )}
              {details?.status && (
                <p><b>Status:</b> {details.status}</p>
              )}
              {details?.next_episode_to_air && (
                <p><b>Next Episode:</b> S{details.next_episode_to_air.season_number} E{details.next_episode_to_air.episode_number} ({details.next_episode_to_air.air_date})</p>
              )}
            </div>
          </div>

          <div className="detail-tabs">
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
            {(item.media_type === 'tv' || !item.title) && <button className={activeTab === 'episodes' ? 'active' : ''} onClick={() => setActiveTab('episodes')}>Episodes</button>}
          </div>

          <div className="detail-content">
            {activeTab === 'overview' && (
              <div className="space-y-12">
                 {/* Omdb info inside overview if we want */}
                 {omdbRatings && (
                    <div className="flex flex-wrap gap-4 mt-6">
                      {omdbRatings.imdb && <Badge className="bg-yellow-500 text-black">IMDb: {omdbRatings.imdb}</Badge>}
                      {omdbRatings.rotten && <Badge className="bg-red-500 text-white">Rotten Tomatoes: {omdbRatings.rotten}</Badge>}
                      {omdbRatings.tmdb && <Badge className="bg-blue-500 text-white">TMDb: {omdbRatings.tmdb}</Badge>}
                    </div>
                 )}
              </div>
            )}
            
            {activeTab === 'episodes' && details?.seasons && (
               <div className="space-y-6">
                 <NetflixHeatmap seasons={details.seasons} showId={item.id} />
               </div>
            )}
            
          </div>
        </div>
      )}
    </AnimatePresence>
  );`;

content = content.replace(regex, replacement);

const topComponents = `
function Poster({ poster, trailerKey }: { poster: string, trailerKey?: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className="detail-poster"
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => setPlaying(false)}
    >
      <img src={poster} alt="Poster" />
      {trailerKey && (
        <iframe
          className="poster-video"
          style={{ opacity: playing ? 1 : 0, pointerEvents: 'none' }}
          src={\`https://www.youtube.com/embed/\${trailerKey}?autoplay=\${playing ? 1 : 0}&mute=1&controls=0&modestbranding=1&loop=1&playlist=\${trailerKey}\`}
          allow="autoplay; encrypted-media"
        />
      )}
      <button className="play-btn-poster"><Play className="w-5 h-5 fill-current border-none" /></button>
    </div>
  );
}

function NetflixHeatmap({ seasons, showId }: { seasons: any[], showId: number }) {
  const [episodes, setEpisodes] = useState<any[]>([]);
  useEffect(() => {
    async function loadEpisodes() {
      // Load all episodes for the chart
      const all: any[] = [];
      const limited = seasons.filter((s:any) => s.season_number > 0).slice(0, 5);
      for(const s of limited) {
         try {
           const res = await fetch(\`https://api.themoviedb.org/3/tv/\${showId}/season/\${s.season_number}?api_key=42211ea89745daaf87d65f8fa266cdfd\`);
           const data = await res.json();
           if(data.episodes) all.push(...data.episodes);
         } catch(e) {}
      }
      setEpisodes(all);
    }
    loadEpisodes();
  }, [showId, seasons]);

  const data = episodes.filter(ep => ep.vote_average > 0).map(ep => ({
    ep: \`S\${ep.season_number}E\${ep.episode_number}\`,
    rating: ep.vote_average
  }));

  const bestEp = data.length > 0 ? data.reduce((a, b) => a.rating > b.rating ? a : b) : null;

  return (
    <div>
       {data.length > 0 && (
         <div className="graph">
           <ResponsiveContainer width="100%" height={200}>
             <LineChart data={data}>
               <XAxis dataKey="ep" stroke="#555" />
               <Tooltip contentStyle={{background:'#111', border:'none', borderRadius:'8px'}} />
               <Line type="monotone" dataKey="rating" stroke="#00ff88" strokeWidth={3} dot={false} activeDot={{r:6}} />
             </LineChart>
           </ResponsiveContainer>
         </div>
       )}

       <div className="rating-heatmap">
         {seasons.filter((s:any) => s.season_number > 0).map((season: any) => {
            const seasonEps = episodes.filter(e => e.season_number === season.season_number);
            if(seasonEps.length === 0) return null;
            return (
              <div key={season.id} className="season-row">
                 <span className="season-label">S{season.season_number}</span>
                 {seasonEps.map((ep:any) => {
                    const r = ep.vote_average;
                    const rClass = r >= 8 ? 'rating-high' : r >= 6 ? 'rating-mid' : r > 0 ? 'rating-low' : 'rating-none';
                    return (
                        <EpisodeHoverCard key={ep.id} ep={ep} rClass={rClass} isBest={bestEp?.ep === \`S\${ep.season_number}E\${ep.episode_number}\`} />
                    );
                 })}
              </div>
            );
         })}
       </div>
    </div>
  );
}

function EpisodeHoverCard({ ep, rClass, isBest }: { ep: any, rClass: string, isBest: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={\`cell \${rClass} \${isBest ? 'best-episode' : ''}\`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {ep.vote_average ? ep.vote_average.toFixed(1) : '-'}

      {hover && (
        <div className="ep-popup">
          <img src={ep.still_path ? \`https://image.tmdb.org/t/p/w500\${ep.still_path}\` : 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=500&auto=format&fit=crop'} alt={ep.name} />
          <div className="ep-info">
             <h4>E{ep.episode_number}. {ep.name}</h4>
             <p>{ep.overview || "No overview available."}</p>
             <span style={{background: 'rgba(255,255,255,0.1)', padding:'4px 8px', borderRadius:'4px', fontSize:'0.75rem', fontWeight:800, color:'#ffd54f'}}>⭐ {ep.vote_average ? ep.vote_average.toFixed(1) : 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
`;

content = content.replace(/function DetailModal\(\{/, topComponents + '\nfunction DetailModal({');

fs.writeFileSync('src/App.tsx', content);
console.log("Success");
