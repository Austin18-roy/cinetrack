import React, { useState, useEffect } from 'react';
import { tmdbService } from '../services/tmdbService';
import { aiService } from '../services/aiService';
import { omdbService } from '../services/omdbService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { X, Play } from 'lucide-react';

function getColor(score: number) {
  if (score >= 9) return "#00ff88"; // bright green
  if (score >= 8) return "#66ff99";
  if (score >= 7) return "#ffcc00"; // yellow
  if (score >= 6) return "#ff8800";
  return "#ff4444"; // red
}

export function EpisodeHeatmap({ itemId, seasons, title }: { itemId: number | string, seasons: any[], title?: string }) {
  const [data, setData] = useState<Record<string, { ratings: number[], episodes: any[] }>>({});
  const [allSeasons, setAllSeasons] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<string>('');
  const [activeEp, setActiveEp] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [bestEpisodes, setBestEpisodes] = useState<{ episode: number, reason: string }[]>([]);
  const [hovered, setHovered] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const fetchHeatmapData = async () => {
      if (!seasons || seasons.length === 0) return;
      setLoading(true);
      
      const imdbId = await tmdbService.getExternalIds(itemId, 'tv');
      if (!active) return;
      
      try {
        const heatmapData: Record<string, { ratings: number[], episodes: any[] }> = {};
        const seasonCompareData: any[] = [];
        const seasonKeys: string[] = [];
        
        const fetchPromises = seasons.filter(s => s.season_number > 0).map(async (season) => {
          const tmdbSeason = await tmdbService.getSeasonDetails(Number(itemId), season.season_number);
          let omdbEpisodes: any[] = [];
          if (imdbId) {
            omdbEpisodes = await omdbService.getSeasonEpisodes(imdbId, season.season_number) || [];
          }
          
          const episodeRatings: number[] = [];
          
          (tmdbSeason.episodes || []).forEach((ep: any) => {
             const epNum = ep.episode_number;
             const omdbMatch = omdbEpisodes.find((o: any) => parseInt(o.Episode) === epNum);
             const imdbRating = omdbMatch && omdbMatch.imdbRating !== "N/A" ? parseFloat(omdbMatch.imdbRating) : null;
             const tmdbRating = ep.vote_average ? ep.vote_average : null;
             const finalScore = imdbRating ? imdbRating : tmdbRating;
             
             while (episodeRatings.length < epNum - 1) {
                episodeRatings.push(0);
             }
             episodeRatings[epNum - 1] = finalScore || 0;
          });
          
          const sKey = `S${season.season_number}`;
          heatmapData[sKey] = {
            ratings: episodeRatings,
            episodes: tmdbSeason.episodes || []
          };
          seasonKeys.push(sKey);
        });

        await Promise.all(fetchPromises);
        if (!active) return;
        
        seasonKeys.sort((a,b) => parseInt(a.replace('S', '')) - parseInt(b.replace('S', '')));
        const maxEps = Math.max(...seasonKeys.map(k => heatmapData[k].ratings.length));
        for(let i=0; i<maxEps; i++) {
           let row: any = { episode: i+1 };
           seasonKeys.forEach(k => {
              row[k] = heatmapData[k].ratings[i] || 0;
           });
           seasonCompareData.push(row);
        }

        setAllSeasons(seasonCompareData);
        setData(heatmapData);
        if (seasonKeys.length > 0) {
           setActiveSeason(seasonKeys[0]);
        }
      } catch (e) {
        console.error("Heatmap error:", e);
      }
      setLoading(false);
    };

    fetchHeatmapData();
    return () => { active = false; };
  }, [itemId, seasons]);

  useEffect(() => {
    let active = true;
    const fetchBest = async () => {
      if (!activeSeason || !data[activeSeason]) return;
      const sNum = parseInt(activeSeason.replace('S', ''));
      try {
        const best = await aiService.getBestEpisodes(title || '', sNum, data[activeSeason].episodes);
        if (active) setBestEpisodes(best);
      } catch (e) {
        console.error(e);
      }
    };
    fetchBest();
    return () => { active = false; };
  }, [activeSeason, data, title]);

  if (loading) {
    return <div className="h-64 w-full animate-pulse bg-white/5 rounded-2xl border border-white/10 my-8 flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest font-black">Loading Matrix...</div>;
  }

  const seasonKeys = Object.keys(data).sort((a,b) => parseInt(a.replace('S', '')) - parseInt(b.replace('S', '')));
  if (seasonKeys.length === 0) return null;

  const currentSeasonData = data[activeSeason];
  if (!currentSeasonData) return null;

  const heatmapArray = currentSeasonData.ratings.map((rating, i) => {
    const epDetails = currentSeasonData.episodes.find((e: any) => e.episode_number === i+1);
    return {
      episode: i+1,
      intensity: rating,
      title: epDetails?.name,
      overview: epDetails?.overview
    };
  });

  const bestSet = new Set(bestEpisodes.map(b => b.episode));

  return (
    <>
      <div className="bg-[#0a0a0a] p-4 md:p-6 rounded-3xl border border-white/10 mt-8 space-y-12">
        
        <div className="flex flex-col md:flex-row items-baseline justify-between gap-4">
           <div>
             <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
               📊 Season Intelligence
             </h2>
             <p className="text-muted-foreground text-sm mt-1 max-w-lg">Advanced metrics analyzing pacing, intensity, and episode impact using TMDB & AI scores.</p>
           </div>
           
           <div className="flex bg-white/5 p-1 rounded-xl overflow-x-auto max-w-full custom-scrollbar">
             {seasonKeys.map(s => (
               <button
                 key={s}
                 onClick={() => setActiveSeason(s)}
                 className={`px-4 py-1.5 min-w-fit text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                   activeSeason === s ? 'bg-primary text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                 }`}
               >
                 {s}
               </button>
             ))}
           </div>
        </div>

        <div>
           <div className="flex items-center justify-between mb-4">
             <h4 className="text-sm font-black uppercase tracking-widest text-[#aaa]">Episode Impact Matrix</h4>
             <div className="flex gap-2 text-[10px] uppercase font-black tracking-widest">
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{background:"#00ff88"}}></div> 9+</span>
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{background:"#66ff99"}}></div> 8+</span>
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{background:"#ffcc00"}}></div> 7+</span>
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-zinc-800"></div> Low/None</span>
             </div>
           </div>

           <div className="grid grid-cols-[repeat(auto-fill,minmax(50px,1fr))] gap-2 relative">
             {heatmapArray.map((e) => (
               <div
                 key={e.episode}
                 onMouseEnter={() => setHovered(e)}
                 onMouseLeave={() => setHovered(null)}
                 onClick={() => {
                   if (e.intensity) {
                     setActiveEp({ season: parseInt(activeSeason.replace('S', '')), episode: e.episode });
                   }
                 }}
                 className={`relative h-14 rounded-xl flex items-center justify-center text-xs font-black cursor-pointer transition-all duration-300
                   ${e.intensity ? 'text-black hover:scale-110 hover:z-20 shadow-md' : 'text-white/20 hover:bg-white/5'}
                 `}
                 style={{ 
                   background: e.intensity ? getColor(e.intensity) : "#1a1a1a",
                   boxShadow: bestSet.has(e.episode) ? "0 0 20px rgba(255, 204, 0, 0.4)" : undefined,
                   outline: bestSet.has(e.episode) ? "1.5px solid #ffcc00" : undefined,
                   outlineOffset: bestSet.has(e.episode) ? "1.5px" : undefined
                 }}
               >
                 {bestSet.has(e.episode) && (
                    <span className="absolute -top-2 -right-2 text-yellow-400 drop-shadow-[0_0_8px_rgba(255,204,0,0.8)] text-lg animate-pulse" title="AI Pick: Best Episode">★</span>
                 )}
                 {e.episode}

                 {hovered?.episode === e.episode && (
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-[#111] p-4 rounded-xl w-64 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 border border-white/10 pointer-events-none fade-in animate-in slide-in-from-bottom-2">
                     <h4 className="text-white font-bold text-sm mb-1 line-clamp-1">{e.title || `Episode ${e.episode}`}</h4>
                     <p className="text-zinc-400 font-normal text-xs line-clamp-3 mb-2">{e.overview || "No overview available."}</p>
                     <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
                        <span className="font-bold text-white tracking-widest uppercase">Ep {e.episode}</span>
                        {e.intensity ? (
                           <span className="font-black px-2 py-0.5 rounded bg-white/10" style={{color: getColor(e.intensity)}}>🔥 {e.intensity.toFixed(1)}/10</span>
                        ) : (
                           <span className="text-zinc-600">No score</span>
                        )}
                     </div>
                     {bestSet.has(e.episode) && (
                        <div className="mt-2 text-xs bg-yellow-400/10 text-yellow-500 p-2 rounded">
                           <span className="font-bold">★ AI Pick:</span> <span className="line-clamp-2">{bestEpisodes.find(b => b.episode === e.episode)?.reason}</span>
                        </div>
                     )}
                   </div>
                 )}
               </div>
             ))}
           </div>
        </div>

        {allSeasons.length > 0 && seasonKeys.length > 0 && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div>
               <h4 className="text-sm font-black uppercase tracking-widest text-[#aaa] mb-4">Pacing & Flow ({activeSeason})</h4>
               <div className="w-full h-64 bg-black/40 rounded-2xl p-4 border border-white/5">
                 <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                   <LineChart data={heatmapArray}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                     <XAxis dataKey="episode" tickFormatter={(v) => `E${v}`} stroke="#666" tick={{fill: '#888', fontSize: 11}} axisLine={false} tickLine={false} />
                     <YAxis domain={['dataMin - 0.5', 10]} stroke="#666" tick={{fill: '#888', fontSize: 11}} axisLine={false} tickLine={false} />
                     <Tooltip 
                       contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                       labelStyle={{ color: '#aaa', fontWeight: 'bold' }}
                       itemStyle={{ color: '#fff', fontWeight: 'black' }}
                       formatter={(val: number) => [val.toFixed(1), "Intensity"]}
                       labelFormatter={(val) => `Episode ${val}`}
                     />
                     <Line type="monotone" dataKey="intensity" stroke="#e50914" strokeWidth={3} dot={{r: 4, fill: "#e50914", strokeWidth: 0}} activeDot={{r: 6, fill: "#fff", stroke: "#e50914", strokeWidth: 2}} />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
             </div>

             {seasonKeys.length > 1 ? (
                 <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#aaa] mb-4">Season vs Season</h4>
                    <div className="w-full h-64 bg-black/40 rounded-2xl p-4 border border-white/5">
                       <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                         <LineChart data={allSeasons}>
                           <XAxis dataKey="episode" tickFormatter={(v) => `E${v}`} stroke="#666" tick={{fill: '#888', fontSize: 11}} axisLine={false} tickLine={false} />
                           <YAxis domain={['dataMin - 0.5', 10]} stroke="#666" tick={{fill: '#888', fontSize: 11}} axisLine={false} tickLine={false} />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px' }}
                             labelStyle={{ color: '#aaa' }}
                           />
                           <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
                           {seasonKeys.map((s, i) => {
                              const colors = ["#00ffcc", "#ffcc00", "#ff4444", "#a855f7", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];
                              return (
                                 <Line 
                                    key={s} 
                                    type="monotone" 
                                    dataKey={s} 
                                    stroke={colors[i % colors.length]} 
                                    strokeWidth={activeSeason === s ? 3 : 1.5}
                                    strokeOpacity={activeSeason === s ? 1 : 0.4}
                                    dot={activeSeason === s ? {r: 2} : false} 
                                    activeDot={{r: 5}} 
                                    name={s}
                                 />
                              )
                           })}
                         </LineChart>
                       </ResponsiveContainer>
                    </div>
                 </div>
             ) : (
                 <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#aaa] mb-4">About the Rating</h4>
                    <div className="w-full h-64 bg-black/40 rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
                        <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                          This show currently has only <strong>one season</strong>, so cross-season comparisons are not available yet.
                        </p>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                          The pacing graph breaks down the structural flow of individual episodes, highlighting the slow-burns and major climaxes.
                        </p>
                    </div>
                 </div>
             )}
           </div>
        )}

      </div>
      
      {activeEp && (
         <EpisodeModal 
            tvId={itemId} 
            seasonNum={activeEp.season} 
            episodeNum={activeEp.episode} 
            onClose={() => setActiveEp(null)} 
         />
      )}
    </>
  );
}

