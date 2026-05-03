import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');

const picksComponent = `
export function PicksForYouRow({ onItemClick }: { onItemClick: (item: any) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPicks() {
      setIsLoading(true);
      try {
        const profile = profileService.getProfile();
        // Fetch trending and popular from tmdb
        const [trendingMovies, trendingSeries] = await Promise.all([
           tmdbService.getTrendingMovies(1),
           tmdbService.getTrendingSeries(1)
        ]);
        const combined = [...(trendingMovies.results || []), ...(trendingSeries.results || [])];
        
        // score them using the user profile
        const personalized = combined
          .map(item => {
             let score = 0;
             const reasons: string[] = [];
             
             if (item.genre_ids) {
                for (const g of item.genre_ids) {
                   if (profile.genres[g] && profile.genres[g] > 0) {
                      score += profile.genres[g] * 2;
                      const genreName = Object.values(AVAILABLE_GENRES).flat().find(cat => cat.id === g)?.name;
                      if (genreName) {
                         reasons.push(\`Because you like \${genreName}\`);
                      }
                   }
                }
             }

             if (item.vote_average && item.vote_average >= 8) {
                score += 5;
                reasons.push("Highly rated by viewers");
             }

             if (!reasons.length) {
                reasons.push("Trending right now");
             }

             return { ...item, score, reasons: Array.from(new Set(reasons)).slice(0, 2) };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        
        setItems(personalized);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPicks();
  }, []);

  if (isLoading) return <div className="animate-pulse h-64 bg-white/5 rounded-xl block w-full mb-8" />;
  if (items.length === 0) return null;

  return (
    <div className="row-container space-y-6">
      <div className="row-header">
         <h3 className="text-3xl font-black tracking-tighter flex items-center gap-4 text-white font-display uppercase italic">
            🎯 Picks for You
         </h3>
      </div>
      <div className="row-scroll flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x px-4 -mx-4 md:px-0 md:mx-0 media-row">
         {items.map((item, index) => (
             <div key={item.id} className="snap-start flex-shrink-0 w-40 flex flex-col gap-2">
                 <MediaCard 
                    item={item} 
                    type={item.media_type || (item.name ? 'tv' : 'movie')} 
                    onClick={() => onItemClick(item)}
                 />
                 <div className="flex flex-col gap-1 px-1 mt-2">
                   {item.reasons.map((r: string, i: number) => (
                      <span key={i} className="text-xs text-brand-amber font-bold leading-tight flex items-start gap-1">
                        <span className="shrink-0">💡</span>
                        <span>{r}</span>
                      </span>
                   ))}
                 </div>
             </div>
         ))}
      </div>
    </div>
  );
}
`;

// Insert the component before function App()
const updated1 = content.replace("export default function App() {", picksComponent + "\n\nexport default function App() {");

// Insert <PicksForYouRow onItemClick={(item) => { handleSelectItem(item); }} /> before Top 10 This Month
const updated2 = updated1.replace(
  "{/* Top 10 This Month */}",
  "<PicksForYouRow onItemClick={handleSelectItem} />\n\n                {/* Top 10 This Month */}"
);

fs.writeFileSync('src/App.tsx', updated2);
