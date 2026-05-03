import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Dice5 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tmdbService } from '../services/tmdbService';
import { jikanService } from '../services/jikanService';
import { RowConfig, scoreItem } from '../utils/rowEngine';

import { MediaCard } from '../App';

export function DynamicRow({ 
  config, 
  userBehavior 
}: { 
  config: RowConfig; 
  userBehavior: any;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRowData = async () => {
      setIsLoading(true);
      try {
        let results: any[] = [];
        
        if (config.mediaType === 'anime') {
          if (config.type === 'trending') {
            const data = await jikanService.getSeasonalAnime(page);
            results = data.results || [];
          } else if (config.type === 'curated') {
            const data = await jikanService.getTopAnime(page);
            results = data.results || [];
          } else if (config.filter?.genreIds && config.filter.genreIds.length > 0) {
            const data = await jikanService.getAnimeByGenre(config.filter.genreIds[0], page);
            results = data.results || [];
          }
        } else {
          // Movie / TV
          if (config.type === 'trending') {
            if (config.mediaType === 'movie') {
               const data = await tmdbService.getTrendingMovies(page);
               results = data.results || [];
            } else {
               const data = await tmdbService.getTrendingSeries(page);
               results = data.results || [];
            }
          } else {
            const params: any = { sort_by: 'popularity.desc' };
            if (config.filter?.region) {
              params.region = config.filter.region;
              params.watch_region = config.filter.region;
            }
            if (config.filter?.genreIds) {
              params.with_genres = config.filter.genreIds.join(',');
            }
            if (config.filter?.keywords) {
              params.with_keywords = config.filter.keywords.join(',');
            }
            if (config.filter?.language) {
              params.with_original_language = config.filter.language;
            }
            if (config.filter?.providerId) {
              params.with_watch_providers = config.filter.providerId.toString();
              params.watch_region = config.filter.region || 'US';
            }
            if (config.filter?.minRating) {
              params['vote_average.gte'] = config.filter.minRating.toString();
              params['vote_count.gte'] = '100';
            }

            const data = await tmdbService.getDiscover(config.mediaType as any, params, page, 1);
            results = data.results || [];
          }
        }

        // Apply Personalization Scoring
        const scoredItems = results
          .filter(item => item.poster_path)
          .map(item => ({ ...item, score: scoreItem(item, userBehavior) }))
          .sort((a, b) => b.score - a.score);

        if (page === 1) {
          setItems(scoredItems);
        } else {
          setItems(prev => {
            const newArray = [...prev, ...scoredItems];
            // keep unique
            return Array.from(new Map(newArray.map(item => [item.id || item.mal_id, item])).values());
          });
        }
      } catch (err) {
        // Silently handle errors to prevent console clutter
      } finally {
        setIsLoading(false);
      }
    };
    fetchRowData();
  }, [config, page]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - 100 && !isLoading) {
      setPage(p => p + 1);
    }
  };

  if (items.length === 0 && !isLoading) return null;

  return (
    <div className="row-container space-y-4 relative group/row">
      <div className="row-header flex items-center justify-between px-4">
        <h3 className="text-xl font-black tracking-tight text-foreground">{config.title}</h3>
        <div className="flex gap-2 relative z-[150] opacity-0 group-hover/row:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-border nav-button shadow-xl active:scale-90 transition-all"
            onClick={(e) => {
               e.stopPropagation();
               scrollRef.current?.scrollBy({ left: -(window.innerWidth * 0.8), behavior: 'smooth' });
            }}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-border nav-button shadow-xl active:scale-90 transition-all"
            onClick={(e) => {
               e.stopPropagation();
               scrollRef.current?.scrollBy({ left: (window.innerWidth * 0.8), behavior: 'smooth' });
            }}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="row-scroll px-4 media-row"
      >
        {items.length === 0 && isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="media-card-container bg-card animate-pulse border border-border" />
          ))
        ) : (
          items.map((item, index) => {
            const isTop10 = config.title.includes('Top 10');
            return (
              <div key={item.id || item.mal_id || index} className={`relative flex items-end flex-shrink-0 ${isTop10 ? 'mr-12' : 'mr-4'}`}>
                {isTop10 && (
                  <span className="text-[14rem] font-black leading-[0.7] tracking-tighter z-0" style={{ WebkitTextStroke: '4px #595959', color: 'black', marginRight: '-2rem', marginBottom: '-1rem' }}>
                    {index + 1}
                  </span>
                )}
                <div className="z-10 relative group/inner">
                  {isTop10 && index === 0 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                      Recently Added
                    </div>
                  )}
                  <MediaCard 
                    key={item.id || item.mal_id || index} 
                    item={item} 
                    type={item.media_type || (item.title ? 'movie' : 'tv')} 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('ITEM_CLICKED', { detail: item }));
                    }} 
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
