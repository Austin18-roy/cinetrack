import React, { useState, useEffect } from 'react';
import { tmdbService } from '../services/tmdbService';
import { TiltCard } from './TiltCard';

export function SimilarContent({ itemId, type, onSelect }: { itemId: number, type: 'movie' | 'tv' | 'anime', onSelect: (item: any) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    async function fetchSimilar() {
      setLoading(true);
      try {
        if (type === 'anime' || String(itemId).startsWith('jikan_')) {
          setItems([]);
        } else {
          const data = await tmdbService.getRecommendations(itemId, type as 'movie' | 'tv');
          setItems(Array.isArray(data) ? data.slice(0, 10) : []);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    fetchSimilar();
  }, [itemId, type]);

  if (loading) return (
    <div className="space-y-4 pt-8">
       <h3 className="text-xl font-black tracking-tighter">You May Also Like</h3>
       <div className="flex gap-4 overflow-x-auto pb-4">
         {[...Array(5)].map((_, i) => <div key={i} className="w-32 h-48 bg-white/5 rounded-xl animate-pulse shrink-0" />)}
       </div>
    </div>
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-4 pt-8 border-t border-border mt-8 relative z-20">
      <h3 className="text-xl font-black tracking-tighter">You May Also Like</h3>
      <div className="flex gap-4 overflow-x-auto pb-8 pt-4 px-2 scrollbar-hide snap-x relative z-30" style={{ overflowY: 'visible' }}>
        {items.map(item => (
          <TiltCard key={item.id} item={item} isMobile={isMobile} onClick={() => onSelect({ ...item, media_type: type })} />
        ))}
      </div>
    </div>
  );
}
