import React, { useState } from 'react';
import { Search, Loader2, X, AlertCircle } from 'lucide-react';
import { tmdbService } from '../services/tmdbService';
import { aiService, AIVerdict } from '../services/aiService';
import { CompareGraph } from './CompareGraph';
import { Button } from '@/components/ui/button';

export function CompareModal({ 
  baseItem, 
  baseVerdict, 
  onClose 
}: { 
  baseItem: any; 
  baseVerdict: AIVerdict; 
  onClose: () => void; 
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [compareVerdict, setCompareVerdict] = useState<AIVerdict | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const data = await tmdbService.searchMulti(query);
      // Only keep movies or TV shows
      setResults(data.results.filter((r: any) => r.media_type !== 'person').slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCompare = async (item: any) => {
    setSelectedMovie(item);
    setIsAnalyzing(true);
    try {
      // We pass an empty history/profile to get a neutral verdict to just extract mood scores
      const verdict = await aiService.getVerdictAndSummary(
        item, 
        null, 
        null, 
        { 
          genres: {}, languages: {}, recentGenres: [], seenItems: [], 
          animeProfile: { genres: {}, themes: {}, demographics: {}, studios: {}, liked: [] }
        }, 
        []
      );
      setCompareVerdict(verdict);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Compare <span className="text-primary">{baseItem?.title || baseItem?.name}</span>
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!selectedMovie ? (
            <div className="flex flex-col gap-6">
              <p className="text-zinc-400 text-sm">Search for another movie or series to compare AI-analyzed mood, pacing, and thrill scores.</p>
              
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Search a title to compare..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 pl-12 rounded-xl focus:outline-none focus:border-primary transition-colors"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 font-bold" disabled={isSearching || !query.trim()}>
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
              </form>

              {results.length > 0 && (
                <div className="flex flex-col gap-3 mt-4">
                  <h3 className="text-sm font-black uppercase text-zinc-500 tracking-widest">Results</h3>
                  {results.map((r, idx) => (
                    <button 
                      key={`${r?.id}-${idx}`}
                      onClick={() => handleCompare(r)}
                      className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-3 text-left transition-colors"
                    >
                      {r.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w92${r.poster_path}`} alt={r?.title || r?.name} className="w-12 h-16 object-cover rounded shadow" />
                      ) : (
                        <div className="w-12 h-16 bg-white/10 rounded" />
                      )}
                      <div>
                        <div className="font-bold text-white text-lg">{r?.title || r?.name}</div>
                        <div className="text-zinc-400 text-sm">
                          {r?.release_date?.substring(0,4) || r?.first_air_date?.substring(0,4)} • {r.media_type === 'tv' ? 'TV Series' : 'Movie'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center p-12 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-zinc-400 font-medium">Analyzing {selectedMovie.title || selectedMovie.name}...</p>
                </div>
              ) : compareVerdict ? (
                <div className="w-full flex flex-col gap-6">
                  {/* Versus Header */}
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="flex flex-col items-center w-1/3 text-center gap-2">
                       <img src={`https://image.tmdb.org/t/p/w154${baseItem?.poster_path}`} className="w-20 rounded shadow-2xl" />
                       <span className="font-bold text-primary">{baseItem?.title || baseItem?.name}</span>
                    </div>
                    <div className="text-3xl font-black italic text-zinc-600">VS</div>
                    <div className="flex flex-col items-center w-1/3 text-center gap-2">
                       <img src={`https://image.tmdb.org/t/p/w154${selectedMovie?.poster_path}`} className="w-20 rounded shadow-2xl" />
                       <span className="font-bold text-[#00f0ff]">{selectedMovie?.title || selectedMovie?.name}</span>
                    </div>
                  </div>

                  {/* Graph */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <CompareGraph 
                      movieA={baseItem?.title || baseItem?.name || 'A'}
                      movieB={selectedMovie?.title || selectedMovie?.name || 'B'}
                      scoresA={baseVerdict?.moodScores || {}}
                      scoresB={compareVerdict?.moodScores || {}} 
                    />
                  </div>
                  
                  {/* Reset Button */}
                  <div className="flex justify-center mt-4">
                     <Button 
                        variant="outline" 
                        onClick={() => { setSelectedMovie(null); setCompareVerdict(null); }}
                     >
                       Compare Another
                     </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-red-500/10 text-red-400 p-4 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  Could not generate AI comparison scores.
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