function EpisodeModal({ tvId, seasonNum, episodeNum, onClose }: { tvId: any, seasonNum: number, episodeNum: number, onClose: () => void }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function fetchEpisode() {
      try {
        const ep = await tmdbService.getEpisodeDetails(tvId, seasonNum, episodeNum);
        setData(ep);
      } catch (err) {
         console.error(err);
      }
    }
    fetchEpisode();
  }, [tvId, seasonNum, episodeNum]);

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-white/20 backdrop-blur-md transition-colors">
          <X className="w-4 h-4" />
        </button>
        
        <div className="relative w-full aspect-video bg-black">
          {data.still_path ? (
             <img src={`https://image.tmdb.org/t/p/w780${data.still_path}`} className="w-full h-full object-cover" />
          ) : (
             <div className="w-full h-full flex items-center justify-center text-white/20">No Image</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
        </div>
        
        <div className="p-6 relative -mt-10">
          <h2 className="text-2xl font-black text-white mb-2">{data.name}</h2>
          <div className="flex gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
             <span>Season {seasonNum} • Ep {episodeNum}</span>
             {data.vote_average ? <span className="text-primary">★ {data.vote_average.toFixed(1)}</span> : null}
             {data.runtime ? <span>{data.runtime} min</span> : null}
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed mb-6">{data.overview || 'No overview available.'}</p>
        </div>
      </div>
    </div>
  );
}
