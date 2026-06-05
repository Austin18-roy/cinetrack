import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { tmdbService } from '../services/tmdbService';

export function ActorTimeline({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const itemData = payload[0].payload;
    return (
      <div className="bg-black/90 text-white p-3 rounded-lg border border-white/10 shadow-xl z-50 pointer-events-none">
        <h4 className="font-bold text-sm mb-1">{itemData.year}</h4>
        <p className="text-xs text-muted-foreground mb-2">{itemData.count} titles</p>
        <div className="flex gap-1 overflow-hidden">
          {itemData.titles.slice(0, 4).map((m: any) => (
            m.poster_path && (
              <img
                key={m.id}
                src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                alt={m.title || m.name}
                className="w-10 h-14 object-cover rounded-sm"
              />
            )
          ))}
        </div>
      </div>
    );
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isPeak = payload.count >= 4;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isPeak ? 5 : 3}
        fill={isPeak ? "#e50914" : "#888"}
        className="transition-all duration-300 hover:r-[8px]"
      />
    );
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold text-white mb-4">Career Timeline</h3>
      <div className="w-full h-[250px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <XAxis dataKey="year" stroke="#666" tick={{fill: '#666', fontSize: 12}} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#e50914"
              strokeWidth={3}
              dot={<CustomDot />}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function buildTimeline(credits: any[]) {
  const map: Record<number, any> = {};

  credits.forEach(item => {
    const date = item.release_date || item.first_air_date;
    if (!date) return;

    const year = new Date(date).getFullYear();

    if (!map[year]) {
      map[year] = {
        year,
        count: 0,
        popularity: 0,
        titles: []
      };
    }

    map[year].count += 1;
    map[year].popularity += item.popularity || 0;
    map[year].titles.push(item);
  });

  return Object.values(map).sort((a: any, b: any) => a.year - b.year);
}

export function ActorModal({ actorId, onClose }: { actorId: number; onClose: () => void }) {
  const [actor, setActor] = useState<any>(null);
  const [credits, setCredits] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => {
    if (!actorId) return;

    const fetchActorInfo = async () => {
      try {
        const [actorData, creditsData] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/person/${actorId}?api_key=ca0afcfcb1de20b8e6ca6f9a0ddb9e84`).then(res => res.json()),
          fetch(`https://api.themoviedb.org/3/person/${actorId}/combined_credits?api_key=ca0afcfcb1de20b8e6ca6f9a0ddb9e84`).then(res => res.json())
        ]);

        setActor(actorData);
        setCredits(creditsData.cast || []);
        setTimeline(buildTimeline(creditsData.cast || []));
      } catch(e) {
        console.error("Failed to load actor", e);
      }
    };

    fetchActorInfo();
  }, [actorId]);

  if (!actor) return null;

  return (
    <div className="fixed inset-0 z-[6000] flex justify-center items-center p-4 sm:p-8 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="bg-[#141414] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
        <button 
          className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/50 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-colors" 
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3 flex-shrink-0">
              {actor.profile_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${actor.profile_path}`}
                  alt={actor.name}
                  className="w-full rounded-xl shadow-lg object-cover aspect-[2/3]"
                />
              ) : (
                <div className="w-full rounded-xl shadow-lg bg-zinc-800 aspect-[2/3] flex items-center justify-center text-zinc-500">
                  No Image
                </div>
              )}
            </div>

            <div className="w-full md:w-2/3">
              <h2 className="text-4xl font-black text-white mb-2 tracking-tight">{actor.name}</h2>
              <div className="flex flex-wrap gap-4 text-sm font-medium text-zinc-400 mb-6">
                {actor.birthday && <span>🎂 {actor.birthday}</span>}
                {actor.place_of_birth && <span>📍 {actor.place_of_birth}</span>}
                {actor.known_for_department && <span>🎭 {actor.known_for_department}</span>}
              </div>

              {actor.biography && (
                <div className="text-zinc-300 text-sm leading-relaxed mb-6 whitespace-pre-wrap line-clamp-6 hover:line-clamp-none transition-all">
                  {actor.biography}
                </div>
              )}
            </div>
          </div>

          <ActorTimeline data={timeline} />

          {credits.length > 0 && (
            <div className="mt-12">
              <h3 className="text-xl font-bold text-white mb-6">Known For</h3>
              <div className="flex gap-4 overflow-x-auto pb-6 -mx-8 px-8 no-scrollbar snap-x">
                {credits.sort((a, b) => b.popularity - a.popularity).slice(0, 20).map(c => (
                  <div key={c.id + c.media_type} className="w-[140px] flex-shrink-0 snap-start group cursor-pointer transition-transform duration-300 hover:scale-105">
                    {c.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w200${c.poster_path}`}
                        alt={c.title || c.name}
                        className="w-full rounded-lg shadow-md mb-2 object-cover aspect-[2/3]"
                      />
                    ) : (
                      <div className="w-full rounded-lg shadow-md mb-2 bg-zinc-800 aspect-[2/3] flex items-center justify-center text-zinc-500 text-xs text-center p-2">
                        {c.title || c.name}
                      </div>
                    )}
                    <h4 className="text-xs font-bold text-white line-clamp-1">{c.title || c.name}</h4>
                    <p className="text-[10px] text-zinc-400 line-clamp-1">{c.character}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
