/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, ReactNode, useRef, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { 
  Plus, 
  Search, 
  Film, 
  Tv, 
  Gamepad2, 
  CheckCircle2, 
  Clock, 
  PlayCircle, 
  Star, 
  Trash2, 
  LogOut,
  LayoutDashboard,
  MinusCircle,
  PlusCircle,
  TrendingUp,
  X,
  Loader2,
  Info,
  Sparkles,
  Play,
  Volume2,
  VolumeX,
  History,
  Compass,
  Globe,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Palette,
  Settings,
  RefreshCw,
  Users,
  Bell,
  Calendar,
  Zap,
  Dna,
  ListOrdered,
  MessageSquareQuote,
  Dice5,
  Target,
  Trophy,
  Quote
} from 'lucide-react';
import { tmdbService, type TMDBItem } from './services/tmdbService';
import { jikanService } from './services/jikanService';
import { omdbService, type OMDbRatings } from './services/omdbService';
import { aiService, type AIVerdict } from './services/aiService';
import { profileService } from './services/profileService';
import { buildHabitProfile, getContextAwareRecommendations, surpriseMeSmart, generateReason, getTimeSlot, getSlotLabel } from './services/smartEngineService';
import { applyFilters } from './services/filterService';
import { AVAILABLE_GENRES } from './utils/constants';
import { curatedTamilSeries } from './data/tamilSeries';
import { RegionAccordion } from './components/GlobalContent';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// --- Types ---

type MediaType = 'movie' | 'series' | 'anime';
type MediaStatus = 'plan-to-watch' | 'watching' | 'completed';

interface MediaItem {
  id: string;
  userId: string;
  title: string;
  type: MediaType;
  status: MediaStatus;
  currentEpisode?: number;
  totalEpisodes?: number;
  rating?: number;
  notes?: string;
  posterUrl?: string;
  externalId?: string | number;
  source?: 'tmdb' | 'manual';
  language?: string;
  genreIds?: number[];
  watchProviders?: string[];
  createdAt: any;
  updatedAt: any;
  // New fields for advanced features
  themes?: string[];
  watchedEpisodes?: number[];
  seasons?: any[];
  hypeScore?: number;
  recommendationReason?: string;
  trailer_key?: string;
}

// --- Auth Context ---

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Successfully logged in!');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to log in.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out.');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out.');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Backdrop Context ---
interface BackdropContextType {
  setHoveredBackdrop: (url: string | null) => void;
}

const BackdropContext = createContext<BackdropContextType | undefined>(undefined);

const useBackdrop = () => {
  const context = useContext(BackdropContext);
  if (!context) return { setHoveredBackdrop: () => {} };
  return context;
};

// --- Watchlist Context ---
export const WatchlistContext = createContext<{ 
  watchlistItems: any[];
  addToWatchlist: (item: any, type: string) => Promise<void>;
  removeFromWatchlist: (externalId: string | number) => Promise<void>;
}>({ 
  watchlistItems: [],
  addToWatchlist: async () => {},
  removeFromWatchlist: async () => {} 
});

export const useWatchlist = () => useContext(WatchlistContext);

// --- Smart Refresh Manager ---
const CACHE_TIME = 1000 * 60 * 30; // 30 minutes

export const smartRefreshManager = {
  shouldRefresh: (key: string) => {
    const lastFetch = localStorage.getItem(`last_fetch_${key}`);
    if (!lastFetch) return true;
    return Date.now() - parseInt(lastFetch) > CACHE_TIME;
  },
  setLastFetch: (key: string) => {
    localStorage.setItem(`last_fetch_${key}`, Date.now().toString());
  },
  getCached: (key: string) => {
    const data = localStorage.getItem(`cache_${key}`);
    return data ? JSON.parse(data) : null;
  },
  setCache: (key: string, data: any) => {
    localStorage.setItem(`cache_${key}`, JSON.stringify(data));
  },
  clearCache: () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cache_') || key.startsWith('last_fetch_')) {
        localStorage.removeItem(key);
      }
    });
  }
};

// --- Components ---

function StarRating({ 
  rating, 
  onRatingChange, 
  max = 10, 
  readonly = false 
}: { 
  rating: number; 
  onRatingChange?: (rating: number) => void; 
  max?: number;
  readonly?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(max)].map((_, i) => {
        const starValue = i + 1;
        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            className={`${readonly ? 'cursor-default' : 'cursor-pointer'} transition-all hover:scale-110 active:scale-95`}
            onMouseEnter={() => !readonly && setHover(starValue)}
            onMouseLeave={() => !readonly && setHover(0)}
            onClick={() => !readonly && onRatingChange?.(starValue)}
          >
            <Star 
              className={`w-4 h-4 ${
                starValue <= (hover || rating) 
                  ? 'fill-amber-500 text-amber-500' 
                  : 'text-zinc-700'
              } transition-colors`} 
            />
          </button>
        );
      })}
      {!readonly && rating > 0 && (
        <span className="ml-2 text-xs font-bold text-amber-500">{rating}/{max}</span>
      )}
    </div>
  );
}

