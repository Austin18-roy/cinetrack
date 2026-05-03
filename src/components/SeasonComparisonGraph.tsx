import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { tmdbService } from '../services/tmdbService';
import { omdbService } from '../services/omdbService';

export function SeasonComparisonGraph({ itemId, seasons }: { itemId: number | string, seasons: any[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [peakEpisode, setPeakEpisode] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const fetchAllSeasons = async () => {
      if (seasons.length === 0) return;
      setLoading(true);
      
      const imdbId = await tmdbService.getExternalIds(itemId, 'tv');
      if (!active) return;
      
      try {
        const fetchPromises = seasons.filter(s => s.season_number > 0).map(async (season) => { // ignore specials
          let omdbEpisodes: any[] = [];
          if (imdbId) {
            omdbEpisodes = await omdbService.getSeasonEpisodes(imdbId, season.season_number) || [];
          }
          return {
            season: `S${season.season_number}`,
            episodes: omdbEpisodes.map((ep: any) => ({
              episode: parseInt(ep.Episode),
              rating: ep.imdbRating && ep.imdbRating !== "N/A" ? parseFloat(ep.imdbRating) : null
            })).filter(ep => ep.rating !== null && !isNaN(ep.rating))
          };
        });

        const seasonData = await Promise.all(fetchPromises);
        if (!active) return;
        
        let peak = null;
        const map: any = {};
        
        seasonData.forEach((sd: any) => {
          sd.episodes.forEach((ep: any) => {
            if (!map[ep.episode]) {
               map[ep.episode] = { episode: ep.episode };
            }
            map[ep.episode][sd.season] = ep.rating;

            if (!peak || ep.rating > peak.rating) {
               peak = { ...ep, season: sd.season };
            }
          });
        });

        setData(Object.values(map));
        setPeakEpisode(peak);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    fetchAllSeasons();
    return () => { active = false; };
  }, [itemId, seasons]);

  if (loading) {
    return <div className="h-40 w-full animate-pulse bg-white/5 rounded-2xl"></div>;
  }

  if (data.length === 0) return null;

  const colors = ["#00ffcc", "#ffcc00", "#ff4444", "#a855f7", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];

  return (
    <div className="bg-[#111] p-4 lg:p-6 rounded-2xl border border-white/5 space-y-4">
       <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Series Trend</h4>
          {peakEpisode && (
             <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
               🔥 Peak: {peakEpisode.season} Ep {peakEpisode.episode} ({peakEpisode.rating})
             </span>
          )}
       </div>
       <div className="h-48 w-full">
         <ResponsiveContainer width="100%" height="100%" minWidth={1}>
           <LineChart data={data}>
             <XAxis dataKey="episode" stroke="#333" tick={{ fill: '#666', fontSize: 10 }} />
             <YAxis domain={['dataMin - 0.5', 10]} stroke="#333" tick={{ fill: '#666', fontSize: 10 }} />
             <Tooltip 
               contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
               itemStyle={{ fontWeight: 'bold' }}
             />
             {seasons.filter(s => s.season_number > 0).map((s, idx) => {
                const seasonKey = `S${s.season_number}`;
                const color = colors[idx % colors.length];
                return (
                  <Line 
                    key={seasonKey} 
                    type="monotone" 
                    dataKey={seasonKey} 
                    stroke={color} 
                    strokeWidth={2}
                    dot={(props: any) => {
                      if (!props.payload[seasonKey]) return null;
                      const isPeak = peakEpisode && props.payload.episode === peakEpisode.episode && props.payload[seasonKey] === peakEpisode.rating;
                      if (isPeak) {
                        return <circle key={`peak-${props.cx}`} cx={props.cx} cy={props.cy} r={6} fill={color} stroke="none" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />;
                      }
                      return <circle key={`dot-${props.cx}`} cx={props.cx} cy={props.cy} r={2} fill={color} stroke="none" />;
                    }}
                  />
                );
             })}
           </LineChart>
         </ResponsiveContainer>
       </div>
    </div>
  );
}
