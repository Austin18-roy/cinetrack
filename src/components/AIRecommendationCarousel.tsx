import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TMDBItem } from '../services/tmdbService';
import { getContextAwareRecommendations, buildHabitProfile } from '../services/smartEngineService';
import { aiService } from '../services/aiService';
import { Sparkles, Loader2, PlayCircle, Star, Info, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MediaItem } from '../App';

interface AIRecommendationCarouselProps {
  items: MediaItem[];
  onItemClick: (item: any) => void;
}

import { tmdbService } from '../services/tmdbService';
import { jikanService } from '../services/jikanService';

export function AIRecommendationCarousel({ items, onItemClick }: AIRecommendationCarouselProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasFetched = useRef(false);

  useEffect(() => {
    async function fetchRecommendations() {
      if (items.length === 0 || hasFetched.current) return;
      hasFetched.current = true;
      
      setLoading(true);
      try {
        const habits = buildHabitProfile(items);
        
        // Fetch real candidates instead of using watchlist items
        const trendingMovies = await tmdbService.getTrendingMovies();
        const trendingTv = await tmdbService.getTrendingSeries();
        
        const candidates = [
            ...(trendingMovies?.results || []).map((m: any) => ({ ...m, media_type: 'movie' })),
            ...(trendingTv?.results || []).map((s: any) => ({ ...s, media_type: 'tv' }))
        ];

        const engineRecs = getContextAwareRecommendations(candidates, habits, items.map(i => String(i.externalId || i.id)));

        
        // Explain top 5
        const top5 = engineRecs.slice(0, 5);
        if (top5.length > 0) {
            const explanations = await aiService.explainRecommendations("Personalized top picks", top5);
            
            const enriched = top5.map(item => {
              const exp = explanations.find(e => String(e.id) === String(item.id));
              return {
                 item,
                 explanation: exp?.explanation || 'Recommended based on your watch history.',
                 badge: exp?.badge || 'Top Pick',
                 verdict: exp?.verdict || 'Worth Watching'
              };
            });
            setRecommendations(enriched);
        }
      } catch (error) {
         console.error('Failed to get AI recommendations', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchRecommendations();
  }, [items]);

  if (items.length === 0) return null;
  
  if (loading) {
     return (
        <div className="w-full flex items-center justify-center p-12 bg-white/5 rounded-3xl border border-white/10 animate-pulse">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="ml-4 font-black tracking-widest uppercase text-xs">Generating Odyssey...</span>
        </div>
     );
  }

  if (recommendations.length === 0) return null;

  const current = recommendations[currentIndex];

  return (
      <div className="relative w-full aspect-video md:aspect-[21/9] rounded-[2.5rem] overflow-hidden group shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-primary/20 mb-16">
          <AnimatePresence mode="wait">
              <motion.div 
                 key={`${currentIndex}-${current?.item?.id}`}
                 initial={{ opacity: 0, scale: 1.05 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0 }}
                 transition={{ duration: 0.6, ease: "easeOut" }}
                 className="absolute inset-0"
              >
                  <img 
                    src={`https://image.tmdb.org/t/p/original${current?.item?.backdrop_path || current?.item?.poster_path}`}
                    alt={current?.item?.title || current?.item?.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/90 md:via-zinc-950/60 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent" />
              </motion.div>
          </AnimatePresence>

          <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-end z-10 pointer-events-none">
             <div className="w-full md:w-2/3 space-y-6 pointer-events-auto relative">
                <div className="flex gap-3 items-center flex-wrap">
                    <Badge className="bg-primary flex items-center text-black font-black uppercase tracking-widest pointer-events-auto shadow-lg shadow-primary/20 hover:scale-105 transition-transform text-xs py-1.5 px-4 rounded-xl">
                        <Sparkles className="w-3.5 h-3.5 mr-2" /> For You
                    </Badge>
                    <Badge variant="outline" className="text-primary border-primary/40 bg-primary/10 tracking-widest font-black py-1.5 px-3 rounded-xl uppercase shadow-md shadow-black/50">
                        #{current?.badge || 'Top Pick'}
                    </Badge>
                </div>
                
                <h3 
                   className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none hover:text-primary transition-colors cursor-pointer drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] font-display uppercase"
                   onClick={() => current?.item && onItemClick(current.item)}
                >
                   {current?.item?.title || current?.item?.name}
                </h3>
                
                <p className="text-zinc-300 font-bold max-w-2xl text-base md:text-lg leading-relaxed drop-shadow-lg line-clamp-3">
                   {current?.explanation}
                </p>

                <div className="flex gap-4 pt-4 shrink-0">
                    <Button 
                       className="bg-primary text-black hover:bg-white font-black h-14 md:h-16 px-8 md:px-10 rounded-2xl shadow-xl transition-all hover:scale-105"
                       onClick={() => current?.item && onItemClick(current.item)}
                    >
                       <Info className="w-5 h-5 mr-3" /> Explore Odyssey
                    </Button>
                </div>
             </div>
          </div>
          
          <div className="absolute right-6 bottom-8 z-20 flex gap-2">
              <Button 
                 variant="ghost" 
                 size="icon" 
                 className="bg-black/50 hover:bg-primary text-white border border-white/20 hover:border-transparent rounded-full transition-all w-12 h-12"
                 onClick={(e) => {
                     e.stopPropagation();
                     setCurrentIndex((prev) => (prev > 0 ? prev - 1 : recommendations.length - 1));
                 }}
              >
                  <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button 
                 variant="ghost" 
                 size="icon" 
                 className="bg-black/50 hover:bg-primary text-white border border-white/20 hover:border-transparent rounded-full transition-all w-12 h-12"
                 onClick={(e) => {
                     e.stopPropagation();
                     setCurrentIndex((prev) => (prev < recommendations.length - 1 ? prev + 1 : 0));
                 }}
              >
                  <ChevronRight className="w-6 h-6" />
              </Button>
          </div>
      </div>
  );
}