function DetailModal({ 
  item, 
  isOpen, 
  onClose, 
  onAdd,
  onMarkWatched,
  watchedEpisodes = [],
  onMarkEpisodeWatched
}: { 
  item: any; 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (item: any) => void;
  onMarkWatched: (item: any) => void;
  watchedEpisodes?: number[];
  onMarkEpisodeWatched?: (item: any, ep: number) => void;
}) {
  const [details, setDetails] = useState<any>(null);
  const [omdbRatings, setOmdbRatings] = useState<OMDbRatings | null>(null);
  const [aiVerdict, setAiVerdict] = useState<AIVerdict | null>(null);
  const [storyDNA, setStoryDNA] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerdictLoading, setIsVerdictLoading] = useState(false);
  const [userCountry, setUserCountry] = useState<string>('US');

  useEffect(() => {
    try {
      const locale = navigator.language;
      const country = locale.split('-')[1] || locale.toUpperCase();
      if (country && country.length === 2) {
        setUserCountry(country);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen && item) {
      const fetchDetails = async () => {
        setIsLoading(true);
        setAiVerdict(null);
        setStoryDNA([]);
        try {
          let data;
          let providers = null;
          let translations = null;
          
          if (item.media_type === 'anime' || (typeof item.id === 'string' && item.id.startsWith('jikan_'))) {
            const jikanId = typeof item.id === 'string' ? parseInt(item.id.replace('jikan_', '')) : item.id;
            data = await jikanService.getAnimeDetails(jikanId);
            // Jikan doesn't have watch providers directly in the same way, we could mock or skip
          } else {
            const type = item.media_type || (item.title ? 'movie' : 'tv');
            data = await tmdbService.getDetails(item.id, type);
            providers = await tmdbService.getWatchProviders(item.id, type);
            translations = await tmdbService.getTranslations(item.id, type);
          }
          
          const countryProviders = providers?.[userCountry] || providers?.['US'];

          setDetails({ 
            ...data, 
            providers: countryProviders?.flatrate || [],
            rentProviders: countryProviders?.rent || [],
            buyProviders: countryProviders?.buy || [],
            providerLink: countryProviders?.link,
            translations: translations || [],
            providerCountry: providers?.[userCountry] ? userCountry : (providers?.['US'] ? 'US' : null)
          });

          // Fetch Story DNA
          aiService.getStoryDNA(item).then(setStoryDNA);

          // Fetch OMDb Ratings if imdb_id is available
          const imdbId = data?.imdb_id || data?.external_ids?.imdb_id;
          let ratings = null;
          if (imdbId) {
            ratings = await omdbService.getRatings(imdbId);
            setOmdbRatings(ratings);
          } else {
            setOmdbRatings(null);
          }

          // Fetch AI Verdict
          setIsVerdictLoading(true);
          // Mock user genres for now, in a real app this would come from user profile
          const userGenres = [28, 12, 16]; 
          const verdict = await aiService.getVerdictAndSummary(item, data, ratings?.watchScore || null, userGenres);
          setAiVerdict(verdict);
          setIsVerdictLoading(false);

        } catch (error) {
          console.error('Detail fetch error:', error);
          setIsVerdictLoading(false);
        } finally {
          setIsLoading(false);
        }
      };
      fetchDetails();
    } else {
      setDetails(null);
      setOmdbRatings(null);
      setAiVerdict(null);
      setStoryDNA([]);
    }
  }, [isOpen, item]);

  if (!item) return null;

  const getAgeRating = () => {
    if (!details) return null;
    if (item.media_type === 'movie' || item.title) {
      const usRelease = details.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
      if (usRelease && usRelease.release_dates.length > 0) {
        // Find the first non-empty certification
        const cert = usRelease.release_dates.find((d: any) => d.certification)?.certification;
        return cert || null;
      }
    } else {
      const usRating = details.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US');
      if (usRating) {
        return usRating.rating || null;
      }
    }
    return null;
  };

  const ageRating = getAgeRating();

  const getSuitability = () => {
    if (!ageRating) return null;
    const kidsRatings = ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG'];
    const teensRatings = ['PG-13', 'TV-14'];
    const adultsRatings = ['R', 'NC-17', 'TV-MA'];

    if (kidsRatings.includes(ageRating)) return { label: 'Kids (7+)', icon: '👶', color: 'text-green-400', bg: 'bg-green-500/10' };
    if (teensRatings.includes(ageRating)) return { label: 'Teens (13+)', icon: '👦', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    if (adultsRatings.includes(ageRating)) return { label: 'Adults (18+)', icon: '🔞', color: 'text-red-400', bg: 'bg-red-500/10' };
    return null;
  };

  const suitability = getSuitability();

  return (
    <AnimatePresence>
      {isOpen && item && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950"
        >
          <div className="relative h-[50vh] min-h-[400px] w-full">
            <img 
              src={item.backdrop_path?.startsWith('http') ? item.backdrop_path : `https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}`} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              alt={item.title || item.name}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-6 right-6 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white border border-white/10 z-50"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="max-w-[1200px] mx-auto px-6 pb-20 -mt-32 relative z-10">
            <div className="flex flex-col md:flex-row gap-10">
              <div className="w-48 md:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 shrink-0 mx-auto md:mx-0 group">
                <img 
                  src={item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w500${item.poster_path}`} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                  alt={item.title || item.name}
                />
              </div>
              <div className="flex-1 space-y-8">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className="bg-primary text-primary-foreground font-black px-3 py-1">
                      {item.vote_average?.toFixed(1)} ★
                    </Badge>
                    <Badge variant="outline" className="uppercase border-white/20 text-white bg-white/5 backdrop-blur-md">
                      {item.media_type || (item.title ? 'movie' : 'tv')}
                    </Badge>
                    {ageRating && (
                      <Badge variant="outline" className="uppercase border-white/20 text-white bg-white/5 backdrop-blur-md font-bold">
                        {ageRating}
                      </Badge>
                    )}
                    {details?.status && (
                      <Badge variant="outline" className="uppercase border-white/20 text-zinc-300 bg-white/5 backdrop-blur-md">
                        {details.status}
                      </Badge>
                    )}
                    {item.platforms?.map((p: string) => (
                      <Badge key={p} variant="outline" className="uppercase border-blue-500/30 text-blue-400 bg-blue-500/10 backdrop-blur-md font-black">
                        Watch on: {p}
                      </Badge>
                    ))}
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">{item.title || item.name}</h2>
                  {storyDNA.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Story DNA</p>
                      <StoryDNA themes={storyDNA} />
                    </div>
                  )}
                  {details?.tagline && (
                    <p className="text-xl md:text-2xl text-zinc-400 italic font-medium">{details.tagline}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {(item.release_date || item.first_air_date)?.split('-')[0]}
                    </span>
                    {details?.original_language && (
                      <span className="uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">{details.original_language}</span>
                    )}
                    {details?.runtime > 0 && (
                      <span>{Math.floor(details.runtime / 60)}h {details.runtime % 60}m</span>
                    )}
                    {details?.number_of_seasons && (
                      <span>{details.number_of_seasons} Season{details.number_of_seasons > 1 ? 's' : ''}</span>
                    )}
                    {details?.number_of_episodes && (
                      <span>{details.number_of_episodes} Episodes</span>
                    )}
                    <span className="flex items-center gap-1.5" title="Popularity Score">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      {Math.round(details?.popularity || item.popularity || 0)}
                    </span>
                    <span className="flex items-center gap-1.5" title="Vote Count">
                      <Users className="w-4 h-4" />
                      {(details?.vote_count || item.vote_count || 0).toLocaleString()}
                    </span>
                  </div>
                  
                  {suitability && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Suitable For:</span>
                      <Badge className={`${suitability.bg} ${suitability.color} border-none font-bold px-3 py-1 text-sm`}>
                        <span className="mr-1.5">{suitability.icon}</span> {suitability.label}
                      </Badge>
                    </div>
                  )}
                </div>

                <p className="text-zinc-300 leading-relaxed text-lg font-medium max-w-3xl">
                  {item.overview}
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-8">
                    {/* Episodes Section */}
                    {(item.media_type === 'tv' || item.media_type === 'anime' || (details?.number_of_seasons)) && (
                      <div className="space-y-4">
                        <h3 className="text-xl font-black tracking-tighter flex items-center gap-2">
                          <ListOrdered className="w-5 h-5 text-primary" /> Episodes & Seasons
                        </h3>
                        <EpisodeList 
                          itemId={item.id.toString().startsWith('jikan_') ? parseInt(item.id.replace('jikan_', '')) : item.id} 
                          type={item.media_type === 'anime' || item.id.toString().startsWith('jikan_') ? 'anime' : 'tv'}
                          watchedEpisodes={watchedEpisodes}
                          onMarkWatched={(ep) => onMarkEpisodeWatched?.(item, ep)}
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {details?.genres?.map((g: any) => (
                        <Badge key={g.id} variant="secondary" className="bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 px-3 py-1">
                          {g.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-8">
                    <WatchOrderGuide title={item.title || item.name} />
                    
                    {details?.credits?.cast && (
                      <div className="space-y-4">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Top Cast</h3>
                        <div className="grid grid-cols-2 gap-4">
                          {details.credits.cast.slice(0, 4).map((person: any) => (
                            <div key={person.id} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-white/5">
                                {person.profile_path ? (
                                  <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={person.name} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-600">?</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-white truncate">{person.name}</p>
                                <p className="text-[9px] text-zinc-500 truncate">{person.character}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              {omdbRatings && (
                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Ratings</p>
                  <div className="flex flex-wrap gap-4">
                    {omdbRatings.imdb !== undefined && (
                      <div className="flex flex-col items-center bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">IMDb</span>
                        <span className="text-lg font-black text-white">{omdbRatings.imdb.toFixed(1)}</span>
                      </div>
                    )}
                    {omdbRatings.rottenTomatoes !== undefined && (
                      <div className="flex flex-col items-center bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Rotten Tomatoes</span>
                        <span className="text-lg font-black text-white">{(omdbRatings.rottenTomatoes * 10).toFixed(0)}%</span>
                      </div>
                    )}
                    {omdbRatings.metacritic !== undefined && (
                      <div className="flex flex-col items-center bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Metacritic</span>
                        <span className="text-lg font-black text-white">{(omdbRatings.metacritic * 10).toFixed(0)}</span>
                      </div>
                    )}
                    {omdbRatings.watchScore !== undefined && (
                      <div className={`flex flex-col items-center px-5 py-2 rounded-xl border ${
                        omdbRatings.watchScore >= 7.5 ? 'bg-green-500/10 border-green-500/30' :
                        omdbRatings.watchScore >= 5.0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                        'bg-red-500/10 border-red-500/30'
                      }`}>
                        <span className={`text-[10px] font-black uppercase tracking-wider mb-1 ${
                          omdbRatings.watchScore >= 7.5 ? 'text-green-400' :
                          omdbRatings.watchScore >= 5.0 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>WatchScore</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-xl font-black ${
                            omdbRatings.watchScore >= 7.5 ? 'text-green-400' :
                            omdbRatings.watchScore >= 5.0 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>{omdbRatings.watchScore.toFixed(1)}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${
                            omdbRatings.watchScore >= 7.5 ? 'text-green-500' :
                            omdbRatings.watchScore >= 5.0 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {omdbRatings.watchScore >= 7.5 ? 'Must Watch' : omdbRatings.watchScore >= 5.0 ? 'Good' : 'Avoid'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isVerdictLoading ? (
                <div className="pt-4 border-t border-white/5 animate-pulse">
                  <div className="h-4 w-32 bg-white/10 rounded mb-4"></div>
                  <div className="h-24 w-full bg-white/5 rounded-xl border border-white/10"></div>
                </div>
              ) : aiVerdict ? (
                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> AI Verdict
                  </p>
                  <div className={`p-5 rounded-2xl border ${
                    aiVerdict.verdict === 'Must Watch' ? 'bg-green-500/10 border-green-500/30' :
                    aiVerdict.verdict === 'Worth Watching' ? 'bg-blue-500/10 border-blue-500/30' :
                    aiVerdict.verdict === 'Depends on Taste' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {aiVerdict.verdict === 'Must Watch' ? '🔥' :
                         aiVerdict.verdict === 'Worth Watching' ? '👍' :
                         aiVerdict.verdict === 'Depends on Taste' ? '🤔' : '❌'}
                      </span>
                      <h4 className={`text-xl font-black ${
                        aiVerdict.verdict === 'Must Watch' ? 'text-green-400' :
                        aiVerdict.verdict === 'Worth Watching' ? 'text-blue-400' :
                        aiVerdict.verdict === 'Depends on Taste' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>{aiVerdict.verdict}</h4>
                    </div>
                    <p className="text-zinc-300 font-medium mb-4">{aiVerdict.reason}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <h5 className="text-sm font-bold text-green-400 mb-2 flex items-center gap-2">👍 Pros</h5>
                        <ul className="space-y-1">
                          {aiVerdict.pros.map((pro, i) => (
                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">•</span> {pro}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <h5 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">👎 Cons</h5>
                        <ul className="space-y-1">
                          {aiVerdict.cons.map((con, i) => (
                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span> {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    {aiVerdict.targetAudience && aiVerdict.targetAudience.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">👥 Works Best For</h5>
                        <div className="flex flex-wrap gap-2">
                          {aiVerdict.targetAudience.map((audience, i) => (
                            <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-zinc-300">
                              {audience}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiVerdict.whyWatch && (
                      <div className="mb-4 bg-primary/10 border border-primary/20 rounded-xl p-4">
                        <h5 className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-1">🧾 Why Watch This</h5>
                        <p className="text-sm text-zinc-200 font-medium">{aiVerdict.whyWatch}</p>
                      </div>
                    )}
                    
                    <p className="text-sm text-zinc-400 italic border-t border-white/10 pt-3">
                      "{aiVerdict.summary}"
                    </p>
                  </div>
                </div>
              ) : null}

              {details?.credits?.cast?.length > 0 && (
                <div className="pt-4">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Top Cast</p>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {details.credits.cast.slice(0, 12).map((actor: any) => (
                      <div key={actor.id} className="flex items-center gap-3 bg-white/5 pr-4 rounded-full border border-white/5 shrink-0">
                        {actor.profile_path ? (
                          <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} className="w-10 h-10 rounded-full object-cover" alt={actor.name} />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">{actor.name.charAt(0)}</div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-zinc-200 leading-tight">{actor.name}</span>
                          <span className="text-[10px] text-zinc-500 font-medium leading-tight">{actor.character}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(details?.credits?.crew?.length > 0 || details?.production_companies?.length > 0) && (
                <div className="pt-4 flex flex-wrap gap-8">
                  {(() => {
                    const director = details?.credits?.crew?.find((c: any) => c.job === 'Director');
                    const writer = details?.credits?.crew?.find((c: any) => c.department === 'Writing');
                    return (
                      <>
                        {director && (
                          <div>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Director</p>
                            <p className="text-sm font-bold text-zinc-300">{director.name}</p>
                          </div>
                        )}
                        {writer && (
                          <div>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Writer</p>
                            <p className="text-sm font-bold text-zinc-300">{writer.name}</p>
                          </div>
                        )}
                        {details?.production_companies?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Studio</p>
                            <p className="text-sm font-bold text-zinc-300">
                              {details.production_companies.slice(0, 2).map((c: any) => c.name).join(', ')}
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center gap-4 pt-6">
                <Button 
                  className="bg-gradient-to-r from-primary to-amber-600 hover:from-amber-400 hover:to-primary text-primary-foreground font-black h-14 px-10 rounded-2xl shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                  onClick={() => {
                    onAdd(item);
                    onClose();
                  }}
                >
                  <Plus className="w-6 h-6 mr-2" /> Add to Watchlist
                </Button>
                <Button 
                  variant="outline"
                  className="border-white/20 hover:bg-white/10 text-white font-black h-14 px-8 rounded-2xl transition-all hover:scale-105 active:scale-95"
                  onClick={() => {
                    onMarkWatched(item);
                    onClose();
                  }}
                >
                  <CheckCircle2 className="w-6 h-6 mr-2" /> Mark as Watched
                </Button>
              </div>

              {/* Language Info Section */}
              <div className="pt-8 space-y-4 border-t border-white/5">
                <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">🌍 Language Info</p>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/5 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🎤</span>
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Original</p>
                      <p className="text-sm font-bold text-zinc-200">
                        {new Intl.DisplayNames(['en'], { type: 'language' }).of(details?.original_language || 'en')}
                      </p>
                    </div>
                  </div>
                  
                  {details?.translations?.length > 0 && (
                    <>
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-1">🔊</span>
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Audio (Dubbed)</p>
                          <p className="text-sm font-medium text-zinc-300">
                            {details.translations.slice(0, 5).map((t: any) => t.english_name || t.name).join(', ')}
                            {details.translations.length > 5 ? ` +${details.translations.length - 5} more` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-1">💬</span>
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Subtitles</p>
                          <p className="text-sm font-medium text-zinc-300">
                            {details.translations.slice(0, 8).map((t: any) => t.english_name || t.name).join(', ')}
                            {details.translations.length > 8 ? ` +${details.translations.length - 8} more` : ''}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                  {(!details?.translations || details.translations.length === 0) && (
                    <p className="text-sm font-medium text-zinc-400 italic pl-8">Original language only</p>
                  )}
                </div>
              </div>

              {/* Watch Providers Section */}
              <div className="pt-8 space-y-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">📺 Where to Watch ({details?.providerCountry || 'US'})</p>
                </div>
                
                {(!details?.providers?.length && !details?.rentProviders?.length && !details?.buyProviders?.length) ? (
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5 text-center">
                    <p className="text-sm font-bold text-zinc-400">Not available in your region</p>
                    <p className="text-xs text-zinc-500 mt-1">Try checking other regions or platforms.</p>
                  </div>
                ) : (
                  <div className="space-y-6 bg-white/5 rounded-2xl p-5 border border-white/5">
                    {details?.providers?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="text-green-400">🔥</span> Streaming
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                          {details.providers.map((p: any) => (
                            <div key={p.provider_id} className="group relative shrink-0">
                              <img 
                                src={`https://image.tmdb.org/t/p/original${p.logo_path}`} 
                                className="w-12 h-12 rounded-xl border border-white/10 shadow-lg transition-transform group-hover:scale-110"
                                alt={p.provider_name}
                              />
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-50 border border-white/10 font-bold">
                                {p.provider_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {details?.rentProviders?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="text-yellow-400">💰</span> Rent
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                          {details.rentProviders.map((p: any) => (
                            <div key={p.provider_id} className="group relative shrink-0">
                              <img 
                                src={`https://image.tmdb.org/t/p/original${p.logo_path}`} 
                                className="w-10 h-10 rounded-xl border border-white/10 shadow-lg transition-transform group-hover:scale-110 opacity-80 group-hover:opacity-100"
                                alt={p.provider_name}
                              />
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-50 border border-white/10 font-bold">
                                {p.provider_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {details?.buyProviders?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="text-blue-400">🛒</span> Buy
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                          {details.buyProviders.map((p: any) => (
                            <div key={p.provider_id} className="group relative shrink-0">
                              <img 
                                src={`https://image.tmdb.org/t/p/original${p.logo_path}`} 
                                className="w-10 h-10 rounded-xl border border-white/10 shadow-lg transition-transform group-hover:scale-110 opacity-80 group-hover:opacity-100"
                                alt={p.provider_name}
                              />
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-50 border border-white/10 font-bold">
                                {p.provider_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {details?.similar?.results?.length > 0 && (
                <div className="pt-8 space-y-4 border-t border-white/5">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">More Like This</p>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {details.similar.results.slice(0, 10).map((similarItem: any) => (
                      <div 
                        key={similarItem.id} 
                        className="w-32 shrink-0 cursor-pointer group"
                        onClick={() => {
                          onClose();
                          setTimeout(() => {
                            // We need to pass the item up to the parent to set it as selected
                            // Since we don't have a direct prop for this, we can dispatch a custom event
                            // or just handle it if we passed a setSelectedItem prop.
                            // Actually, the easiest way is to just dispatch a custom event on the window.
                            window.dispatchEvent(new CustomEvent('open-detail-modal', { detail: { ...similarItem, media_type: item.media_type || similarItem.media_type } }));
                          }, 300);
                        }}
                      >
                        <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2 relative">
                          {similarItem.poster_path ? (
                            <img 
                              src={`https://image.tmdb.org/t/p/w185${similarItem.poster_path}`} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                              alt={similarItem.title || similarItem.name} 
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                              <Film className="w-8 h-8 text-zinc-600" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <PlayCircle className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <p className="text-xs font-bold text-zinc-300 truncate">{similarItem.title || similarItem.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {details?.recommendations?.results?.length > 0 && (
                <div className="pt-8 space-y-4 border-t border-white/5">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Recommended</p>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {details.recommendations.results.slice(0, 10).map((recItem: any) => (
                      <div 
                        key={recItem.id} 
                        className="w-32 shrink-0 cursor-pointer group"
                        onClick={() => {
                          onClose();
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('open-detail-modal', { detail: { ...recItem, media_type: item.media_type || recItem.media_type } }));
                          }, 300);
                        }}
                      >
                        <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2 relative">
                          {recItem.poster_path ? (
                            <img 
                              src={`https://image.tmdb.org/t/p/w185${recItem.poster_path}`} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                              alt={recItem.title || recItem.name} 
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                              <Film className="w-8 h-8 text-zinc-600" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <PlayCircle className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <p className="text-xs font-bold text-zinc-300 truncate">{recItem.title || recItem.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
}

interface GenreRowProps {
  key?: any;
  title: string;
  genreId?: number;
  type: 'movie' | 'tv' | 'anime';
  language?: string;
  endpoint?: string;
  onItemClick: (item: any) => void;
  onSeeMore?: () => void;
}

export function GenreRow({ 
  title, 
  genreId, 
  type, 
  language = 'all',
  endpoint = 'discover',
  onItemClick,
  onSeeMore
}: GenreRowProps) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cacheKey = `${type}_${endpoint}_${genreId || 'none'}_${language}`;

  const fetchItems = async (p: number, isBackground = false) => {
    if (isBackground) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      let data;
      if (type === 'anime') {
        if (endpoint === 'top10') {
          data = { results: await jikanService.getTop10ThisMonth() };
        } else if (endpoint === 'upcoming') {
          data = await jikanService.getUpcomingAnime(p);
        } else if (endpoint === 'airing') {
          data = await jikanService.getAiringAnime(p);
        } else if (endpoint === 'hidden_gems') {
          data = await jikanService.getHiddenGems(p);
        } else if (genreId) {
          data = await jikanService.getAnimeByGenre(genreId, p);
        } else if (endpoint === 'trending' || title.includes('Trending')) {
          data = await jikanService.getSeasonalAnime(p);
        } else {
          data = await jikanService.getTopAnime(p);
        }
      } else {
        if (endpoint === 'curated_tamil_all') {
          data = { results: p === 1 ? curatedTamilSeries : [], totalPages: 1 };
        } else if (endpoint === 'curated_tamil_crime') {
          data = { results: p === 1 ? curatedTamilSeries.filter(s => s.genre_ids?.includes(80) || s.genre_ids?.includes(53)) : [], totalPages: 1 };
        } else if (endpoint === 'curated_tamil_drama') {
          data = { results: p === 1 ? curatedTamilSeries.filter(s => s.genre_ids?.includes(18)) : [], totalPages: 1 };
        } else if (endpoint === 'curated_tamil_comedy') {
          data = { results: p === 1 ? curatedTamilSeries.filter(s => s.genre_ids?.includes(35)) : [], totalPages: 1 };
        } else if (endpoint === 'trending') {
          data = type === 'movie' ? await tmdbService.getTrendingMovies(p) : await tmdbService.getTrendingSeries(p);
        } else if (endpoint === 'top10') {
          data = { results: await tmdbService.getTop10ThisMonth(type as 'movie' | 'tv') };
        } else if (endpoint === 'upcoming') {
          data = type === 'movie' ? await tmdbService.getUpcomingMovies(p) : await tmdbService.getUpcomingSeries(p);
        } else {
          const params: any = { 
            sort_by: 'popularity.desc'
          };
          if (genreId) params.with_genres = genreId.toString();
          if (language !== 'all') params.with_original_language = language;

          data = await tmdbService.getDiscover(type, params, p, 3);
        }
        
        // Strict Filter: Remove anime from TV results
        if (type === 'tv' && data.results) {
          data.results = data.results.filter((item: any) => 
            !(item.original_language === 'ja' && item.genre_ids?.includes(16))
          );
        }
      }
      
      if (p === 1) {
        setItems(data.results);
        smartRefreshManager.setCache(cacheKey, data.results);
        smartRefreshManager.setLastFetch(cacheKey);
      } else {
        setItems(prev => [...prev, ...data.results]);
      }
    } catch (error) {
      console.error('Fetch genre items error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setPage(1);
    const cachedData = smartRefreshManager.getCached(cacheKey);
    const alwaysRefresh = ["trending", "upcoming", "top10"];
    const shouldForceRefresh = alwaysRefresh.includes(endpoint) || smartRefreshManager.shouldRefresh(cacheKey);

    if (cachedData) {
      setItems(cachedData);
      if (shouldForceRefresh) {
        fetchItems(1, true);
      }
    } else {
      fetchItems(1);
    }
  }, [genreId, type, language, endpoint]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - 100 && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchItems(nextPage);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-black tracking-tight text-zinc-100">{title}</h3>
          {isRefreshing && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary animate-pulse uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              Updating
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {onSeeMore && (
            <Button 
              variant="ghost" 
              className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary hover:bg-primary/10"
              onClick={onSeeMore}
            >
              See More <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5"
              onClick={() => scrollRef.current?.scrollBy({ left: -400, behavior: 'smooth' })}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5"
              onClick={() => scrollRef.current?.scrollBy({ left: 400, behavior: 'smooth' })}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-5 overflow-x-auto px-4 py-12 -my-12 scrollbar-hide snap-x"
      >
        {items.length === 0 && isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-[170px] md:min-w-[220px] aspect-[2/3] rounded-2xl bg-zinc-900 animate-pulse border border-white/5" />
          ))
        ) : (
          items.map((item) => (
            <MediaCard 
              key={item.id} 
              item={item} 
              type={type} 
              onClick={() => onItemClick({ ...item, media_type: type })} 
            />
          ))
        )}
        {isLoading && items.length > 0 && (
          <div className="flex items-center justify-center min-w-[120px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

function StoryDNA({ themes }: { themes: string[] }) {
  if (!themes || themes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {themes.map((theme, i) => (
        <Badge key={i} variant="outline" className="text-[9px] font-black uppercase tracking-tighter border-primary/30 text-primary bg-primary/5 px-1.5 py-0">
          <Dna className="w-2.5 h-2.5 mr-1" /> {theme}
        </Badge>
      ))}
    </div>
  );
}

function UpcomingContent({ onItemClick }: { onItemClick: (item: any) => void }) {
  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [anime, setAnime] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpcoming = async (force = false) => {
    const cacheKey = 'upcoming_all';
    const cached = smartRefreshManager.getCached(cacheKey);
    const shouldForceRefresh = force || smartRefreshManager.shouldRefresh(cacheKey);

    if (cached && !force) {
      setMovies(cached.movies);
      setSeries(cached.series);
      setAnime(cached.anime);
      setLoading(false);
      
      if (shouldForceRefresh) {
        refreshData(true);
      }
      return;
    }

    await refreshData();
  };

  const refreshData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      
      const [movieData, seriesData, animeData] = await Promise.all([
        tmdbService.getDiscover('movie', {
          'primary_release_date.gte': today,
          sort_by: 'primary_release_date.asc'
        }),
        tmdbService.getDiscover('tv', {
          'first_air_date.gte': today,
          sort_by: 'first_air_date.asc'
        }),
        jikanService.getUpcomingAnime(1)
      ]);

      const filteredMovies = movieData.results.filter((m: any) => m.release_date >= today);
      const filteredSeries = seriesData.results.filter((s: any) => s.first_air_date >= today);
      const filteredAnime = animeData.results.filter((a: any) => {
        const releaseDate = a.first_air_date || a.release_date;
        return releaseDate && new Date(releaseDate) > new Date();
      });

      setMovies(filteredMovies);
      setSeries(filteredSeries);
      setAnime(filteredAnime);
      
      const cacheData = { movies: filteredMovies, series: filteredSeries, anime: filteredAnime };
      smartRefreshManager.setCache('upcoming_all', cacheData);
      smartRefreshManager.setLastFetch('upcoming_all');
    } catch (error) {
      console.error("Failed to fetch upcoming content", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcoming();
  }, []);

  const groupContent = (items: any[]) => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    return {
      thisWeek: items.filter(i => new Date(i.release_date || i.first_air_date) <= nextWeek),
      thisMonth: items.filter(i => {
        const date = new Date(i.release_date || i.first_air_date);
        return date > nextWeek && date <= nextMonth;
      }),
      later: items.filter(i => new Date(i.release_date || i.first_air_date) > nextMonth)
    };
  };

  const renderSection = (title: string, items: any[], icon: React.ReactNode) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-black tracking-tighter flex items-center gap-3">
          {icon}
          {title}
        </h3>
        <div className="flex gap-6 overflow-x-auto py-12 -my-12 scrollbar-hide snap-x">
          {items.map((item) => (
            <MediaCard 
              key={item.id} 
              item={item} 
              type={item.media_type || (item.title ? 'movie' : 'tv')} 
              onClick={() => onItemClick(item)} 
            />
          ))}
        </div>
      </div>
    );
  };

  if (loading && movies.length === 0) {
    return (
      <div className="space-y-12 py-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-6">
            <div className="h-8 w-48 bg-zinc-900 rounded-xl animate-pulse" />
            <div className="flex gap-6 overflow-hidden">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="min-w-[220px] aspect-[2/3] bg-zinc-900 rounded-3xl animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const allContent = [...movies, ...series, ...anime].sort((a, b) => 
    new Date(a.release_date || a.first_air_date).getTime() - new Date(b.release_date || b.first_air_date).getTime()
  );

  const groups = groupContent(allContent);

  return (
    <div className="space-y-16 py-8">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-black tracking-tighter">Upcoming Releases</h2>
          {loading && movies.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary animate-pulse uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              Updating
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-zinc-500 hover:text-white font-bold" 
          onClick={() => fetchUpcoming(true)}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      {renderSection("🔥 Coming This Week", groups.thisWeek, <Zap className="w-6 h-6 text-amber-500" />)}
      {renderSection("📅 Coming This Month", groups.thisMonth, <Calendar className="w-6 h-6 text-primary" />)}
      {renderSection("⏳ Later Releases", groups.later, <Clock className="w-6 h-6 text-zinc-500" />)}
    </div>
  );
}

function HypeMeter({ score }: { score?: number }) {
  if (!score) return null;
  const isHot = score > 80;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full ${isHot ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-primary'}`}
        />
      </div>
      <span className={`text-[9px] font-black ${isHot ? 'text-orange-500 animate-pulse' : 'text-zinc-500'}`}>
        {isHot ? '🔥 EXPLODING' : '📈 TRENDING'}
      </span>
    </div>
  );
}

function RecommendationReason({ reason }: { reason?: string }) {
  if (!reason) return null;
  return (
    <div className="mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20 flex gap-2 items-start">
      <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
      <p className="text-[10px] font-medium text-zinc-300 leading-tight italic">
        "{reason}"
      </p>
    </div>
  );
}

function EpisodeList({ 
  itemId, 
  type, 
  onMarkWatched, 
  watchedEpisodes = [] 
}: { 
  itemId: number; 
  type: 'tv' | 'anime'; 
  onMarkWatched: (ep: number) => void;
  watchedEpisodes?: number[];
}) {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSeasons = async () => {
      if (type === 'tv') {
        const details = await tmdbService.getDetails(itemId, 'tv');
        setSeasons(details.seasons || []);
      } else {
        // Anime usually has one season in Jikan or handled differently
        setSeasons([{ season_number: 1, name: 'Season 1' }]);
      }
    };
    fetchSeasons();
  }, [itemId, type]);

  useEffect(() => {
    const fetchEpisodes = async () => {
      setLoading(true);
      try {
        if (type === 'tv') {
          const data = await tmdbService.getSeasonDetails(itemId, selectedSeason);
          setEpisodes(data.episodes || []);
        } else {
          const data = await jikanService.getAnimeEpisodes(itemId);
          setEpisodes(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch episodes", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEpisodes();
  }, [itemId, type, selectedSeason]);

  return (
    <div className="space-y-4">
      {seasons.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {seasons.map((s) => (
            <Button
              key={s.season_number}
              size="sm"
              variant={selectedSeason === s.season_number ? 'default' : 'outline'}
              onClick={() => setSelectedSeason(s.season_number)}
              className="rounded-xl font-black text-[10px] uppercase tracking-widest h-8"
            >
              {s.name}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-2">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900/50 rounded-2xl animate-pulse" />
          ))
        ) : (
          episodes.map((ep) => {
            const epNum = ep.episode_number || ep.mal_id;
            const isWatched = watchedEpisodes.includes(epNum);
            return (
              <div 
                key={epNum}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between group ${
                  isWatched ? 'bg-primary/5 border-primary/20' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                    isWatched ? 'bg-primary text-primary-foreground' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {epNum}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${isWatched ? 'text-white' : 'text-zinc-300'}`}>
                      {ep.name || ep.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-medium">
                      {ep.air_date || ep.aired || 'TBA'}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onMarkWatched(epNum)}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    isWatched ? 'text-primary bg-primary/10' : 'text-zinc-600 hover:text-primary hover:bg-primary/10'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function WatchOrderGuide({ title }: { title: string }) {
  const [order, setOrder] = useState<{ step: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    const data = await aiService.getWatchOrder(title);
    setOrder(data);
    setLoading(false);
  };

  return (
    <div className="space-y-4 p-4 rounded-3xl bg-zinc-900/40 border border-white/5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-primary" /> Watch Order Guide
        </h4>
        {!order.length && !loading && (
          <Button size="sm" variant="ghost" onClick={fetchOrder} className="text-[10px] font-black uppercase h-7">
            Generate
          </Button>
        )}
      </div>
      
      {loading && <div className="h-20 bg-zinc-800/50 rounded-2xl animate-pulse" />}
      
      {order.length > 0 && (
        <div className="space-y-2">
          {order.map((item, i) => (
            <div key={i} className="flex items-center gap-3 group">
              <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] font-black text-zinc-500 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-zinc-300 truncate">{item.step}</p>
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-tighter">{item.type}</p>
              </div>
              {i < order.length - 1 && (
                <div className="absolute left-[1.15rem] mt-8 w-0.5 h-4 bg-zinc-800" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoveryMode({ onSelect }: { onSelect: (item: any) => void }) {
  const [loading, setLoading] = useState(false);

  const handleSurprise = async () => {
    setLoading(true);
    try {
      // Fetch trending and pick a random high-quality one
      const data = await tmdbService.getTrendingMovies(Math.floor(Math.random() * 5) + 1);
      const highQuality = data.results.filter(i => i.vote_average > 7);
      const random = highQuality[Math.floor(Math.random() * highQuality.length)] || data.results[0];
      onSelect({ ...random, media_type: 'movie' });
    } catch (error) {
      console.error("Discovery error", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleSurprise}
      disabled={loading}
      className="bg-gradient-to-br from-primary to-amber-600 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all duration-500 rounded-2xl font-black text-xs uppercase tracking-widest h-12 px-6 group"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Dice5 className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />}
      Surprise Me
    </Button>
  );
}

function MediaCard({ item, type, onClick, onHover }: { key?: any; item: any; type: 'movie' | 'tv' | 'anime'; onClick: () => void; onHover?: (url: string | null) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [expandedPosition, setExpandedPosition] = useState({ left: '50%', marginLeft: '-140px' });
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const { setHoveredBackdrop } = useBackdrop();
  const { watchlistItems, addToWatchlist, removeFromWatchlist } = useWatchlist();

  const isSaved = watchlistItems.some(i => i.externalId === item.id);

  const handleMouseEnter = () => {
    const backdrop = item.backdrop_path 
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/original${item.poster_path}`;
    
    if (onHover) onHover(backdrop);
    setHoveredBackdrop(backdrop);

    if (window.innerWidth < 768) return;
    
    hoverTimeoutRef.current = setTimeout(async () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const panelWidth = 320; // Slightly wider for Netflix look
        
        let left = '50%';
        let marginLeft = '-160px'; // Half of 320
        
        // Check if panel would go off left edge
        if (rect.left + rect.width / 2 - panelWidth / 2 < 20) {
          left = '0';
          marginLeft = '0';
        }
        // Check if panel would go off right edge
        else if (rect.left + rect.width / 2 + panelWidth / 2 > screenWidth - 20) {
          left = 'auto';
          marginLeft = '0';
        }
        
        setExpandedPosition({ 
          left, 
          marginLeft,
          ...(left === 'auto' ? { right: '0' } : {})
        } as any);
      }
      
      setIsExpanded(true);
      
      let fetchedKey = item.trailer_key || videoKey;

      if (!fetchedKey && type !== 'anime') {
        try {
          const key = await tmdbService.getTrailer(item.id as number | string, type);
          if (key) {
             fetchedKey = key;
             setVideoKey(key);
          }
        } catch (error) {
          console.error("Failed to fetch video", error);
        }
      }

      if (fetchedKey) {
        // Safe Delay for Video (Let image show first)
        videoTimeoutRef.current = setTimeout(() => setShowVideo(true), 700);
      }
    }, 400); // 400ms delay for Netflix-style expansion
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (videoTimeoutRef.current) clearTimeout(videoTimeoutRef.current);
    setIsExpanded(false);
    setShowVideo(false);
    setIsMuted(true);
    if (onHover) onHover(null);
    setHoveredBackdrop(null);
  };

  const handleAddClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to add to watchlist');
      return;
    }
    
    if (isSaved) {
      await removeFromWatchlist(item.id);
    } else {
      await addToWatchlist(item, type);
    }
  };

  const handleRemindMe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to set reminders');
      return;
    }
    try {
      await addDoc(collection(db, 'reminders'), {
        userId: user.uid,
        externalId: item.id,
        type: type,
        title: item.title || item.name,
        posterUrl: item.poster_path ? (item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w500${item.poster_path}`) : undefined,
        releaseDate: item.release_date || item.first_air_date,
        createdAt: serverTimestamp()
      });
      toast.success('Reminder set! We will notify you on release.');
    } catch (error) {
      console.error('Error setting reminder:', error);
      toast.error('Failed to set reminder');
    }
  };

  const isUpcoming = (item.release_date || item.first_air_date) && new Date(item.release_date || item.first_air_date) > new Date();
  const posterUrl = item.poster_path?.startsWith('http') 
    ? item.poster_path 
    : item.poster_path 
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop';

  return (
    <div 
      ref={cardRef}
      className="relative z-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div 
        whileTap={{ scale: 0.95 }}
        className="min-w-[170px] md:min-w-[220px] aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 cursor-pointer snap-start shadow-2xl relative group shimmer"
        onClick={() => {
          profileService.updateInteraction(item, 'click');
          onClick();
        }}
      >
        <img 
          src={posterUrl} 
          className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:blur-[2px]" 
          referrerPolicy="no-referrer"
          alt={item.title || item.name}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-100 translate-y-4 group-hover:translate-y-0">
          <p className="text-sm font-black text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{item.title || item.name}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-primary text-primary-foreground font-black text-[10px] px-1.5 py-0 shadow-lg shadow-black">
              {item.vote_average?.toFixed(1)} ★
            </Badge>
            <span className="text-[10px] text-zinc-300 font-black uppercase tracking-widest drop-shadow-md">
              {(item.release_date || item.first_air_date)?.split('-')[0]}
            </span>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 0 }}
            animate={{ opacity: 1, scale: 1.25, y: -20 }}
            exit={{ opacity: 0, scale: 0.8, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-0 w-[320px] z-[100] bg-zinc-900 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden pointer-events-auto group/expanded"
            style={{ 
              transformOrigin: 'center center',
              ...expandedPosition
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <div className="aspect-video relative bg-black overflow-hidden group/preview">
              <img 
                src={item.backdrop_path 
                  ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}` 
                  : (item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w500${item.poster_path}`)}
                className="absolute inset-0 w-full h-full object-cover animate-zoom-bg opacity-80"
                referrerPolicy="no-referrer"
                alt={item.title || item.name}
              />
              
              {showVideo && videoKey && (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${videoKey}&rel=0&modestbranding=1&start=30`}
                  title="Preview"
                  className="absolute inset-0 w-full h-[150%] object-cover scale-150 -translate-y-[15%] pointer-events-none fade-in duration-500"
                  allow="autoplay; encrypted-media"
                />
              )}

              {/* Cinematic Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent bottom-0 h-1/2 mt-auto" />
              
              {/* Play UI overlay to enforce video feel when no video available */}
              {(!showVideo || !videoKey) && (
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-black/50 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl">
                       <Play className="w-5 h-5 text-white fill-white ml-1" />
                    </div>
                 </div>
              )}

              {/* Audio Toggle Button */}
              {showVideo && videoKey && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/10 opacity-0 group-hover/preview:opacity-100 transition-opacity z-20 pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              )}

              {/* Faint Title Overlay within video area */}
              <div className="absolute bottom-4 left-4 right-4 z-10 font-bold text-white drop-shadow-md truncate">
                  {item.title || item.name}
              </div>
            </div>

            <div className="p-5 space-y-4 relative z-10 -mt-6">
              <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
                <div className="flex items-center gap-2">
                  <Button 
                    size="icon" 
                    className="w-10 h-10 rounded-full bg-white text-black hover:bg-zinc-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick();
                    }}
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="w-10 h-10 rounded-full border-white/20 bg-white/5 hover:bg-white/10"
                    onClick={handleAddClick}
                  >
                    {isSaved ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Plus className="w-5 h-5" />}
                  </Button>
                  {isUpcoming && (
                    <Button 
                      size="icon" 
                      variant="outline" 
                      className="w-10 h-10 rounded-full border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500"
                      onClick={handleRemindMe}
                    >
                      <Bell className="w-5 h-5" />
                    </Button>
                  )}
                </div>
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="w-10 h-10 rounded-full border-white/20 bg-white/5 hover:bg-white/10"
                >
                  <ChevronDown className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-black text-xs">{Math.round((item.vote_average || 0) * 10)}% Match</span>
                  <Badge variant="outline" className="text-[10px] border-white/20 text-zinc-400 font-bold">
                    {item.media_type || type}
                  </Badge>
                  <span className="text-zinc-500 text-[10px] font-bold">
                    {(item.release_date || item.first_air_date)?.split('-')[0]}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white truncate">{item.title || item.name}</h4>
                <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {item.overview}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GenreFullView({ 
  genre, 
  type, 
  language, 
  onBack, 
  onItemClick 
}: { 
  genre: { id?: number, name: string, endpoint?: string }; 
  type: 'movie' | 'tv' | 'anime'; 
  language: string; 
  onBack: () => void; 
  onItemClick: (item: any) => void; 
}) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filters state
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [filterYear, setFilterYear] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState(language);
  const [filterGenres, setFilterGenres] = useState<string[]>(
    genre.name && !genre.name.includes('Trending') && !genre.name.includes('Top') 
      ? [genre.name.replace(/ Movies| Series| Anime| Shows| Dramas/g, '').trim()]
      : []
  );

  const clearFilters = () => {
    setFilterYear('all');
    setFilterRating('all');
    setFilterLanguage('all');
    setFilterGenres([]);
  };

  const toggleGenre = (g: string) => {
    setFilterGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const [isFallback, setIsFallback] = useState(false);

  const fetchItems = async (p: number, reset = false) => {
    if (isLoading || (!hasMore && !reset)) return;
    setIsLoading(true);
    setIsFallback(false);
    try {
      let data;
      const endpoint = genre.endpoint || 'discover';

      if (type === 'anime') {
        if (endpoint === 'top10') {
          data = { results: await jikanService.getTop10ThisMonth(), totalPages: 1 };
        } else if (endpoint === 'upcoming') {
          data = await jikanService.getUpcomingAnime(p);
        } else if (endpoint === 'airing') {
          data = await jikanService.getAiringAnime(p);
        } else if (endpoint === 'hidden_gems') {
          data = await jikanService.getHiddenGems(p);
        } else if (genre.id) {
          data = await jikanService.getAnimeByGenre(genre.id, p);
        } else if (endpoint === 'trending' || genre.name.includes('Trending')) {
          data = await jikanService.getSeasonalAnime(p);
        } else {
          data = await jikanService.getTopAnime(p);
        }
      } else {
        if (endpoint === 'curated_tamil_all') {
          data = { results: p === 1 ? curatedTamilSeries : [], totalPages: 1 };
        } else if (endpoint === 'curated_tamil_crime') {
          data = { results: p === 1 ? curatedTamilSeries.filter(s => s.genre_ids?.includes(80) || s.genre_ids?.includes(53)) : [], totalPages: 1 };
        } else if (endpoint === 'curated_tamil_drama') {
          data = { results: p === 1 ? curatedTamilSeries.filter(s => s.genre_ids?.includes(18)) : [], totalPages: 1 };
        } else if (endpoint === 'curated_tamil_comedy') {
          data = { results: p === 1 ? curatedTamilSeries.filter(s => s.genre_ids?.includes(35)) : [], totalPages: 1 };
        } else if (endpoint === 'trending') {
          data = type === 'movie' ? await tmdbService.getTrendingMovies(p) : await tmdbService.getTrendingSeries(p);
        } else if (endpoint === 'top10') {
          data = { results: await tmdbService.getTop10ThisMonth(type as 'movie' | 'tv'), totalPages: 1 };
        } else if (endpoint === 'upcoming') {
          data = type === 'movie' ? await tmdbService.getUpcomingMovies(p) : await tmdbService.getUpcomingSeries(p);
        } else {
          const fetchWithParams = async (year: string, lang: string) => {
            const params: any = { 
              page: p.toString(),
              sort_by: sortBy
            };
            if (genre.id) params.with_genres = genre.id.toString();
            if (lang !== 'all') params.with_original_language = lang;
            
            if (year !== 'all') {
              if (type === 'movie') {
                params['primary_release_date.gte'] = `${year}-01-01`;
                params['primary_release_date.lte'] = `${year}-12-31`;
              } else {
                params['first_air_date.gte'] = `${year}-01-01`;
                params['first_air_date.lte'] = `${year}-12-31`;
              }
            } else {
              if (type === 'movie') {
                params['primary_release_date.gte'] = `1900-01-01`;
                params['primary_release_date.lte'] = `2026-12-31`;
              } else {
                params['first_air_date.gte'] = `1900-01-01`;
                params['first_air_date.lte'] = `2026-12-31`;
              }
            }
            if (filterRating !== 'all') {
              params['vote_average.gte'] = filterRating;
            }
            const res = await tmdbService.getDiscover(type, params);
            
            // Strict Filter: Remove anime from TV results
            if (type === 'tv' && res.results) {
              res.results = res.results.filter((item: any) => 
                !(item.original_language === 'ja' && item.genre_ids?.includes(16))
              );
            }
            return res;
          };

          data = await fetchWithParams(filterYear, filterLanguage);

          // Fallback logic if empty
          if (data.results.length === 0 && reset) {
            setIsFallback(true);
            if (filterYear !== 'all') {
              data = await fetchWithParams('all', filterLanguage);
            }
            if (data.results.length === 0 && filterLanguage !== 'all') {
              data = await fetchWithParams('all', 'all');
            }
            if (data.results.length === 0) {
               // Ultimate fallback: just get trending for this type
               const trending = type === 'movie' ? await tmdbService.getTrendingMovies(1) : await tmdbService.getTrendingSeries(1);
               data = trending;
            }
          }
        }
      }
      
      setItems(prev => reset ? data.results : [...prev, ...data.results]);
      setHasMore(data.results.length > 0 && p < (data.totalPages || 1));
    } catch (error) {
      console.error('Fetch genre full view error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchItems(1, true);
  }, [genre.id, type, sortBy, filterYear, filterRating, filterLanguage, genre.endpoint]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 500 && !isLoading && hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchItems(nextPage);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [page, isLoading, hasMore, sortBy, filterYear, filterRating, filterLanguage, genre.endpoint]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 30}, (_, i) => currentYear - i);
  const isDiscover = !genre.endpoint || genre.endpoint === 'discover';

  const filteredItems = useMemo(() => {
    return applyFilters(items, {
      genres: filterGenres,
      language: filterLanguage === 'all' ? null : filterLanguage,
      rating: filterRating === 'all' ? null : Number(filterRating),
      year: filterYear === 'all' ? null : Number(filterYear)
    });
  }, [items, filterGenres, filterLanguage, filterRating, filterYear]);

  // Auto-fetch if local filtering makes the list too short to scroll
  useEffect(() => {
    if (!isLoading && hasMore && filteredItems.length < 10 && items.length > 0) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchItems(nextPage);
    }
  }, [filteredItems.length, isLoading, hasMore]);

  return (
    <div className="space-y-8 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full bg-white/5 hover:bg-white/10">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h2 className="text-3xl font-black tracking-tighter">{genre.name}</h2>
        </div>
        
        <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex flex-col gap-4 sticky top-[80px] z-30 backdrop-blur-xl">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
               {/* Advanced Multi-Select Genres */}
               <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mr-2">Genres</span>
                  {AVAILABLE_GENRES.map(g => (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${
                        filterGenres.includes(g) 
                          ? 'bg-primary text-primary-foreground border-primary scale-105'
                          : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
               </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5 justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <select 
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="popularity.desc">Most Popular</option>
                <option value="vote_average.desc">Highest Rated</option>
                <option value={type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc'}>Latest Releases</option>
              </select>

              <select 
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="all">Any Year</option>
                {years.map(y => <option key={y} value={y}>{y}+</option>)}
              </select>

              <select 
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                value={filterRating}
                onChange={(e) => setFilterRating(e.target.value)}
              >
                <option value="all">Any Rating</option>
                <option value="8">8+ Stars ⭐</option>
                <option value="7">7+ Stars ⭐</option>
                <option value="6">6+ Stars ⭐</option>
              </select>

              <select 
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
              >
                <option value="all">Global</option>
                <option value="hi">Hindi</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
                <option value="ml">Malayalam</option>
                <option value="en">English</option>
                <option value="ko">Korean</option>
                <option value="ja">Japanese</option>
              </select>
            </div>

            {(filterGenres.length > 0 || filterYear !== 'all' || filterRating !== 'all' || filterLanguage !== 'all') && (
              <Button variant="ghost" onClick={clearFilters} className="text-zinc-400 hover:text-white rounded-xl">
                Clear Filters (x)
              </Button>
            )}
          </div>
        </div>
      </div>

      {isFallback && items.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-center">
          No exact matches — showing similar results
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {filteredItems.map((item) => (
          <MediaCard 
            key={item.id} 
            item={item} 
            type={type} 
            onClick={() => onItemClick({ ...item, media_type: type })} 
          />
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      
      {!isLoading && filteredItems.length === 0 && !isFallback && (
        <div className="text-center py-12 text-zinc-500">
          No results found for these filters. Try clearing some.
        </div>
      )}
    </div>
  );
}

function AnimeHero({ onItemClick }: { onItemClick: (item: any) => void }) {
  const [featured, setFeatured] = useState<any>(null);

  useEffect(() => {
    const fetchHero = async () => {
      const data = await jikanService.getTop10ThisMonth();
      if (data.length > 0) {
        setFeatured(data[0]);
      }
    };
    fetchHero();
  }, []);

  if (!featured) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative h-[60vh] w-full rounded-[3rem] overflow-hidden group mb-12"
    >
      <img 
        src={featured.poster_path} 
        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
        referrerPolicy="no-referrer"
        alt={featured.title}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
      
      <div className="absolute bottom-0 left-0 p-12 space-y-6 w-full md:w-2/3">
        <div className="flex items-center gap-3">
          <Badge className="bg-primary text-primary-foreground font-black px-4 py-1.5 rounded-xl">#1 TRENDING ANIME</Badge>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <span className="text-sm font-black">{featured.vote_average}</span>
          </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">{featured.title}</h1>
        <p className="text-zinc-300 text-lg line-clamp-3 font-medium max-w-xl">{featured.overview}</p>
        
        <div className="flex items-center gap-4 pt-4">
          <Button 
            size="lg" 
            className="bg-white text-black hover:bg-zinc-200 font-black h-14 px-8 rounded-2xl shadow-2xl shadow-white/10"
            onClick={() => onItemClick(featured)}
          >
            <PlayCircle className="w-6 h-6 mr-2" />
            Watch Now
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 font-black h-14 px-8 rounded-2xl"
          >
            <PlusCircle className="w-6 h-6 mr-2" />
            Add to List
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ExploreView({ 
  onItemClick 
}: { 
  onItemClick: (item: any) => void;
}) {
  const [activeExploreTab, setActiveExploreTab] = useState<'movie' | 'tv' | 'anime' | 'upcoming' | 'global'>('movie');
  const [seeMoreGenre, setSeeMoreGenre] = useState<{ id?: number, name: string, type: 'movie' | 'tv' | 'anime' | 'upcoming' | 'global', language?: string, endpoint?: any } | null>(null);
  const [visibleRows, setVisibleRows] = useState(5);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 800) {
        setVisibleRows(prev => Math.min(prev + 3, 30));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setVisibleRows(5); // Reset when tab changes
  }, [activeExploreTab]);

  const TABS = [
    { id: 'movie', label: 'Movies', icon: '🎬' },
    { id: 'tv', label: 'Series', icon: '📺' },
    { id: 'anime', label: 'Anime', icon: '🍥' },
    { id: 'global', label: 'Global', icon: '🌍' },
    { id: 'upcoming', label: 'Coming Soon', icon: '🆕' },
  ];

  const CATEGORIES = {
    movie: [
      { title: "🔥 Trending Now", endpoint: "trending" as const },
      { title: "⭐ Top 10 This Month", endpoint: "top10" as const },
      { title: "🎭 Tamil Movies", language: "ta" },
      { title: "💥 Action Movies", genreId: 28 },
      { title: "💖 Romance Movies", genreId: 10749 },
      { title: "😱 Thriller Movies", genreId: 53 },
      { title: "👨‍👩‍👧 Family Picks", genreId: 10751 },
      { title: "🚀 Sci-Fi Movies", genreId: 878 },
      { title: "😂 Comedy Movies", genreId: 35 },
      { title: "🇮🇳 Hindi Movies", language: "hi" },
      { title: "🇰🇷 Korean Movies", language: "ko" },
    ],
    tv: [
      { title: "🎬 Tamil Web Series", endpoint: "curated_tamil_all" as const },
      { title: "🔥 Tamil Crime & Thriller", endpoint: "curated_tamil_crime" as const },
      { title: "🎭 Tamil Drama", endpoint: "curated_tamil_drama" as const },
      { title: "😂 Tamil Comedy", endpoint: "curated_tamil_comedy" as const },
      { title: "🔥 Trending Series", endpoint: "trending" as const },
      { title: "🇰🇷 Korean Dramas", language: "ko" },
      { title: "🔍 Crime & Thriller", genreId: 80 },
      { title: "😂 Comedy Shows", genreId: 35 },
      { title: "👻 Supernatural", genreId: 10765 },
      { title: "🎓 Teen Drama", genreId: 10762 },
      { title: "🇮🇳 Indian Series", language: "hi" },
      { title: "🇺🇸 English Shows", language: "en" },
    ],
    anime: [
      { title: "🔥 Top Anime This Month", endpoint: "top10" as const },
      { title: "📈 Trending Now", endpoint: "trending" as const },
      { title: "📺 Top Airing", endpoint: "airing" as const },
      { title: "⚔️ Action Anime", genreId: 1 },
      { title: "💖 Romance Anime", genreId: 22 },
      { title: "🏫 School Anime", genreId: 23 },
      { title: "🧠 Psychological", genreId: 40 },
      { title: "🌍 Isekai Anime", genreId: 62 },
      { title: "😂 Comedy Anime", genreId: 4 },
      { title: "🧙 Fantasy Anime", genreId: 10 },
      { title: "😢 Emotional Anime", genreId: 8 },
      { title: "💎 Hidden Gems", endpoint: "hidden_gems" as const },
    ],
    upcoming: [
      { title: "🎬 Upcoming Movies", type: "movie" as const, endpoint: "upcoming" as const },
      { title: "📺 Upcoming Series", type: "tv" as const, endpoint: "upcoming" as const },
      { title: "🍥 Upcoming Anime", type: "anime" as const, endpoint: "upcoming" as const },
    ]
  };

  if (seeMoreGenre) {
    return (
      <GenreFullView 
        genre={seeMoreGenre} 
        type={seeMoreGenre.type === 'upcoming' ? 'movie' : seeMoreGenre.type} 
        language={seeMoreGenre.language || 'all'} 
        onBack={() => setSeeMoreGenre(null)} 
        onItemClick={onItemClick} 
      />
    );
  }

  return (
    <div className="space-y-8 py-4">
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 sticky top-0 z-40">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveExploreTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all duration-300 ${
              activeExploreTab === tab.id 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeExploreTab === 'anime' && <AnimeHero onItemClick={onItemClick} />}

      {/* Content Rows */}
      <div className="space-y-12">
        {activeExploreTab === 'global' ? (
          <RegionAccordion onItemClick={onItemClick} onSeeMore={setSeeMoreGenre} />
        ) : activeExploreTab === 'upcoming' ? (
          <UpcomingContent onItemClick={onItemClick} />
        ) : (
          CATEGORIES[activeExploreTab].slice(0, visibleRows).map((cat, index) => (
            <motion.div
              key={cat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GenreRow 
                title={cat.title} 
                type={(cat as any).type || activeExploreTab} 
                genreId={cat.genreId}
                language={cat.language}
                endpoint={cat.endpoint}
                onItemClick={onItemClick} 
                onSeeMore={() => setSeeMoreGenre({ 
                  name: cat.title, 
                  type: (cat as any).type || activeExploreTab, 
                  language: cat.language,
                  id: cat.genreId,
                  endpoint: cat.endpoint
                })}
              />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// --- Main App Component ---

function MediaTracker() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'watchlist' | 'history' | 'stats' | 'settings'>('home');
  const [search, setSearch] = useState('');
  
  // Watchlist Filters State
  const [watchlistFilterStatus, setWatchlistFilterStatus] = useState<'all' | MediaStatus>('all');
  const [watchlistFilterType, setWatchlistFilterType] = useState<'all' | MediaType>('all');
  
  // TMDb State
  const [searchResults, setSearchResults] = useState<TMDBItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Explore State
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [hoveredBackdrop, setHoveredBackdrop] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [theme, setTheme] = useState<'default' | 'cyber' | 'minimal' | 'amoled' | 'custom'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('cineai-theme') as any) || 'default';
    }
    return 'default';
  });

  const [customThemeColors, setCustomThemeColors] = useState({
    background: '#1a1a2e',
    primary: '#e94560',
    foreground: '#ffffff',
    card: '#16213e'
  });

  useEffect(() => {
    const savedCustomColors = localStorage.getItem('cineai-custom-colors');
    if (savedCustomColors) {
      setCustomThemeColors(JSON.parse(savedCustomColors));
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cineai-theme', theme);

    if (theme === 'custom') {
      document.documentElement.style.setProperty('--background', customThemeColors.background);
      document.documentElement.style.setProperty('--primary', customThemeColors.primary);
      document.documentElement.style.setProperty('--foreground', customThemeColors.foreground);
      document.documentElement.style.setProperty('--card', customThemeColors.card);
      // Derive some other colors for a better look
      document.documentElement.style.setProperty('--popover', customThemeColors.card);
      document.documentElement.style.setProperty('--muted', customThemeColors.card);
      document.documentElement.style.setProperty('--border', `${customThemeColors.foreground}20`); // 20% opacity
    } else {
      // Reset inline styles
      document.documentElement.style.removeProperty('--background');
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--foreground');
      document.documentElement.style.removeProperty('--card');
      document.documentElement.style.removeProperty('--popover');
      document.documentElement.style.removeProperty('--muted');
      document.documentElement.style.removeProperty('--border');
    }
  }, [theme, customThemeColors]);

  const handleCustomColorChange = (key: keyof typeof customThemeColors, value: string) => {
    const newColors = { ...customThemeColors, [key]: value };
    setCustomThemeColors(newColors);
    localStorage.setItem('cineai-custom-colors', JSON.stringify(newColors));
  };

  // AI Recommendation State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<{
    item: TMDBItem;
    rank: number;
    badge: string;
    reason: string;
    whyNot?: string;
    verdict?: string;
    type: 'movie' | 'tv' | 'anime';
    providers?: any[];
  }[]>([]);
  const [currentAiIndex, setCurrentAiIndex] = useState(0);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiHistory, setAiHistory] = useState<string[]>([]);

  // Anime Preloading & Caching
  const [cachedAnime, setCachedAnime] = useState<TMDBItem[]>(() => {
    const saved = localStorage.getItem('anime_cache');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const preloadAnime = async () => {
      try {
        const { results } = await jikanService.getTopAnime(1);
        if (results && results.length > 0) {
          setCachedAnime(results);
          localStorage.setItem('anime_cache', JSON.stringify(results));
        }
      } catch (error) {
        console.error('Anime preload error:', error);
      }
    };
    preloadAnime();
  }, []);
  const [aiQuery, setAiQuery] = useState<string>('');
  const [refineQuery, setRefineQuery] = useState<string>('');
  const [forYouFeed, setForYouFeed] = useState<any[]>([]);
  
  // Smart Recommendation States
  const [contextPicks, setContextPicks] = useState<any[]>([]);
  const [bestPick, setBestPick] = useState<any | null>(null);
  const [smartSurpriseItem, setSmartSurpriseItem] = useState<any | null>(null);
  const [currentSlotLabel, setCurrentSlotLabel] = useState<string>("Picks for You");
  
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [timeBasedCategory, setTimeBasedCategory] = useState<any>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    let cat;
    if (hour >= 5 && hour < 12) {
      cat = { title: "Morning Energy", genreId: 28, type: 'movie' }; // Action for morning
    } else if (hour >= 12 && hour < 17) {
      cat = { title: "Afternoon Chill", genreId: 35, type: 'tv' }; // Comedy for afternoon
    } else if (hour >= 17 && hour < 22) {
      cat = { title: "Prime Time Thrills", genreId: 53, type: 'movie' }; // Thriller for evening
    } else {
      cat = { title: "Late Night Vibes", genreId: 10749, type: 'movie' }; // Romance/Drama for late night
    }
    setTimeBasedCategory(cat);
  }, []);

  // Form State
  const [newRating, setNewRating] = useState<number>(0);
  const [newNotes, setNewNotes] = useState<string>('');
  const [ratingItem, setRatingItem] = useState<MediaItem | null>(null);

  const fetchInitialFeed = async (isRefresh = false) => {
    if (!user) return;
    
    const cacheKey = 'initial_feed';
    const cached = smartRefreshManager.getCached(cacheKey);
    const shouldForceRefresh = isRefresh || smartRefreshManager.shouldRefresh(cacheKey);

    if (cached && !isRefresh) {
      setForYouFeed(cached);
      if (shouldForceRefresh) {
        // Background refresh
        setIsFeedLoading(false); 
      } else {
        return;
      }
    } else {
      setIsFeedLoading(true);
    }

    try {
      const profile = profileService.getProfile();
      const randomPage = Math.floor(Math.random() * 5) + 1;
      
      const [trendingMovies, trendingTv, discoverMovies] = await Promise.all([
        tmdbService.getTrendingMovies(randomPage),
        tmdbService.getTrendingSeries(randomPage),
        tmdbService.getDiscover('movie', { sort_by: 'popularity.desc' }, randomPage + 1, 1)
      ]);
      
      let candidates = [
        ...(trendingMovies?.results || []).map((m: any) => ({ ...m, media_type: 'movie' })),
        ...(trendingTv?.results || []).map((s: any) => ({ ...s, media_type: 'tv' })),
        ...(discoverMovies?.results || []).map((m: any) => ({ ...m, media_type: 'movie' }))
      ];

      // Filter out watched/added items and seen items
      candidates = candidates.filter(c => 
        !items.some(i => i.externalId === c.id) && 
        !profile.seenItems.includes(c.id)
      );

      // Deduplicate
      const uniqueCandidates = Array.from(new Map(candidates.map(item => [item.id, item])).values());

      // Score candidates
      const scoredCandidates = uniqueCandidates.map(c => {
        let genreScore = 0;
        let diversityPenalty = 0;
        
        if (c.genre_ids && c.genre_ids.length > 0) {
          c.genre_ids.forEach((id: number) => {
            genreScore += (profile.genres[id] || 0);
            if (profile.recentGenres.includes(id)) {
              diversityPenalty -= 1; // Penalty for recently seen genres
            }
          });
        }

        // Normalize genre score roughly
        const normalizedGenreScore = Math.min(Math.max(genreScore, 0), 10) / 10;
        const ratingScore = (c.vote_average || 0) / 10;
        const popularityScore = Math.min((c.popularity || 0) / 1000, 1);
        
        // Recency score (newer is better)
        let recencyScore = 0.5;
        const dateStr = c.release_date || c.first_air_date;
        if (dateStr) {
           const year = parseInt(dateStr.split('-')[0]);
           const currentYear = new Date().getFullYear();
           if (year === currentYear) recencyScore = 1.0;
           else if (year === currentYear - 1) recencyScore = 0.8;
           else if (year >= currentYear - 5) recencyScore = 0.6;
        }

        const score = (normalizedGenreScore * 0.4) + (ratingScore * 0.3) + (popularityScore * 0.2) + (recencyScore * 0.1) + (diversityPenalty * 0.05);

        return {
          ...c,
          matchScore: Math.round(Math.min(Math.max(score * 100, 10), 99)) // Keep between 10 and 99
        };
      });

      // Shuffle slightly to add randomness even among top scores
      scoredCandidates.sort((a, b) => (b as any).matchScore - (a as any).matchScore + (Math.random() * 10 - 5));

      const finalFeed = scoredCandidates.slice(0, 10);
      
      setForYouFeed(finalFeed);
      smartRefreshManager.setCache(cacheKey, finalFeed);
      smartRefreshManager.setLastFetch(cacheKey);

      // --- SMART ENGINE LOGIC ---
      if (items.length > 0) { // Require some history to build a habit profile
        const habitProfile = buildHabitProfile(items);
        const historyIds = items.map(i => String(i.externalId));
        
        // Grab a larger pool for smart recommendations
        const smartCandidates = uniqueCandidates; 
        
        const smartRecommendations = getContextAwareRecommendations(smartCandidates, habitProfile, historyIds);
        
        if (smartRecommendations.length > 0) {
          const currentHour = new Date().getHours();
          const currentSlot = getTimeSlot(currentHour);
          setCurrentSlotLabel(getSlotLabel(currentSlot));
          
          setBestPick(smartRecommendations[0]);
          setContextPicks(smartRecommendations.slice(1, 11)); // Next 10 best options
        }
      }
      // --------------------------
      
      // Preload next batch in background (optional, but good for UX)
      // We'll just mark these as seen for now
      profileService.markSeen(finalFeed);

    } catch (error) {
      console.error('Feed fetch error:', error);
    } finally {
      setIsFeedLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialFeed();
  }, [user, items]);

  const handleSmartSurprise = async () => {
    if (items.length === 0) {
      toast.error('Add items to your watchlist or history to get smart surprises!');
      return;
    }
    
    // Quick local trending check to ensure we have a pool
    const randomPage = Math.floor(Math.random() * 5) + 1;
    const [tm, tv, dm] = await Promise.all([
      tmdbService.getTrendingMovies(randomPage),
      tmdbService.getTrendingSeries(randomPage),
      tmdbService.getDiscover('movie', { sort_by: 'popularity.desc' }, randomPage)
    ]);
    const candidates = [
        ...(tm?.results || []).map((m: any) => ({ ...m, media_type: 'movie' })),
        ...(tv?.results || []).map((s: any) => ({ ...s, media_type: 'tv' })),
        ...(dm?.results || []).map((m: any) => ({ ...m, media_type: 'movie' }))
    ];
    
    const habitProfile = buildHabitProfile(items);
    const historyIds = items.map(i => String(i.externalId));
    
    const surprises = surpriseMeSmart(candidates, habitProfile, historyIds);
    if (surprises.length > 0) {
      // Pick the top surprise
      const winner = surprises[0];
      setSmartSurpriseItem(winner);
      setSelectedItem({ id: winner.id, media_type: winner.media_type || (winner.name ? 'tv' : 'movie') });
      setIsDetailModalOpen(true);
      toast.success("🎲 Surprise Pick Found!", { description: winner.title || winner.name });
    } else {
       toast.error("Couldn't find a good surprise right now. Try again!");
    }
  };

  const getAiRecommendation = async (overrideQuery?: string) => {
    const queryToUse = overrideQuery || aiQuery;
    if (!queryToUse.trim()) {
      toast.error('Please describe what you want to watch.');
      return;
    }

    setIsAiLoading(true);
    setIsAiModalOpen(true);
    setAiRecommendations([]);
    setCurrentAiIndex(0);
    try {
      // 1. Parse the user's query with history for refinement
      const historyString = aiHistory.join(' | ');
      const params = await aiService.parseVibeQuery(queryToUse, historyString);
      
      let candidates: TMDBItem[] = [];
      const isAnimeQuery = params?.media_type === 'anime' || queryToUse.toLowerCase().includes('anime');
      
      if (isAnimeQuery) {
        // Fetch from Jikan for Anime
        const promises = [];
        promises.push(jikanService.getTopAnime(1).then(d => d.results));
        promises.push(jikanService.getSeasonalAnime(1).then(d => d.results));
        if (params?.query) {
          promises.push(jikanService.searchAnime(params.query, 1).then(d => d.results));
        }
        if (params?.with_genres) {
          const genreIds = params.with_genres.split(',').map(id => parseInt(id));
          genreIds.forEach(gid => {
            promises.push(jikanService.getAnimeByGenre(gid, 1).then(d => d.results));
          });
        }

        const resultsArray = await Promise.all(promises);
        candidates = resultsArray.flat();
      } else if (params) {
        // 2. Fetch from TMDb based on parsed params
        const fetchParams: Record<string, string> = {
          sort_by: 'popularity.desc',
          'vote_average.gte': '5',
          'vote_count.gte': '10'
        };
        
        if (params.with_genres) fetchParams.with_genres = params.with_genres;
        if (params.primary_release_year) fetchParams.primary_release_year = params.primary_release_year.toString();
        if (params['primary_release_date.gte']) fetchParams['primary_release_date.gte'] = params['primary_release_date.gte'];
        if (params['primary_release_date.lte']) fetchParams['primary_release_date.lte'] = params['primary_release_date.lte'];
        if (params.with_original_language) fetchParams.with_original_language = params.with_original_language;
        
        const promises: Promise<TMDBItem[]>[] = [];

        // Discover API
        if (params.media_type) {
           promises.push(tmdbService.getDiscover(params.media_type as any, fetchParams).then(d => d.results.map((r: any) => ({ ...r, media_type: params.media_type }))));
        } else {
           promises.push(tmdbService.getDiscover('movie', fetchParams).then(d => d.results.map((r: any) => ({ ...r, media_type: 'movie' }))));
           promises.push(tmdbService.getDiscover('tv', fetchParams).then(d => d.results.map((r: any) => ({ ...r, media_type: 'tv' }))));
        }

        // Search API
        if (params.query) {
           promises.push(tmdbService.searchMulti(params.query).then(d => d.results));
        }

        // Trending API
        if (!params.query) {
           promises.push(tmdbService.getTrendingMovies(1).then(d => d.results.map((r: any) => ({ ...r, media_type: 'movie' }))));
           promises.push(tmdbService.getTrendingSeries(1).then(d => d.results.map((r: any) => ({ ...r, media_type: 'tv' }))));
        }

        const resultsArray = await Promise.all(promises);
        candidates = resultsArray.flat();
        
        // Filter out anime from TMDb results
        candidates = candidates.filter(c => !(c.original_language === 'ja' && c.genre_ids?.includes(16)));
      } else {
        // Fallback if parsing fails
        const searchData = await tmdbService.searchMulti(queryToUse);
        candidates = searchData.results.filter(c => !(c.original_language === 'ja' && c.genre_ids?.includes(16)));
      }

      // 3. Filter out watched/added items
      const filteredCandidates = candidates.filter(c => !items.some(i => i.externalId === c.id));
      
      // Deduplicate by ID
      const seen = new Set();
      const uniqueCandidates = filteredCandidates.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      // Take top 30 for Gemini to semantically rank and explain
      const topCandidates = uniqueCandidates.slice(0, 30);

      if (topCandidates.length === 0) {
        toast.error('Could not find suitable recommendations.');
        setIsAiLoading(false);
        return;
      }

      // 4. Get semantic ranking and explanations from Gemini
      const explanations = await aiService.explainRecommendations(queryToUse, topCandidates, params);
      
      const picks = [];
      
      // Sort explanations by rank ascending
      explanations.sort((a, b) => a.rank - b.rank);

      // We only want top 5 based on AI's semantic ranking
      for (const explanation of explanations) {
        if (picks.length >= 5) break;
        
        const candidate = topCandidates.find(c => String(c.id) === String(explanation.id));
        if (candidate) {
          let providers: any[] = [];
          if (candidate.media_type !== 'anime') {
            const pData = await tmdbService.getWatchProviders(Number(candidate.id), candidate.media_type === 'tv' ? 'tv' : 'movie');
            providers = pData?.US?.flatrate || [];
          }

          picks.push({
            item: candidate,
            rank: explanation.rank,
            badge: explanation.badge,
            reason: explanation.explanation,
            whyNot: explanation.whyNot,
            verdict: explanation.verdict,
            type: candidate.media_type || 'movie',
            providers
          });
        }
      }

      if (picks.length > 0) {
        setAiRecommendations(picks as any);
        setAiHistory(prev => [...prev, queryToUse]);
      } else {
        toast.error('Could not find suitable recommendations.');
      }
    } catch (error) {
      console.error('AI Recommendation error:', error);
      toast.error('Failed to get recommendation.');
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }

    let isActive = true;
    
    // Set loading state immediately
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const [tmdbData, jikanData] = await Promise.all([
          tmdbService.searchMultiDeep(search, 5),
          jikanService.searchAnimeDeep(search, 2)
        ]);
        
        if (isActive) {
          const lowerSearch = search.toLowerCase();
          const localMatches = curatedTamilSeries.filter(t => 
             (t.title && t.title.toLowerCase().includes(lowerSearch)) || 
             (t.overview && t.overview.toLowerCase().includes(lowerSearch)) ||
             (lowerSearch === 'tamil' && t.original_language === 'ta')
          );

          // Interleave results to show a mix of movies/tv and anime
          let combined = [...localMatches]; // prioritize local
          const maxLength = Math.max(tmdbData.results.length, jikanData.results.length);
          for (let i = 0; i < maxLength; i++) {
            if (i < tmdbData.results.length) combined.push(tmdbData.results[i]);
            if (i < jikanData.results.length) combined.push(jikanData.results[i]);
          }
          
          // Deduplicate
          const seenIds = new Set();
          combined = combined.filter(c => {
             if (seenIds.has(c.id)) return false;
             seenIds.add(c.id);
             return true;
          });

          setSearchResults(combined);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }, 500); // 500ms debounce

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    const handleOpenDetailModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSelectedItem(customEvent.detail);
      setIsDetailModalOpen(true);
    };

    window.addEventListener('open-detail-modal', handleOpenDetailModal);
    return () => window.removeEventListener('open-detail-modal', handleOpenDetailModal);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'mediaItems'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mediaItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MediaItem[];
      // Client-side sorting to avoid missing composite index errors
      mediaItems.sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis());
      setItems(mediaItems);
    }, (error) => {
      console.error('Firestore error:', error);
      toast.error('Failed to sync data.');
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'reminders'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedReminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Client-side sorting to avoid missing composite index errors
      sortedReminders.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setReminders(sortedReminders);
    }, (error) => {
      console.error('Reminders error:', error);
    });
    return unsubscribe;
  }, [user]);

  const addToWatchlist = async (tmdbItem: any, type: string = 'movie') => {
    if (!user) {
      toast.error('Please sign in to add to watchlist');
      return;
    }

    if (items.some(i => i.externalId === tmdbItem.id)) {
      toast.error('Already in your list!');
      return;
    }

    try {
      const mediaType: MediaType = type === 'tv' ? 'series' : type as MediaType;
      await addDoc(collection(db, 'mediaItems'), {
        userId: user.uid,
        title: tmdbItem.title || tmdbItem.name || tmdbItem.title_english,
        type: mediaType,
        status: 'plan-to-watch',
        currentEpisode: type === 'movie' ? undefined : 0,
        posterUrl: tmdbItem.poster_path?.startsWith('http') ? tmdbItem.poster_path : tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : undefined,
        externalId: tmdbItem.id,
        source: type === 'anime' ? 'jikan' : 'tmdb',
        language: tmdbItem.original_language || tmdbItem.language || 'en',
        genreIds: tmdbItem.genre_ids || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success(`Added ${tmdbItem.title || tmdbItem.name} to list!`);
      profileService.updateInteraction(tmdbItem, 'like');
    } catch (error) {
      console.error('Add error:', error);
      toast.error('Failed to add item.');
    }
  };

  const removeFromWatchlist = async (externalId: string | number) => {
    if (!user) return;
    const existingItem = items.find(i => i.externalId === externalId);
    if (!existingItem) return;

    try {
      await deleteDoc(doc(db, 'mediaItems', existingItem.id));
      toast.success('Removed from list');
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      toast.error('Failed to remove item');
    }
  };

  const addFromTMDB = async (tmdbItem: TMDBItem) => {
    await addToWatchlist(tmdbItem, tmdbItem.media_type || 'movie');
  };

  const markWatchedFromTMDB = async (tmdbItem: TMDBItem) => {
    if (!user) return;

    // Check if already in list
    const existingItem = items.find(i => i.externalId === tmdbItem.id);
    if (existingItem) {
      if (existingItem.status === 'completed') {
        toast.error('Already marked as watched!');
        return;
      }
      try {
        await updateDoc(doc(db, 'mediaItems', existingItem.id), {
          status: 'completed',
          genreIds: tmdbItem.genre_ids || existingItem.genreIds || [],
          updatedAt: serverTimestamp(),
        });
        toast.success(`Marked ${tmdbItem.title || tmdbItem.name} as watched!`);
        profileService.updateInteraction(tmdbItem, 'like');
      } catch (error) {
        console.error('Update error:', error);
        toast.error('Failed to update item.');
      }
      return;
    }

    try {
      const type: MediaType = tmdbItem.media_type === 'tv' ? 'series' : 'movie';
      await addDoc(collection(db, 'mediaItems'), {
        userId: user.uid,
        title: tmdbItem.title || tmdbItem.name,
        type: type,
        status: 'completed',
        currentEpisode: type === 'movie' ? undefined : 0,
        posterUrl: `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}`,
        externalId: tmdbItem.id,
        source: 'tmdb',
        language: tmdbItem.original_language,
        genreIds: tmdbItem.genre_ids || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success(`Marked ${tmdbItem.title || tmdbItem.name} as watched!`);
      profileService.updateInteraction(tmdbItem, 'like');
    } catch (error) {
      console.error('TMDB Add error:', error);
      toast.error('Failed to mark item as watched.');
    }
  };

  const updateProgress = async (item: MediaItem, increment: boolean) => {
    const newEpisode = (item.currentEpisode || 0) + (increment ? 1 : -1);
    if (newEpisode < 0) return;
    if (item.totalEpisodes && newEpisode > item.totalEpisodes) return;

    // If it reaches the end, trigger the completion flow
    if (item.totalEpisodes && newEpisode === item.totalEpisodes) {
      setRatingItem({ ...item, currentEpisode: newEpisode });
      return;
    }

    try {
      await updateDoc(doc(db, 'mediaItems', item.id), {
        currentEpisode: newEpisode,
        status: 'watching',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const markCompleted = async (item: MediaItem) => {
    setRatingItem(item);
  };

  const onMarkEpisodeWatched = async (item: any, ep: number) => {
    if (!user) return;
    const existing = items.find(i => i.externalId === item.id);
    
    try {
      if (existing) {
        const watched = existing.watchedEpisodes || [];
        const newWatched = watched.includes(ep) 
          ? watched.filter(e => e !== ep)
          : [...watched, ep];
        
        await updateDoc(doc(db, 'mediaItems', existing.id), {
          watchedEpisodes: newWatched,
          lastWatchedAt: serverTimestamp(),
          status: 'watching'
        });
        toast.success(`Episode ${ep} ${watched.includes(ep) ? 'unmarked' : 'marked'} as watched`);
      } else {
        // Add to watchlist first
        const type: MediaType = item.media_type === 'tv' ? 'series' : (item.media_type === 'anime' ? 'anime' : 'movie');
        await addDoc(collection(db, 'mediaItems'), {
          userId: user.uid,
          externalId: item.id,
          type: type,
          title: item.title || item.name,
          posterUrl: item.poster_path ? (item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w500${item.poster_path}`) : undefined,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'watching',
          watchedEpisodes: [ep],
          lastWatchedAt: serverTimestamp(),
          genreIds: item.genre_ids || []
        });
        toast.success(`Added to watching and marked episode ${ep}`);
      }
    } catch (error) {
      console.error('Error marking episode:', error);
      toast.error('Failed to update episode progress');
    }
  };

  const confirmCompletion = async (rating: number) => {
    if (!ratingItem) return;
    try {
      const updates: any = {
        status: 'completed',
        rating: rating,
        updatedAt: serverTimestamp(),
      };
      if (ratingItem.type !== 'movie' && ratingItem.totalEpisodes) {
        updates.currentEpisode = ratingItem.totalEpisodes;
      }
      await updateDoc(doc(db, 'mediaItems', ratingItem.id), updates);
      setRatingItem(null);
      toast.success(`Marked ${ratingItem.title} as completed!`);
    } catch (error) {
      console.error('Complete error:', error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'mediaItems', id));
      toast.success('Removed from list.');
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const ratedItems = items.filter(i => i.status === 'completed' && i.rating && i.rating > 0);
  const avgRating = ratedItems.length > 0 
    ? (ratedItems.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedItems.length).toFixed(1)
    : '0.0';

  const stats = {
    total: items.length,
    watching: items.filter(i => i.status === 'watching').length,
    completed: items.filter(i => i.status === 'completed').length,
    avgRating: avgRating,
    xp: (items.filter(i => i.status === 'completed').length * 100) + 
        (items.filter(i => i.rating && i.rating > 0).length * 50) + 
        (items.filter(i => i.status === 'watching').length * 20),
  };

  const level = Math.floor(stats.xp / 500) + 1;
  const nextLevelXp = level * 500;
  const levelProgress = (stats.xp % 500) / 500 * 100;

  return (
    <WatchlistContext.Provider value={{ watchlistItems: items, addToWatchlist, removeFromWatchlist }}>
      <BackdropContext.Provider value={{ setHoveredBackdrop }}>
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-amber-500/30 pb-20 md:pb-0">
        {/* Dynamic Hero Backdrop */}
        <AnimatePresence>
          {hoveredBackdrop && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-0 pointer-events-none"
            >
              <div 
                className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-110"
                style={{ 
                  backgroundImage: `url(${hoveredBackdrop})`,
                  filter: 'blur(60px) brightness(0.3) saturate(1.2)'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#0a0a0a]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Film className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
              CineAI
            </h1>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            {[
              { id: 'home', label: 'Assistant', icon: Sparkles },
              { id: 'explore', label: 'Explore', icon: Compass },
              { id: 'watchlist', label: 'Watchlist', icon: Clock },
              { id: 'history', label: 'History', icon: History },
              { id: 'stats', label: 'Insights', icon: LayoutDashboard },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-105' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-primary transition-all"
              onClick={() => {
                smartRefreshManager.clearCache();
                window.location.reload();
              }}
              title="Refresh All Content"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            <div className="hidden md:flex items-center gap-4 pl-6 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-white leading-none mb-1">{user?.displayName}</p>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Level {level} Cinephile</p>
                  <Progress value={levelProgress} className="w-24 h-1.5 bg-zinc-900 progress-gradient" />
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={logout} 
                className="w-10 h-10 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <nav className="fixed bottom-6 left-4 right-4 z-50 md:hidden bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl flex items-center justify-around p-3 shadow-2xl shadow-black/50">
        {[
          { id: 'home', icon: Sparkles },
          { id: 'explore', icon: Compass },
          { id: 'watchlist', icon: Clock },
          { id: 'history', icon: History },
          { id: 'stats', icon: LayoutDashboard },
          { id: 'settings', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`p-3.5 rounded-2xl transition-all duration-300 ${
              activeTab === tab.id 
                ? 'text-primary bg-primary/10 shadow-lg shadow-primary/5 scale-110' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-6 h-6" />
          </button>
        ))}
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4 py-8">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
                  Hello, {user?.displayName?.split(' ')[0]}
                </h2>
                <p className="text-zinc-500 text-lg">What's the vibe for today's cinematic journey?</p>
              </div>

              <div className="flex flex-col items-center gap-16">
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse group-hover:bg-primary/30 transition-all duration-700" />
                  <Button 
                    onClick={() => setIsAiModalOpen(true)}
                    className="w-80 h-80 rounded-full bg-gradient-to-br from-primary via-amber-500 to-amber-600 hover:from-amber-400 hover:to-primary text-primary-foreground shadow-2xl group relative overflow-hidden transition-all duration-700 hover:scale-105 active:scale-95 border-[12px] border-white/5"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-1000 ease-out" />
                    <div className="relative z-10 flex flex-col items-center gap-6">
                      <div className="p-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 group-hover:scale-110 transition-transform duration-700 shadow-inner">
                        <Sparkles className="w-24 h-24 animate-pulse text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                      </div>
                      <span className="text-2xl font-black uppercase tracking-[0.3em] drop-shadow-md">Help Me Decide</span>
                    </div>
                  </Button>
                </div>

                <DiscoveryMode onSelect={(item) => {
                  setSelectedItem(item);
                  setIsDetailModalOpen(true);
                }} />

                <div className="w-full max-w-2xl space-y-6">
                  <div className="relative group">
                    {isSearching ? (
                      <Loader2 className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-primary animate-spin" />
                    ) : (
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-500 group-focus-within:text-primary transition-colors" />
                    )}
                    <Input 
                      placeholder="Or search for something specific..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-14 h-16 bg-zinc-900/40 border-white/10 focus:border-primary/50 focus:ring-primary/20 rounded-3xl text-xl font-bold transition-all backdrop-blur-md"
                    />
                    <AnimatePresence>
                      {(searchResults.length > 0 || (!isSearching && search.trim() && searchResults.length === 0)) && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full left-0 right-0 mt-6 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] z-50 overflow-hidden"
                        >
                          <ScrollArea className="h-[450px]">
                            <div className="p-4 space-y-3">
                              {searchResults.length > 0 ? (
                                searchResults.map((result) => (
                                  <div 
                                    key={result.id}
                                    className="flex items-center gap-5 p-4 hover:bg-white/5 rounded-2xl group transition-all cursor-pointer border border-transparent hover:border-white/10"
                                    onClick={() => {
                                      setSelectedItem(result);
                                      setIsDetailModalOpen(true);
                                    }}
                                  >
                                    <div className="w-16 h-24 bg-zinc-800 rounded-xl overflow-hidden shrink-0 shadow-2xl border border-white/5">
                                      {result.poster_path ? (
                                        <img 
                                          src={`https://image.tmdb.org/t/p/w92${result.poster_path}`} 
                                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                          referrerPolicy="no-referrer"
                                          alt={result.title || result.name}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Film className="w-6 h-6 text-zinc-700" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-lg font-black truncate tracking-tight mb-1">{result.title || result.name}</p>
                                      <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="text-[10px] uppercase border-white/10 text-zinc-400 font-black tracking-widest px-2 py-0.5">
                                          {result.media_type}
                                        </Badge>
                                        <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                                          <Star className="w-3 h-3 fill-primary text-primary" />
                                          <span className="text-[11px] text-primary font-black">{result.vote_average.toFixed(1)}</span>
                                        </div>
                                        <span className="text-[11px] text-zinc-500 font-black">
                                          {(result.release_date || result.first_air_date)?.split('-')[0]}
                                        </span>
                                      </div>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      className="bg-white text-black hover:bg-zinc-200 font-black h-10 px-5 rounded-xl shadow-lg transition-all active:scale-95"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addFromTMDB(result);
                                      }}
                                    >
                                      Add
                                    </Button>
                                  </div>
                                ))
                              ) : (
                                <div className="p-8 text-center text-zinc-500 font-medium">
                                  No results found for "{search}"
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="space-y-12 pt-12">
                {/* Continue Watching Section */}
                {items.filter(i => i.status === 'watching').length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                      <PlayCircle className="w-6 h-6 text-primary" />
                      Continue Watching
                    </h3>
                    <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x">
                      {items.filter(i => i.status === 'watching').map((item) => (
                        <div key={item.id} className="min-w-[280px] group relative cursor-pointer" onClick={() => {
                          setSelectedItem({ ...item, id: item.externalId });
                          setIsDetailModalOpen(true);
                        }}>
                          <div className="aspect-video rounded-3xl overflow-hidden border border-white/10 relative">
                            <img src={item.posterUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" alt={item.title} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-4 left-4 right-4 space-y-2">
                              <p className="text-sm font-black text-white truncate">{item.title}</p>
                              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary" 
                                  style={{ width: `${(item.watchedEpisodes?.length || 0) / (item.totalEpisodes || 12) * 100}%` }} 
                                />
                              </div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-2xl">
                                <Play className="w-6 h-6 text-primary-foreground ml-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* --- SMART ENGINE: Best Pick Right Now --- */}
                {bestPick && (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-emerald-500" />
                      Best Pick Right Now
                    </h3>
                    <div 
                      className="relative w-full aspect-video md:aspect-[21/9] rounded-[2.5rem] overflow-hidden cursor-pointer group shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/10"
                      onClick={() => {
                        setSelectedItem(bestPick);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <img 
                        src={`https://image.tmdb.org/t/p/original${bestPick.backdrop_path || bestPick.poster_path}`}
                        alt={bestPick.title || bestPick.name}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                      
                      <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full md:w-2/3 space-y-6">
                        <Badge className="bg-emerald-500 text-black font-black uppercase tracking-widest hover:bg-emerald-400">
                          99% Match
                        </Badge>
                        <h4 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
                          {bestPick.title || bestPick.name}
                        </h4>
                        
                        <div className="flex flex-col gap-2">
                          {generateReason(bestPick, buildHabitProfile(items), currentSlotLabel).map((reason: string, idx: number) => (
                             <span key={idx} className="flex items-center gap-2 text-sm text-zinc-300 font-bold">
                               <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                               {reason}
                             </span>
                          ))}
                        </div>
                        
                        <Button className="bg-white text-black hover:bg-zinc-200 font-black h-14 px-8 rounded-2xl shadow-2xl transition-all hover:scale-105">
                          <Play className="w-5 h-5 mr-3" />
                          Play Now
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- SMART ENGINE: Contextual Time Picks --- */}
                {contextPicks.length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                      <Clock className="w-6 h-6 text-primary" />
                      {currentSlotLabel}
                    </h3>
                    <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x px-4 -mx-4 md:px-0 md:mx-0">
                      {contextPicks.map((item, index) => (
                        <div key={item.id} className="min-w-[160px] md:min-w-[200px] snap-start">
                          <MediaCard 
                            item={item} 
                            type={item.media_type || (item.name ? 'tv' : 'movie')} 
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDetailModalOpen(true);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* For You Section (Fallback/Global) */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-primary" />
                      Explore More
                    </h3>
                    <div className="flex gap-4">
                      <Button variant="outline" className="border-primary/50 text-white font-bold bg-primary/10 hover:bg-primary/20" onClick={handleSmartSurprise}>
                        <Dice5 className="w-4 h-4 mr-2" /> Surprise Me
                      </Button>
                      <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white font-bold" onClick={() => fetchInitialFeed(true)}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {isFeedLoading ? (
                      [...Array(3)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-3xl animate-pulse border border-white/5" />
                      ))
                    ) : (
                      forYouFeed.map((item, index) => (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="group relative"
                        >
                          <div className="absolute -top-4 -left-4 z-20 w-12 h-12 bg-gradient-to-br from-primary to-amber-600 rounded-2xl flex items-center justify-center font-black text-primary-foreground shadow-2xl shadow-primary/20 border-4 border-zinc-950 rotate-[-10deg] group-hover:rotate-0 transition-transform duration-500">
                            #{index + 1}
                          </div>
                          <MediaCard 
                            item={item}
                            type={item.media_type}
                            onClick={() => {
                              profileService.updateInteraction(item, 'click');
                              setSelectedItem(item);
                              setIsDetailModalOpen(true);
                            }}
                          />
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                {/* Top 10 This Month */}
                <GenreRow 
                  title="🔥 Top 10 This Month" 
                  type="movie" 
                  language="all" 
                  onItemClick={(item) => {
                    setSelectedItem(item);
                    setIsDetailModalOpen(true);
                  }} 
                />

                {/* Trending Now */}
                <GenreRow 
                  title="📈 Trending Now" 
                  type="tv" 
                  language="all" 
                  onItemClick={(item) => {
                    setSelectedItem(item);
                    setIsDetailModalOpen(true);
                  }} 
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'explore' && (
            <motion.div
              key="explore"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <ExploreView 
                onItemClick={(item) => {
                  setSelectedItem(item);
                  setIsDetailModalOpen(true);
                }} 
              />
            </motion.div>
          )}

          {activeTab === 'watchlist' && (
            <motion.div
              key="watchlist"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                <div className="space-y-1">
                  <h2 className="text-4xl font-black tracking-tighter">Your Watchlist</h2>
                  <p className="text-zinc-500 text-sm font-medium">Items you're currently tracking</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={watchlistFilterStatus} onValueChange={(val: any) => setWatchlistFilterStatus(val)}>
                    <SelectTrigger className="w-[160px] bg-zinc-900/40 border-white/10 rounded-xl focus:ring-primary/20">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="plan-to-watch">Plan to Watch</SelectItem>
                      <SelectItem value="watching">Watching</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={watchlistFilterType} onValueChange={(val: any) => setWatchlistFilterType(val)}>
                    <SelectTrigger className="w-[160px] bg-zinc-900/40 border-white/10 rounded-xl focus:ring-primary/20">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="movie">Movies</SelectItem>
                      <SelectItem value="series">Series</SelectItem>
                      <SelectItem value="anime">Anime</SelectItem>
                    </SelectContent>
                  </Select>

                  <Badge className="bg-primary text-primary-foreground font-black px-4 py-2 rounded-xl shadow-lg shadow-primary/20 ml-auto">
                    {items.filter(i => (watchlistFilterStatus === 'all' || i.status === watchlistFilterStatus || (watchlistFilterStatus === 'plan-to-watch' && i.status === 'plan_to_watch')) && (watchlistFilterType === 'all' || i.type === watchlistFilterType)).length} ITEMS
                  </Badge>
                </div>
              </div>

              <div className="grid gap-6">
                {items.filter(i => (watchlistFilterStatus === 'all' || i.status === watchlistFilterStatus || (watchlistFilterStatus === 'plan-to-watch' && i.status === 'plan_to_watch')) && (watchlistFilterType === 'all' || i.type === watchlistFilterType)).length > 0 ? (
                  items.filter(i => (watchlistFilterStatus === 'all' || i.status === watchlistFilterStatus || (watchlistFilterStatus === 'plan-to-watch' && i.status === 'plan_to_watch')) && (watchlistFilterType === 'all' || i.type === watchlistFilterType)).map((item) => (
                    <Card 
                      key={item.id} 
                      className="bg-zinc-900/40 border-white/10 backdrop-blur-md hover:border-primary/30 transition-all group overflow-hidden rounded-[2rem] shadow-2xl"
                    >
                      <CardContent className="p-6 flex items-center gap-8">
                        <div 
                          className="w-24 h-36 rounded-2xl overflow-hidden shrink-0 bg-zinc-800 cursor-pointer shadow-2xl relative group/poster"
                          onClick={() => {
                            setSelectedItem({ id: item.externalId, media_type: item.type === 'series' ? 'tv' : 'movie' });
                            setIsDetailModalOpen(true);
                          }}
                        >
                          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/poster:opacity-100 transition-opacity z-10 flex items-center justify-center">
                            <PlayCircle className="w-10 h-10 text-white" />
                          </div>
                          {item.posterUrl ? (
                            <img 
                              src={item.posterUrl} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                              referrerPolicy="no-referrer" 
                              alt={item.title} 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Film className="w-10 h-10 text-zinc-700" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-4">
                          <div className="flex items-center gap-3">
                            <h3 className="font-black text-2xl truncate tracking-tighter">{item.title}</h3>
                            <Badge variant="outline" className="text-[10px] uppercase border-white/10 text-zinc-500 font-black tracking-widest px-2 py-0.5">
                              {item.type}
                            </Badge>
                          </div>
                          <div className="space-y-4">
                            <div className="flex items-center gap-6 text-xs font-black uppercase tracking-widest">
                              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                                item.status === 'watching' 
                                  ? 'bg-primary/10 text-primary border-primary/20' 
                                  : item.status === 'completed'
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : 'bg-white/5 text-zinc-400 border-white/5'
                              }`}>
                                {item.status === 'watching' ? <PlayCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                {item.status.replace(/-/g, ' ')}
                              </span>
                              {item.type !== 'movie' && (
                                <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl border border-primary/20">
                                  Episode {item.currentEpisode} / {item.totalEpisodes || '?'}
                                </span>
                              )}
                            </div>
                            {item.type !== 'movie' && item.totalEpisodes && (
                              <div className="space-y-2">
                                <Progress 
                                  value={(item.currentEpisode || 0) / item.totalEpisodes * 100} 
                                  className="h-2 bg-zinc-900 progress-gradient" 
                                />
                                <div className="flex justify-end">
                                  <span className="text-[10px] text-primary font-black tracking-widest">{Math.round(((item.currentEpisode || 0) / item.totalEpisodes) * 100)}% COMPLETE</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.type !== 'movie' && (
                            <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/10" onClick={() => updateProgress(item, false)}><MinusCircle className="w-5 h-5" /></Button>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/10 text-primary" onClick={() => updateProgress(item, true)}><PlusCircle className="w-5 h-5" /></Button>
                            </div>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => markCompleted(item)}
                            className="text-emerald-500 hover:bg-emerald-500/10 h-12 w-12 rounded-2xl border border-transparent hover:border-emerald-500/20"
                          >
                            <CheckCircle2 className="w-6 h-6" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteItem(item.id)}
                            className="text-zinc-600 hover:text-red-400 h-12 w-12 rounded-2xl border border-transparent hover:border-red-400/20"
                          >
                            <Trash2 className="w-6 h-6" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="py-32 text-center space-y-6">
                    <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mx-auto border border-white/5">
                      <Clock className="w-10 h-10 text-zinc-700" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-black text-zinc-400">Your watchlist is empty</p>
                      <p className="text-zinc-600 text-sm max-w-xs mx-auto">Let the AI assistant help you find your next cinematic journey!</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reminders Section */}
              <div className="pt-12 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tighter flex items-center gap-3">
                      <Bell className="w-6 h-6 text-amber-500" />
                      Release Reminders
                    </h2>
                    <p className="text-zinc-500 text-sm font-medium">Get notified when these items are released</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reminders.length > 0 ? (
                    reminders.map((reminder) => (
                      <Card 
                        key={reminder.id} 
                        className="bg-zinc-900/40 border-white/10 backdrop-blur-md hover:border-amber-500/30 transition-all group overflow-hidden rounded-[2rem] shadow-2xl"
                      >
                        <CardContent className="p-5 flex items-center gap-6">
                          <div className="w-16 h-24 rounded-xl overflow-hidden shrink-0 bg-zinc-800 shadow-xl">
                            {reminder.posterUrl ? (
                              <img 
                                src={reminder.posterUrl.startsWith('http') ? reminder.posterUrl : `https://image.tmdb.org/t/p/w185${reminder.posterUrl}`} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer" 
                                alt={reminder.title} 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Film className="w-6 h-6 text-zinc-700" /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <h3 className="font-black text-lg truncate tracking-tight">{reminder.title}</h3>
                            <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                              <Calendar className="w-3 h-3" />
                              Releases: {reminder.releaseDate || 'TBA'}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-10 h-10 rounded-xl hover:bg-red-400/10 hover:text-red-400 text-zinc-600 transition-all"
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'reminders', reminder.id));
                                toast.success('Reminder removed');
                              } catch (error) {
                                console.error('Delete reminder error:', error);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center space-y-4 bg-zinc-900/20 rounded-[2rem] border border-white/5">
                      <p className="text-zinc-600 text-sm font-medium">No active reminders</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h2 className="text-4xl font-black tracking-tighter">Watch History</h2>
                  <p className="text-zinc-500 text-sm font-medium">Your completed cinematic journeys</p>
                </div>
                <Badge className="bg-emerald-500 text-black font-black px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20">
                  {items.filter(i => i.status === 'completed').length} WATCHED
                </Badge>
              </div>

              <div className="grid gap-8">
                {items.filter(i => i.status === 'completed').length > 0 ? (
                  items.filter(i => i.status === 'completed').map((item) => (
                    <Card 
                      key={item.id} 
                      className="bg-zinc-900/40 border-white/10 backdrop-blur-md overflow-hidden rounded-[2.5rem] shadow-2xl group"
                    >
                      <CardContent className="p-8 flex gap-8">
                        <div 
                          className="w-32 h-48 rounded-2xl overflow-hidden shrink-0 shadow-2xl cursor-pointer relative group/poster"
                          onClick={() => {
                            setSelectedItem({ id: item.externalId, media_type: item.type === 'series' ? 'tv' : 'movie' });
                            setIsDetailModalOpen(true);
                          }}
                        >
                          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/poster:opacity-100 transition-opacity z-10 flex items-center justify-center">
                            <Info className="w-10 h-10 text-white" />
                          </div>
                          {item.posterUrl ? (
                            <img src={item.posterUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" alt={item.title} />
                          ) : (
                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Film className="w-12 h-12 text-zinc-700" /></div>
                          )}
                        </div>
                        <div className="flex-1 space-y-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="text-3xl font-black tracking-tighter leading-none">{item.title}</h3>
                              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mt-3">
                                {item.type} • COMPLETED 
                                {item.type !== 'movie' && ` • ${item.totalEpisodes} EPISODES`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20 shadow-lg shadow-primary/5">
                              <Star className="w-5 h-5 fill-primary text-primary" />
                              <span className="text-lg font-black text-primary">{item.rating}/5</span>
                            </div>
                          </div>
                          {item.notes && (
                            <div className="bg-white/5 p-5 rounded-3xl border border-white/5 italic text-zinc-400 text-sm leading-relaxed relative">
                              <div className="absolute -top-3 -left-1 text-4xl text-white/5 font-serif">"</div>
                              {item.notes}
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2 text-[10px] text-zinc-600 uppercase font-black tracking-widest">
                              <Clock className="w-3 h-3" />
                              Watched on {item.updatedAt?.toDate().toLocaleDateString()}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-zinc-600 hover:text-red-400 h-10 px-4 rounded-xl hover:bg-red-400/10 transition-all font-black uppercase text-[10px] tracking-widest" 
                              onClick={() => deleteItem(item.id)}
                            >
                              Remove from history
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="py-32 text-center space-y-6">
                    <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mx-auto border border-white/5">
                      <History className="w-10 h-10 text-zinc-700" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-black text-zinc-400">No watch history yet</p>
                      <p className="text-zinc-600 text-sm max-w-xs mx-auto">Start your cinematic journey and track your progress here!</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <div className="space-y-1">
                <h2 className="text-4xl font-black tracking-tighter">Settings</h2>
                <p className="text-zinc-500 text-sm font-medium">Personalize your cinematic experience</p>
              </div>
              
              <Card className="bg-zinc-900/40 border-white/10 backdrop-blur-md overflow-hidden rounded-[2.5rem] shadow-2xl">
                <CardContent className="p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                      <Palette className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">Visual Theme</h3>
                      <p className="text-sm text-zinc-500 font-medium">Choose a style that matches your vibe</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    {[
                      { id: 'default', label: 'Cinematic Dark', icon: '🎬', color: 'bg-[#0B0B0F]' },
                      { id: 'cyber', label: 'Neon Cyber', icon: '🌌', color: 'bg-[#050505]' },
                      { id: 'minimal', label: 'Minimal Clean', icon: '🌿', color: 'bg-[#F8F9FA]' },
                      { id: 'amoled', label: 'AMOLED Black', icon: '🖤', color: 'bg-[#000000]' },
                      { id: 'custom', label: 'Custom Theme', icon: '🎨', color: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id as any)}
                        className={`relative group p-6 rounded-3xl border-2 transition-all text-left ${
                          theme === t.id 
                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5 scale-[1.02]' 
                            : 'border-white/5 hover:border-white/20 bg-white/5'
                        }`}
                      >
                        <div className="flex flex-col gap-4">
                          <span className="text-3xl drop-shadow-lg">{t.icon}</span>
                          <div>
                            <p className="text-sm font-black tracking-tight">{t.label}</p>
                            <div className={`w-full h-1.5 mt-3 rounded-full ${t.color} border border-white/10`} />
                          </div>
                        </div>
                        {theme === t.id && (
                          <div className="absolute top-3 right-3">
                            <div className="bg-primary p-1 rounded-full shadow-lg">
                              <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {theme === 'custom' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-6 p-6 bg-white/5 rounded-3xl border border-white/10 space-y-6"
                    >
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Customize Colors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Background</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={customThemeColors.background}
                              onChange={(e) => handleCustomColorChange('background', e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-sm font-mono text-zinc-300">{customThemeColors.background}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Primary Accent</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={customThemeColors.primary}
                              onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-sm font-mono text-zinc-300">{customThemeColors.primary}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Text (Foreground)</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={customThemeColors.foreground}
                              onChange={(e) => handleCustomColorChange('foreground', e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-sm font-mono text-zinc-300">{customThemeColors.foreground}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Card Background</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={customThemeColors.card}
                              onChange={(e) => handleCustomColorChange('card', e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-sm font-mono text-zinc-300">{customThemeColors.card}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/40 border-white/10 backdrop-blur-md overflow-hidden rounded-[2.5rem] shadow-2xl">
                <CardContent className="p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                      <LogOut className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">Account</h3>
                      <p className="text-sm text-zinc-500 font-medium">Manage your profile and session</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center font-black text-xl text-primary-foreground shadow-xl">
                        {user?.displayName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-lg tracking-tight">{user?.displayName}</p>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">{user?.email}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={logout} 
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 font-black uppercase text-xs tracking-[0.2em] h-12 px-6 rounded-2xl border border-transparent hover:border-red-500/20"
                    >
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-4xl font-black tracking-tighter">Your Insights</h2>
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Live Data</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-zinc-900/40 border-white/10 backdrop-blur-md p-8 rounded-3xl shadow-2xl">
                  <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6">Taste Profile</h3>
                  <div className="space-y-6">
                    {Object.entries(
                      items.reduce((acc, item) => {
                        if (item.genreIds) {
                          item.genreIds.forEach(id => {
                            acc[id] = (acc[id] || 0) + (item.rating || 3);
                          });
                        }
                        return acc;
                      }, {} as Record<number, number>)
                    )
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 5)
                    .map(([genreId, score], index) => {
                      // Basic mapping, ideally we'd fetch actual names from TMDb
                      const genreNames: Record<number, string> = {
                        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
                      };
                      const name = genreNames[parseInt(genreId)] || 'Unknown';
                      const genreScores = Object.values(
                        items.reduce((acc, item) => {
                          if (item.genreIds) {
                            item.genreIds.forEach(id => {
                              acc[id] = (acc[id] || 0) + (item.rating || 3);
                            });
                          }
                          return acc;
                        }, {} as Record<number, number>)
                      );
                      const maxScore = Math.max(...(genreScores as number[]));
                      
                      return (
                        <div key={genreId} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="font-black text-sm text-zinc-300">#{index + 1} {name}</span>
                            </div>
                            <span className="font-black text-xs text-primary">Affinity</span>
                          </div>
                          <Progress value={((score as number) / maxScore) * 100} className="h-2 bg-zinc-900" />
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <p className="text-zinc-500 text-sm italic">Rate some items to build your taste profile.</p>
                    )}
                  </div>
                </Card>

                <Card className="bg-gradient-to-br from-primary/20 to-amber-600/20 border-primary/20 backdrop-blur-md p-8 rounded-3xl flex flex-col items-center justify-center text-center space-y-6 shadow-2xl shadow-primary/10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner relative z-10">
                    <Star className="w-12 h-12 text-primary fill-primary drop-shadow-lg" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-6xl font-black tracking-tighter text-white">{avgRating}</p>
                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mt-2">Average Rating</p>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total XP', value: stats.xp, icon: Sparkles, color: 'text-primary', bg: 'bg-primary/10' },
                  { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { label: 'Watching', value: stats.watching, icon: PlayCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { label: 'Plan to Watch', value: items.filter(i => i.status === 'plan-to-watch').length, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                ].map((stat, i) => (
                  <Card key={i} className="bg-zinc-900/40 border-white/10 backdrop-blur-md p-6 rounded-3xl space-y-4 hover:border-white/20 transition-all duration-300 group">
                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-3xl font-black tracking-tighter">{stat.value}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Recommendation Modal */}
        <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
          <DialogContent className="bg-zinc-950 border-white/10 text-white sm:max-w-lg overflow-hidden p-0">
            {isAiLoading ? (
              <div className="p-16 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                  <div className="p-8 rounded-full bg-white/5 border border-white/10 backdrop-blur-md relative z-10">
                    <Sparkles className="w-16 h-16 text-primary animate-bounce" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tighter">Consulting the AI Oracle...</h2>
                  <p className="text-zinc-500 text-sm max-w-xs mx-auto font-medium">Analyzing your request to find your perfect match.</p>
                </div>
              </div>
            ) : aiRecommendations.length > 0 ? (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent z-10" />
                <img 
                  src={`https://image.tmdb.org/t/p/original${aiRecommendations[currentAiIndex].item.poster_path}`}
                  className="w-full aspect-[16/10] object-cover opacity-60"
                  referrerPolicy="no-referrer"
                  alt="Recommendation"
                />
                
                <div className="relative z-20 p-10 -mt-32">
                  <div className="flex items-center gap-3 mb-6">
                    <Badge className="bg-primary text-primary-foreground font-black px-4 py-2 rounded-xl shadow-lg shadow-primary/20 text-lg">
                      #{aiRecommendations[currentAiIndex].rank} {aiRecommendations[currentAiIndex].badge}
                    </Badge>
                    <Badge variant="outline" className={`border-white/20 px-3 py-1.5 rounded-lg font-bold ${
                      aiRecommendations[currentAiIndex].verdict === 'Must Watch' ? 'bg-green-500/20 text-green-400' :
                      aiRecommendations[currentAiIndex].verdict === 'Worth Watching' ? 'bg-blue-500/20 text-blue-400' :
                      aiRecommendations[currentAiIndex].verdict === 'Depends on Taste' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {aiRecommendations[currentAiIndex].verdict === 'Must Watch' ? '🔥 ' :
                       aiRecommendations[currentAiIndex].verdict === 'Worth Watching' ? '👍 ' :
                       aiRecommendations[currentAiIndex].verdict === 'Depends on Taste' ? '🤔 ' : '❌ '}
                      {aiRecommendations[currentAiIndex].verdict}
                    </Badge>
                    <Badge variant="outline" className="border-white/20 text-white bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-lg font-bold ml-auto">
                      {currentAiIndex + 1} OF {aiRecommendations.length}
                    </Badge>
                  </div>
                  
                  <h2 
                    className="text-5xl font-black tracking-tighter mb-4 cursor-pointer hover:text-primary transition-all duration-300 leading-none"
                    onClick={() => {
                      setSelectedItem(aiRecommendations[currentAiIndex].item);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    {aiRecommendations[currentAiIndex].item.title || aiRecommendations[currentAiIndex].item.name}
                  </h2>
                  
                  <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20 mb-4 backdrop-blur-md">
                    <p className="text-primary font-black flex items-start gap-3 text-lg leading-tight">
                      <Sparkles className="w-6 h-6 shrink-0 mt-0.5" />
                      {aiRecommendations[currentAiIndex].reason}
                    </p>
                  </div>
                  
                  {aiRecommendations[currentAiIndex].whyNot && (
                    <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 mb-6 backdrop-blur-md">
                      <p className="text-red-400 font-bold flex items-start gap-3 text-sm leading-tight">
                        <span className="text-xl leading-none mt-0.5">⚠️</span>
                        {aiRecommendations[currentAiIndex].whyNot}
                      </p>
                    </div>
                  )}

                  {aiRecommendations[currentAiIndex].providers && aiRecommendations[currentAiIndex].providers.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-3">Available On</p>
                      <div className="flex gap-3">
                        {aiRecommendations[currentAiIndex].providers.slice(0, 5).map((p: any) => (
                          <div key={p.provider_id} className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-lg group relative" title={p.provider_name}>
                            <img src={`https://image.tmdb.org/t/p/original${p.logo_path}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={p.provider_name} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mb-6">
                    <Button 
                      className="flex-1 bg-gradient-to-r from-primary to-amber-600 hover:from-amber-400 hover:to-primary text-primary-foreground font-black h-14 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                      onClick={() => {
                        addFromTMDB({ ...aiRecommendations[currentAiIndex].item, media_type: aiRecommendations[currentAiIndex].type });
                        setIsAiModalOpen(false);
                      }}
                    >
                      <Plus className="w-6 h-6 mr-2" /> Add to Watchlist
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-14 px-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                      onClick={() => {
                        profileService.updateInteraction(aiRecommendations[currentAiIndex].item, 'skip');
                        if (currentAiIndex < aiRecommendations.length - 1) {
                          setCurrentAiIndex(prev => prev + 1);
                        } else {
                          getAiRecommendation(); // Fetch new ones if we run out
                        }
                      }}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </div>
                  
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Not quite right? Refine search:</p>
                    <div className="flex gap-2">
                      <Input 
                        value={aiFeedback}
                        onChange={(e) => setAiFeedback(e.target.value)}
                        placeholder="e.g., 'more action', 'less romance', 'darker'..."
                        className="h-12 bg-white/5 border-white/10 rounded-xl font-bold focus-visible:ring-primary"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && aiFeedback.trim()) {
                            getAiRecommendation(aiFeedback);
                            setAiFeedback('');
                          }
                        }}
                      />
                      <Button 
                        className="h-12 px-6 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 font-black"
                        onClick={() => {
                          if (aiFeedback.trim()) {
                            getAiRecommendation(aiFeedback);
                            setAiFeedback('');
                          }
                        }}
                      >
                        Refine
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black tracking-tighter">What's the vibe?</h2>
                  <p className="text-zinc-500 font-medium">Describe what you want to watch...</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <textarea 
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      placeholder="e.g., Dark emotional anime under 30 mins, Exciting action movie like John Wick..."
                      className="w-full h-32 bg-zinc-900/50 border border-white/10 focus:border-primary/50 focus:ring-primary/20 rounded-2xl p-4 text-lg font-medium text-white resize-none transition-all placeholder:text-zinc-600"
                    />
                  </div>

                  <Button 
                    className="w-full bg-gradient-to-r from-primary to-amber-600 hover:from-amber-400 hover:to-primary text-primary-foreground font-black h-16 rounded-2xl shadow-2xl shadow-primary/20 text-xl mt-4 transition-all hover:scale-[1.02] active:scale-95"
                    onClick={getAiRecommendation}
                    disabled={!aiQuery.trim() || isAiLoading}
                  >
                    <Sparkles className="w-6 h-6 mr-2" /> Find My Match
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>

      {/* Completion Rating Dialog */}
      <Dialog open={!!ratingItem} onOpenChange={(open) => !open && setRatingItem(null)}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Rate your experience</DialogTitle>
            <DialogDescription className="text-zinc-500">
              How would you rate "{ratingItem?.title}"?
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <StarRating 
                rating={newRating} 
                onRatingChange={setNewRating} 
                max={5} 
              />
              <p className="text-sm text-zinc-400">
                {newRating === 0 ? 'Select a rating' : `${newRating}/5 stars`}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Review / Notes (Optional)</label>
              <textarea 
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="What did you think?"
                className="w-full bg-zinc-800 border border-white/5 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => confirmCompletion(newRating)} 
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
            >
              Complete & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetailModal 
        item={selectedItem} 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)}
        onAdd={addFromTMDB}
        onMarkWatched={markWatchedFromTMDB}
        watchedEpisodes={items.find(i => i.externalId === selectedItem?.id)?.watchedEpisodes || []}
        onMarkEpisodeWatched={onMarkEpisodeWatched}
      />

      <Toaster theme="dark" position="bottom-right" />
    </div>
    </BackdropContext.Provider>
    </WatchlistContext.Provider>
  );
}

// --- Landing Page ---

function LandingPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] -z-10" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl"
      >
        <div className="w-20 h-20 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-amber-500/20">
          <Film className="w-10 h-10 text-black" />
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
          Your Media Journey, <br /> Perfectly Tracked.
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl mb-10 leading-relaxed">
          The ultimate checklist for your movies, series, and anime. 
          Track progress, rate your favorites, and never lose your place again.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            onClick={login} 
            size="lg" 
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-14 px-8 text-lg rounded-xl transition-all hover:scale-105 active:scale-95"
          >
            Get Started with Google
          </Button>
          <div className="flex items-center -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center overflow-hidden">
                <img src={`https://picsum.photos/seed/user${i}/40/40`} referrerPolicy="no-referrer" alt="User" />
              </div>
            ))}
            <span className="ml-4 text-zinc-500 text-sm font-medium">+10k users tracking</span>
          </div>
        </div>
      </motion.div>

      {/* Floating Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.3, 0.1], y: [0, -20, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
            className="absolute"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          >
            {i % 2 === 0 ? <Film className="w-12 h-12 text-zinc-800" /> : <Tv className="w-12 h-12 text-zinc-800" />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- App Root ---

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return user ? <MediaTracker /> : <LandingPage />;
}
