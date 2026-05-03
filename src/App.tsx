/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, ReactNode, useRef, useMemo, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  type User as FirebaseUser
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
  ChevronUp,
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
  Quote,
  MonitorPlay,
  User,
  Minus,
  MessageSquare,
  TrendingDown,
  ThumbsUp,
  ThumbsDown,
  Send,
  Check,
  Sun,
  Moon
} from 'lucide-react';
import { tmdbService, type TMDBItem } from './services/tmdbService';
import { ActorModal } from './components/ActorModal';
import { jikanService } from './services/jikanService';
import { omdbService, type OMDbRatings } from './services/omdbService';
import { getFinalRating, getRatingBadge } from './services/ratingService';
import { aiService, type AIVerdict } from './services/aiService';
import { MoodGraph } from './components/MoodGraph';
import { CompareModal } from './components/CompareModal';
import { profileService, UserProfile } from './services/profileService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, TooltipProps } from 'recharts';
import { cleanQuery, scoreItem, explain } from './services/discoveryEngine';
import { buildHabitProfile, getContextAwareRecommendations, surpriseMeSmart, generateReason, getTimeSlot, getSlotLabel } from './services/smartEngineService';
import { applyFilters } from './services/filterService';
import { bingePackService, type BingePack } from './services/bingePackService';
import { AVAILABLE_GENRES } from './utils/constants';
import { SmartGenreDropdown } from './components/SmartGenreDropdown';
import { curatedTamilSeries } from './data/tamilSeries';
import { RegionAccordion } from './components/GlobalContent';
import { motion, AnimatePresence } from 'motion/react';
import { ActiveProvider, useActive } from './components/ActiveContext';

export const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western', 
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

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

export interface MediaItem {
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
  favoriteEpisodes?: number[];
  seasons?: any[];
  hypeScore?: number;
  recommendationReason?: string;
  trailer_key?: string;
}

const TMDB_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

// --- Auth Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
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
  updateItemRating: (id: string, newRating: number) => Promise<void>;
}>({ 
  watchlistItems: [],
  addToWatchlist: async () => {},
  removeFromWatchlist: async () => {},
  updateItemRating: async () => {} 
});

export const useWatchlist = () => useContext(WatchlistContext);

// --- Smart Refresh Manager ---
const CACHE_TIME = 1000 * 60 * 10; // 10 minutes

export const smartRefreshManager = {
  shouldRefresh: (key: string) => {
    const lastFetch = localStorage.getItem(`last_fetch_${key}`);
    if (!lastFetch) return true;
    return Date.now() - parseInt(lastFetch) > CACHE_TIME;
  },
  setLastFetch: (key: string) => {
    try {
      localStorage.setItem(`last_fetch_${key}`, Date.now().toString());
    } catch (e) { console.error("Error setting last_fetch cache:", e); }
  },
  getCached: (key: string) => {
    try {
      const data = localStorage.getItem(`cache_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  },
  setCache: (key: string, data: any) => {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(data));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.message?.includes('quota') || e.message?.includes('Quota')) {
        // Find all cache keys with their last fetch times
        const cacheEntries = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('cache_')) {
             const originalKey = k.replace('cache_', '');
             const fetchTime = parseInt(localStorage.getItem(`last_fetch_${originalKey}`) || '0');
             cacheEntries.push({ key: k, last_fetch_key: `last_fetch_${originalKey}`, time: fetchTime });
          }
        }
        
        // Sort by oldest fetch time first
        cacheEntries.sort((a, b) => a.time - b.time);
        
        // Remove oldest 50% of entries
        const removeCount = cacheEntries.length > 0 ? Math.max(1, Math.floor(cacheEntries.length / 2)) : 0;
        for (let i = 0; i < removeCount; i++) {
           localStorage.removeItem(cacheEntries[i].key);
           localStorage.removeItem(cacheEntries[i].last_fetch_key);
        }
        
        try {
          localStorage.setItem(`cache_${key}`, JSON.stringify(data));
        } catch (retryE) {
          Object.keys(localStorage).forEach(k => {
             if (k.startsWith('cache_') || k.startsWith('last_fetch_') || k.startsWith('ai-verdict-') || k.startsWith('tmdb_cache_') || k.startsWith('anime_cache_')) {
                localStorage.removeItem(k);
             }
          });
          try {
             localStorage.setItem(`cache_${key}`, JSON.stringify(data));
          } catch(e3) {
             console.error("Failed to set cache even after full clear", e3);
          }
        }
      } else {
        console.error("Error setting cache:", e);
      }
    }
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
                  ? 'fill-amber-500 text-primary' 
                  : 'text-zinc-700'
              } transition-colors`} 
            />
          </button>
        );
      })}
      {!readonly && rating > 0 && (
        <span className="ml-2 text-xs font-bold text-primary">{rating}/{max}</span>
      )}
    </div>
  );
}

function getTrend(history: any[]) {
  if (history.length < 2) return "stable";
  const lastAvg = history.slice(-5).reduce((sum, r) => sum + r.rating, 0) / Math.min(5, history.length);
  const prevAvg = history.slice(-10, -5).reduce((sum, r) => sum + r.rating, 0) / Math.min(5, Math.max(1, history.length - 5));
  
  if (history.length < 5) {
     const last = history[history.length - 1].rating;
     const prev = history[history.length - 2].rating;
     if (last > prev) return "up";
     if (last < prev) return "down";
     return "stable";
  }

  if (lastAvg > prevAvg + 0.5) return "up";
  if (lastAvg < prevAvg - 0.5) return "down";
  return "stable";
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function UserReviewsSection({ mediaId }: { mediaId: string | number }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // MediaId can come in as number or string, but for query we want string
    const idStr = String(mediaId);
    
    // Create query to standard collection
    const q = query(
      collection(db, 'reviews'), 
      where('mediaId', '==', idStr)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Sort client-side to avoid index requirements
      revs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReviews(revs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reviews');
    });
    return unsubscribe;
  }, [mediaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to leave a review");
      return;
    }
    if (!reviewText.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL || '',
        mediaId: String(mediaId),
        rating,
        text: reviewText.trim(),
        createdAt: serverTimestamp(),
      });
      setReviewText("");
      setRating(10);
      toast.success("Review posted!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    } finally {
      setIsSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;
  const historyAsc = [...reviews].reverse();
  const trend = getTrend(historyAsc);

  return (
    <div className="space-y-6 mt-12 w-full border-t border-border pt-8">
      <div className="flex flex-wrap items-end justify-between border-b border-border pb-4 gap-4">
        <h3 className="text-2xl font-black tracking-tighter flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" /> Community Reviews
        </h3>
        
        {avgRating && (
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
               <span className="text-2xl font-black text-white flex items-center gap-1"><Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> {avgRating}</span>
               <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{reviews.length} Ratings</span>
             </div>
             
             <div className={`px-3 py-1 rounded-lg border flex items-center gap-2 ${
               trend === 'up' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
               trend === 'down' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
               'bg-muted/50 border-border text-muted-foreground'
             }`}>
               {trend === 'up' && <TrendingUp className="w-4 h-4" />}
               {trend === 'down' && <TrendingDown className="w-4 h-4" />}
               {trend === 'stable' && <Minus className="w-4 h-4" />}
               <span className="text-[10px] font-black uppercase tracking-widest">
                 {trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable'}
               </span>
             </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
         {reviews.map((r) => (
           <div key={r.id} className="bg-white/5 p-4 rounded-2xl border border-border space-y-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {r.userPhoto ? (
                     <img src={r.userPhoto} alt="User" className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
                  ) : (
                     <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border"><User className="w-4 h-4 text-muted-foreground" /></div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">{r.userName}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{r.createdAt?.toDate?.()?.toLocaleDateString() || 'Just now'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-md border border-yellow-500/20">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-black text-yellow-500">{r.rating}/10</span>
                </div>
             </div>
             <p className="text-sm text-zinc-300 leading-relaxed">{r.review}</p>
           </div>
         ))}
         
         {reviews.length === 0 && (
           <div className="text-center py-8">
             <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
             <p className="text-muted-foreground font-medium">No reviews yet. Be the first to share your thoughts!</p>
           </div>
         )}
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="bg-card/50 p-5 rounded-2xl border border-border space-y-4">
          <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Write a Review</h4>
          
          <div className="flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-border inline-flex">
            <span className="text-xs font-bold text-muted-foreground uppercase">Your Rating</span>
            <div className="flex items-center gap-1">
              <input type="range" min="1" max="10" value={rating} onChange={(e) => setRating(parseInt(e.target.value))} className="w-32 accent-brand-amber" />
              <span className="w-8 text-center font-black text-primary">{rating}</span>
            </div>
          </div>
          
          <textarea
             value={reviewText}
             onChange={(e) => setReviewText(e.target.value)}
             placeholder="What did you think of this?"
             rows={3}
             className="w-full bg-black/40 border border-border rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none placeholder:text-zinc-600"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !reviewText.trim()} className="h-10 px-6 rounded-xl font-black bg-primary text-black hover:bg-primary/90 transition-all font-display uppercase tracking-widest text-[10px]">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Post Review
            </Button>
          </div>
        </form>
      ) : (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center backdrop-blur-sm">
           <p className="text-primary font-black text-xs uppercase tracking-widest font-display">Sign in to leave a review</p>
        </div>
      )}
    </div>
  );
}


function Poster({ poster, trailerKey }: { poster: string, trailerKey?: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className="detail-poster"
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => setPlaying(false)}
    >
      <img src={poster} alt="Poster" />
      {trailerKey && playing && (
        <iframe
          className="poster-video"
          style={{ opacity: 1, pointerEvents: 'none' }}
          src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${trailerKey}`}
          allow="autoplay; encrypted-media"
        />
      )}
      <button className="play-btn-poster"><Play className="w-5 h-5 fill-current border-none" /></button>
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
  onMarkEpisodeWatched,
  favoriteEpisodes = [],
  onToggleFavorite,
  userProfile,
  onToggleReminder,
  reminders = [],
  onWatchTrailer
}: { 
  item: any; 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (item: any, type?: string) => void;
  onMarkWatched: (item: any) => void;
  watchedEpisodes?: number[];
  favoriteEpisodes?: number[];
  onMarkEpisodeWatched?: (item: any, ep: number) => void;
  onToggleFavorite?: (item: any, ep: number) => void;
  userProfile?: UserProfile;
  onToggleReminder?: (item: any) => void;
  reminders?: any[];
  onWatchTrailer?: (key: string) => void;
}) {
  const [details, setDetails] = useState<any>(null);
  const [omdbRatings, setOmdbRatings] = useState<OMDbRatings | null>(null);
  const [aiVerdict, setAiVerdict] = useState<AIVerdict | null>(null);
  const [storyDNA, setStoryDNA] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerdictLoading, setIsVerdictLoading] = useState(false);
  const [userCountry, setUserCountry] = useState<string>('US');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedActor, setSelectedActor] = useState<number | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const { watchlistItems, updateItemRating } = useWatchlist();
  const watchlistItem = item ? watchlistItems.find(i => i.externalId === (item.id || item.mal_id)) : null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollY(e.currentTarget.scrollTop);
  };

  useEffect(() => {
    if (isOpen && item) {
       applyGenreTheme(item);
    } else {
       applyGenreTheme(null);
    }
  }, [isOpen, item]);

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

          // Fetch Story DNA Offline
          if (item.media_type === 'anime' || (typeof item.id === 'string' && item.id.startsWith('jikan_'))) {
            const themes = (data?.themes || []).map((t: any) => t.name);
            const demogs = (data?.demographics || []).map((d: any) => d.name);
            const combined = [...themes, ...demogs].slice(0, 5);
            setStoryDNA(combined.length > 0 ? combined : (data?.genres?.map((g: any) => g.name).slice(0, 3) || []));
          } else {
            const rawKeywords = data?.keywords?.keywords || data?.keywords?.results || [];
            if (Array.isArray(rawKeywords)) {
               setStoryDNA(rawKeywords.slice(0, 5).map((k: any) => k.name).filter(Boolean));
            } else {
               setStoryDNA([]);
            }
          }

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
          const profile = userProfile || profileService.getProfile();
          const watchedTitles = watchlistItems
             .filter(i => i.status === 'completed' || i.status === 'watching')
             .map(i => i.title || '')
             .filter(Boolean);
          const verdict = await aiService.getVerdictAndSummary(item, data, ratings?.watchScore || null, profile, watchedTitles);
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
    if (details.rating) return details.rating.split(' ')[0]; // For Jikan e.g., 'PG-13 - Teens 13 or older' -> 'PG-13'
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
        <div className="detail-page relative" onScroll={handleScroll}>
          {/* Parallax Backdrop */}
          {(item.backdrop_path || details?.backdrop_path) && (
             <div 
               className="absolute top-0 left-0 right-0 z-0 pointer-events-none overflow-hidden h-[60vh] opacity-30 mask-image-b" 
               style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
             >
                <img 
                   src={`https://image.tmdb.org/t/p/original${item.backdrop_path || details?.backdrop_path}`}
                   alt="Backdrop"
                   className="w-full h-[120%] object-cover"
                   style={{ transform: `translateY(${scrollY * 0.4}px)` }}
                />
             </div>
          )}
          
          <button className="detail-page-close z-50 relative" onClick={onClose}><X className="w-6 h-6" /></button>
          
          {isLoading && !details && (
            <div className="absolute inset-0 z-50 bg-[#111] pb-20">
              <div className="w-full h-[50vh] skeleton mb-8 rounded-b-3xl"></div>
              <div className="px-8 max-w-4xl space-y-4">
                 <div className="w-1/2 h-10 skeleton rounded-xl"></div>
                 <div className="w-3/4 h-6 skeleton rounded-md"></div>
                 <div className="w-2/3 h-6 skeleton rounded-md"></div>
              </div>
            </div>
          )}

          <div className="top-section relative z-10">
            <Poster 
              poster={item.poster_path ? (item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w500${item.poster_path}`) : 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop'} 
              trailerKey={details?.videos?.results?.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip'))?.key}
            />

            <div className="main-info">
              <span className="type">{item.media_type || (item.title ? 'movie' : 'tv')}</span>
              <h1>{item.title || item.name}</h1>
              <div className="meta">
                {suitability && (
                  <span className={`px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider ${suitability.bg} ${suitability.color} border border-current`}>
                    {suitability.label}
                  </span>
                )}
                <span>{(item.release_date || item.first_air_date)?.split('-')[0]}</span>
                {details?.runtime > 0 && <span>{Math.floor(details.runtime / 60)}h {details.runtime % 60}m</span>}
                {details?.episodes ? <span>{details.episodes} Episodes</span> : details?.number_of_seasons ? <span>{details.number_of_seasons} Seasons</span> : null}
                <span>HD</span>
              </div>
              <p className="desc">{details?.overview || item.overview || 'No description available.'}</p>
              
              <div className="flex flex-wrap gap-2 my-6">
                {(details?.genres || []).map((g: any) => (
                  <button 
                    key={g.id || g.mal_id || g.name}
                    className="px-4 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest rounded-full transition-colors cursor-pointer"
                  >
                    {g.name || g}
                  </button>
                ))}
              </div>

              <div className="actions items-center flex-wrap gap-4">
                <button className="btn-play">
                  <Play className="w-5 h-5 fill-current border-none" /> Play
                </button>
                {details?.videos?.results?.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip'))?.key && (
                   <button 
                     className="btn-play bg-red-600 !text-white hover:bg-red-700"
                     style={{ marginLeft: '10px' }}
                     onClick={() => {
                        const key = details?.videos?.results?.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip'))?.key;
                        if (onWatchTrailer && key) onWatchTrailer(key);
                     }}
                   >
                     <Play className="w-5 h-5 fill-current border-none" /> Trailer
                   </button>
                )}
                <button 
                  className="btn-action w-auto px-6 font-bold flex items-center gap-2 rounded-full border-2 border-white/20 bg-white/5 hover:bg-white/10"
                  onClick={() => onAdd(item)}
                >
                   {watchlistItem ? (
                     <>
                        <Check className="w-5 h-5 text-primary" /> Update Watchlist
                     </>
                   ) : (
                     <>
                        <Plus className="w-5 h-5" /> Add to Watchlist
                     </>
                   )}
                </button>
                
                {watchlistItem && (
                  <div className="flex items-center gap-1 ml-4 bg-white/5 p-2 rounded-full border border-white/10">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                      <button
                        key={star}
                        onClick={() => updateItemRating(watchlistItem.id, star)}
                        className={`transition-colors p-0.5 hover:scale-110 ${(watchlistItem.rating || watchlistItem.personalRating) >= star ? 'text-yellow-500' : 'text-zinc-600'}`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    ))}
                  </div>
                )}
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
              {details?.studios?.length > 0 && (
                <p><b>Studio:</b> {details.studios.map((n: any) => n.name).join(', ')}</p>
              )}
            </div>
          </div>

          <div className="detail-tabs">
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
            {((item.media_type === 'tv' || !item.title) && details?.seasons) && <button className={activeTab === 'episodes' ? 'active' : ''} onClick={() => setActiveTab('episodes')}>Episodes</button>}
            <button className={activeTab === 'reviews' ? 'active' : ''} onClick={() => setActiveTab('reviews')}>Reviews</button>
            {(details?.similar?.results?.length > 0 || details?.recommendations?.results?.length > 0) && <button className={activeTab === 'similar' ? 'active' : ''} onClick={() => setActiveTab('similar')}>You May Also Like</button>}
          </div>

          <div className="detail-content">
            {activeTab === 'overview' && (
              <div className="space-y-10">
                 {/* 1) RATINGS BLOCK & WHERE TO WATCH */}
                 <div className="flex flex-col md:flex-row gap-8 justify-between">
                   <div className="flex flex-wrap gap-4 md:gap-8 items-center">
                     {omdbRatings && (omdbRatings.rotten || omdbRatings.tmdb) && (
                       <div className="flex flex-col">
                         <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Critics</span>
                         <span className="text-white font-black text-2xl flex items-center gap-2">
                           🍅 {omdbRatings.rotten || `${parseInt(omdbRatings.tmdb || '0')}0`}%
                         </span>
                       </div>
                     )}
                     
                     {omdbRatings?.imdb && (
                       <div className="flex flex-col">
                         <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Audience</span>
                         <span className="text-white font-black text-2xl flex items-center gap-2">
                           ⭐ {omdbRatings.imdb}
                         </span>
                       </div>
                     )}

                     {details?.vote_average > 0 && (
                       <div className="flex flex-col">
                         <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">TMDb</span>
                         <span className="text-white font-black text-2xl flex items-center gap-2">
                           🎬 {details.vote_average.toFixed(1)}
                         </span>
                       </div>
                     )}

                    </div>

                   {/* WHERE TO WATCH */}
                   {details?.['watch/providers']?.results?.[userCountry]?.flatrate && (
                     <div className="flex flex-col md:items-end">
                        <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">📺 Where to Watch</span>
                        <div className="flex gap-2">
                          {details['watch/providers'].results[userCountry].flatrate.slice(0, 4).map((p: any) => (
                             <button
                               key={p.provider_id}
                               className="w-10 h-10 rounded-lg overflow-hidden hover:scale-110 transition-transform shadow-lg group relative"
                               title={`Open in ${p.provider_name}`}
                               onClick={() => {
                                 const webUrl = details['watch/providers'].results[userCountry].link;
                                 const providerName = p.provider_name.toLowerCase();
                                 const deepLinks: Record<string, string> = {
                                    netflix: "nflx://", // actually nflx:// but basic deep link works for some
                                    "amazon prime video": "primevideo://",
                                    "disney+ hotstar": "hotstar://",
                                    "sonyliv": "sonyliv://"
                                 };
                                 const appLink = deepLinks[providerName];
                                 if (appLink && /Android|iPhone/i.test(navigator.userAgent)) {
                                     window.location.href = appLink;
                                     setTimeout(() => { window.open(webUrl, "_blank"); }, 1500);
                                 } else {
                                     window.open(webUrl, "_blank");
                                 }
                               }}
                             >
                               <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} className="w-full h-full object-cover" alt={p.provider_name} />
                             </button>
                          ))}
                        </div>
                     </div>
                   )}
                 </div>

                 {/* 2) META DETAILS */}
                 <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-bold text-zinc-300">
                   {details?.release_date || details?.first_air_date ? (
                     <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-zinc-500" /> {(details.release_date || details.first_air_date).substring(0,4)}</span>
                   ) : null}
                   {(details?.runtime || details?.episode_run_time?.[0]) ? (
                     <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-zinc-500" /> {details.runtime || details.episode_run_time[0]} min</span>
                   ) : null}
                   {details?.original_language && (
                     <span className="flex items-center gap-1.5 uppercase"><Globe className="w-4 h-4 text-zinc-500" /> {details.original_language}</span>
                   )}
                   {details?.genres?.length > 0 && (
                     <span className="flex items-center gap-1.5 text-primary"><Compass className="w-4 h-4" /> {details.genres.map((g: any) => g.name).slice(0,3).join(", ")}</span>
                   )}
                 </div>

                 {/* EXPANDABLE DESCRIPTION */}
                 <div className="text-zinc-300 leading-relaxed text-sm md:text-base">
                   {details?.tagline && (
                      <p className="text-primary font-black uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                        <Quote className="w-3 h-3" /> {details.tagline}
                      </p>
                   )}
                   <ExpandableText text={details?.overview || item.overview || 'No overview available.'} />
                 </div>

                 {/* PEOPLE SAY */}
                 {details?.reviews?.results && details.reviews.results.length > 0 && (
                   <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden group">
                     <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                       <MessageSquareQuote className="w-4 h-4 text-primary" /> People Say
                     </h3>
                     <div className="space-y-4">
                       {details.reviews.results.slice(0, 2).map((review: any) => (
                         <div key={review.id} className="relative">
                            <Quote className="w-6 h-6 text-white/10 absolute -top-1 -left-1" />
                            <p className="text-zinc-300 italic text-sm pl-6 line-clamp-3">"{review.content.replace(/\r?\n|\r/g, " ").slice(0, 150)}..."</p>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase block pl-6 mt-1">- {review.author}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {/* AI Insights section */}
                 {(isVerdictLoading || aiVerdict) && (
                   <div>
                     <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                       <Sparkles className="w-5 h-5 text-primary" /> CineView Intelligence
                     </h3>
                     {isVerdictLoading ? (
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 flex items-center justify-center min-h-[150px]">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                     ) : (
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 flex flex-col gap-6 relative overflow-hidden group">
                           {aiVerdict && (
                             <>
                               <div>
                                 <h4 className="text-primary font-bold uppercase tracking-widest text-xs mb-2">AI Overview</h4>
                                 <p className="text-zinc-300 leading-relaxed text-lg">{aiVerdict.summary}</p>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                 {aiVerdict.pros && aiVerdict.pros.length > 0 && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl relative overflow-hidden group">
                                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                         <ThumbsUp className="w-16 h-16 text-emerald-500" />
                                      </div>
                                      <h4 className="text-emerald-400 font-black uppercase tracking-widest text-[11px] mb-4 flex items-center gap-2 relative z-10">
                                         <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check className="w-3.5 h-3.5 text-emerald-500" /></div>
                                         What It Does Well
                                      </h4>
                                      <ul className="space-y-2.5 relative z-10">
                                        {aiVerdict.pros.map((pro, i) => (
                                          <li key={i} className="text-emerald-100/90 text-sm flex gap-2">
                                            <span className="text-emerald-500 mt-0.5">•</span> <span>{pro}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                 )}
                                 {aiVerdict.cons && aiVerdict.cons.length > 0 && (
                                    <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl relative overflow-hidden group">
                                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                         <ThumbsDown className="w-16 h-16 text-red-500" />
                                      </div>
                                      <h4 className="text-red-400 font-black uppercase tracking-widest text-[11px] mb-4 flex items-center gap-2 relative z-10">
                                         <div className="bg-red-500/20 p-1.5 rounded-full"><X className="w-3.5 h-3.5 text-red-500" /></div>
                                         Where It Falls Short
                                      </h4>
                                      <ul className="space-y-2.5 relative z-10">
                                        {aiVerdict.cons.map((con, i) => (
                                          <li key={i} className="text-red-100/90 text-sm flex gap-2">
                                            <span className="text-red-500 mt-0.5">•</span> <span>{con}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                 )}
                               </div>
                               <div className="mt-2">
                                  <h4 className="text-white font-bold uppercase tracking-widest text-[10px] mb-3 flex items-center gap-2"><User className="w-3 h-3 text-primary" /> Who Should Watch</h4>
                                  <div className="flex flex-wrap gap-2">
                                     {aiVerdict.targetAudience?.map((aud, i) => (
                                        <span key={i} className="bg-white/10 text-white text-xs px-3 py-1 rounded-full border border-white/5">{aud}</span>
                                     ))}
                                  </div>
                               </div>
                               <div className="bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/30 p-6 rounded-2xl mt-4 relative overflow-hidden group">
                                  <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10 pr-6 pointer-events-none group-hover:scale-110 group-hover:opacity-20 transition-all duration-500">
                                     <Trophy className="w-24 h-24 text-primary" />
                                  </div>
                                  <div className="relative z-10">
                                     <h4 className="text-primary font-black uppercase tracking-[0.2em] text-[11px] mb-3 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" /> Final Verdict: {aiVerdict.verdict}
                                     </h4>
                                     <p className="text-zinc-200 text-base leading-relaxed">{aiVerdict.reason}</p>
                                     {aiVerdict.whyWatch && <p className="text-primary/80 text-sm mt-3 font-medium italic border-l-2 border-primary/50 pl-3 py-1 bg-primary/5 rounded-r">{aiVerdict.whyWatch}</p>}
                                  </div>
                               </div>
                               
                               {aiVerdict.moodTags && (
                                 <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                                   <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                     <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Intensity</div>
                                     <div className="text-white font-bold">{aiVerdict.moodTags.intensity}</div>
                                   </div>
                                   <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                     <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Complexity</div>
                                     <div className="text-white font-bold">{aiVerdict.moodTags.complexity}</div>
                                   </div>
                                   <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                     <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Pace</div>
                                     <div className="text-white font-bold">{aiVerdict.moodTags.pace}</div>
                                   </div>
                                   <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                     <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Emotion</div>
                                     <div className="text-white font-bold">{aiVerdict.moodTags.emotion}</div>
                                   </div>
                                 </div>
                               )}
                               
                               {aiVerdict.moodScores && (
                                 <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center">
                                   <h4 className="text-white font-bold uppercase tracking-widest text-[10px] w-full text-left mb-2">Mood Fingerprint</h4>
                                   <MoodGraph scores={aiVerdict.moodScores} />
                                   <Button 
                                     variant="outline" 
                                     onClick={() => setIsCompareModalOpen(true)}
                                     className="w-full mt-4"
                                   >
                                     Compare with another title
                                   </Button>
                                 </div>
                               )}
                             </>
                           )}
                           {storyDNA.length > 0 && (
                             <div className="pt-4 border-t border-white/10">
                               <h4 className="text-primary font-bold uppercase tracking-widest text-xs mb-3">Story Vibes</h4>
                               <div className="flex flex-wrap gap-2">
                                 {storyDNA.map((dna, idx) => (
                                    <span key={idx} className="bg-primary/20 text-primary border border-primary/20 px-3 py-1 rounded-md text-xs font-black uppercase tracking-widest">
                                      🔥 {dna}
                                    </span>
                                 ))}
                               </div>
                             </div>
                           )}
                        </div>
                     )}
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   {/* KEY DETAILS PANEL */}
                   <div className="space-y-4">
                     <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Key Details</h3>
                     <div className="space-y-3 text-sm">
                       {(() => {
                         const directors = details?.credits?.crew?.filter((c: any) => c.job === 'Director').map((c: any) => c.name).join(', ');
                         if (directors) return <p className="flex"><span className="w-24 text-zinc-500">Director:</span> <span className="font-medium">{directors}</span></p>;
                         return null;
                       })()}
                       {(() => {
                         const writers = details?.credits?.crew?.filter((c: any) => c.department === 'Writing').slice(0, 3).map((c: any) => c.name).join(', ');
                         if (writers) return <p className="flex"><span className="w-24 text-zinc-500">Writers:</span> <span className="font-medium">{writers}</span></p>;
                         return null;
                       })()}
                       {details?.production_companies?.length > 0 && (
                         <p className="flex"><span className="w-24 text-zinc-500">Studio:</span> <span className="font-medium">{details.production_companies[0].name}</span></p>
                       )}
                       {details?.networks?.length > 0 && (
                         <p className="flex"><span className="w-24 text-zinc-500">Network:</span> <span className="font-medium">{details.networks[0].name}</span></p>
                       )}
                       {details?.production_countries?.length > 0 && (
                         <p className="flex"><span className="w-24 text-zinc-500">Country:</span> <span className="font-medium">{details.production_countries[0].name}</span></p>
                       )}
                       {details?.status && (
                         <p className="flex"><span className="w-24 text-zinc-500">Status:</span> <span className="font-medium">{details.status}</span></p>
                       )}
                       {details?.number_of_seasons > 0 && (
                         <p className="flex"><span className="w-24 text-zinc-500">Seasons:</span> <span className="font-medium">{details.number_of_seasons}</span></p>
                       )}
                       {details?.number_of_episodes > 0 && (
                         <p className="flex"><span className="w-24 text-zinc-500">Episodes:</span> <span className="font-medium">{details.number_of_episodes}</span></p>
                       )}
                       {details?.themes?.length > 0 && (
                         <p className="flex items-start"><span className="w-24 text-zinc-500 shrink-0">Themes:</span> <span className="font-medium">{details.themes.map((t: any) => t.name).join(', ')}</span></p>
                       )}
                       {details?.demographics?.length > 0 && (
                         <p className="flex items-start"><span className="w-24 text-zinc-500 shrink-0">Demographics:</span> <span className="font-medium">{details.demographics.map((d: any) => d.name).join(', ')}</span></p>
                       )}
                     </div>
                   </div>

                   {/* EXTRA INFO */}
                   <div className="space-y-4">
                     <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Extra Info</h3>
                     <div className="space-y-3 text-sm">
                       {details?.budget > 0 && (
                         <p className="flex"><span className="w-24 text-zinc-500">Budget:</span> <span className="font-medium">${(details.budget / 1000000).toFixed(1)}M</span></p>
                       )}
                       {details?.revenue > 0 && (
                         <p className="flex"><span className="w-24 text-zinc-500">Revenue:</span> <span className="font-medium">${(details.revenue / 1000000).toFixed(1)}M</span></p>
                       )}
                       {omdbRatings?.awards && omdbRatings.awards !== "N/A" && (
                         <p className="flex"><span className="w-24 text-zinc-500">Awards:</span> <span className="font-medium">{omdbRatings.awards}</span></p>
                       )}
                     </div>
                   </div>
                 </div>

                 {details?.credits?.cast?.length > 0 && (
                   <div className="relative z-10 w-full overflow-hidden pt-4">
                     <h3 className="text-lg font-bold text-white mb-6">Top Cast</h3>
                     <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x relative z-10">
                        {details.credits.cast.slice(0, 15).map((actor: any) => (
                          <div 
                            key={actor.id} 
                            className="w-[110px] flex-shrink-0 cursor-pointer snap-start group relative z-20"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedActor(actor.id);
                            }}
                          >
                            <img
                              src={actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : 'https://images.unsplash.com/photo-1544502062-f82887f03d1c?q=80&w=200&auto=format&fit=crop'}
                              alt={actor.name}
                              className="w-[110px] h-[165px] object-cover rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl mb-3"
                            />
                            <p className="text-xs font-bold text-white leading-tight mb-1">{actor.name}</p>
                            <p className="text-[10px] text-zinc-400 leading-tight block truncate">{actor.character}</p>
                          </div>
                        ))}
                     </div>
                   </div>
                 )}
              </div>
            )}
            
            {activeTab === 'episodes' && details?.seasons && (
               <div className="space-y-6">
                 <EpisodeHeatmap seasons={details.seasons} itemId={item.id} title={item.title || item.name} />
                 <EpisodeList 
                   itemId={item.id} 
                   type={item.media_type || 'tv'} 
                   onMarkWatched={onMarkEpisodeWatched ? (ep) => onMarkEpisodeWatched(item, ep) : () => {}}
                   onToggleFavorite={onToggleFavorite ? (ep) => onToggleFavorite(item, ep) : () => {}}
                   watchedEpisodes={watchedEpisodes}
                   favoriteEpisodes={favoriteEpisodes}
                 />
               </div>
            )}

            {activeTab === 'reviews' && (
               <div className="space-y-12">
                 <ReviewsPanel contentId={item.externalId || item.id} />
                 
                 {details?.reviews?.results && details.reviews.results.length > 0 && (
                   <div className="mt-12 space-y-6">
                     <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                       <CheckCircle2 className="w-5 h-5 text-primary" /> Verified TMDb Reviews
                     </h3>
                     {details.reviews.results.map((review: any) => (
                       <div key={review.id} className="bg-white/5 p-6 rounded-2xl border border-white/10 relative">
                         <div className="flex items-start justify-between mb-4">
                           <div>
                             <h4 className="font-bold text-white text-lg">{review.author}</h4>
                             <p className="text-xs text-zinc-400">{new Date(review.created_at).toLocaleDateString()}</p>
                           </div>
                           {review.author_details?.rating && (
                             <div className="bg-[#f5c518]/20 text-[#f5c518] px-3 py-1 rounded-full font-black flex items-center justify-center gap-1">
                               ⭐ {review.author_details.rating}
                             </div>
                           )}
                         </div>
                         <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                           {review.content}
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            )}

            {activeTab === 'similar' && (
               <div className="space-y-12">
                 {(details?.similar?.results?.length > 0) && (
                   <div>
                     <h3 className="text-white font-bold text-xl mb-4">Similar & Recommended</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                       {[...(details?.similar?.results || []), ...(details?.recommendations?.results || [])].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i).filter(item => item.poster_path).slice(0, 15).map((item: any, idx: number) => (
                         <div key={`${item.id}-${idx}`}>
                           <MediaCard 
                             item={item} 
                             type={item.media_type || (item.title ? 'movie' : 'tv')} 
                             onClick={() => {}} 
                           />
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
            )}
          </div>
        </div>
      )}

      {selectedActor && (
        <ActorModal actorId={selectedActor} onClose={() => setSelectedActor(null)} />
      )}

      {/* Compare Modal */}
      {isCompareModalOpen && aiVerdict && (
        <CompareModal 
          onClose={() => setIsCompareModalOpen(false)}
          baseItem={item}
          baseVerdict={aiVerdict}
        />
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
        if (!data || !data.results) {
            setItems([]);
            return;
        }
        let uniqueResults = Array.from(new Map(data.results.map((item: any) => [item.id, item])).values()) as any[];
        
        // Remove low quality stuff and only allow released items, unless it's upcoming endpoint
        const today = new Date();
        uniqueResults = uniqueResults.filter(item => {
           if (!item.poster_path && type !== 'anime') return false;
           if (item.vote_average !== undefined && item.vote_average > 0 && item.vote_average < 5) return false;
           
           if (endpoint !== 'upcoming') {
               const releaseDateStr = item.release_date || item.first_air_date;
               if (!releaseDateStr) return true; // Keep items with no specific date
               return new Date(releaseDateStr) <= today;
           }
           
           return true; 
        });

        // Ensure popularity sort
        if (endpoint !== 'upcoming' && endpoint !== 'top10' && title.includes('Trending')) {
           uniqueResults = uniqueResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }

        const initialLimit = window.innerWidth < 600 ? 10 : uniqueResults.length;
        const finalResults = uniqueResults.slice(0, initialLimit);
        
        setItems(finalResults as any[]);
        smartRefreshManager.setCache(cacheKey, finalResults);
        smartRefreshManager.setLastFetch(cacheKey);
      } else {
        if (data && data.results) {
            setItems(prev => {
              const combined = [...prev, ...data.results];
              let uniqueResults = Array.from(new Map(combined.map(item => [item.id, item])).values()) as any[];
              
              const today = new Date();
              uniqueResults = uniqueResults.filter(item => {
                 if (!item.poster_path && type !== 'anime') return false;
                 if (item.vote_average !== undefined && item.vote_average > 0 && item.vote_average < 5) return false;
                 
                 if (endpoint !== 'upcoming') {
                     const releaseDateStr = item.release_date || item.first_air_date;
                     if (!releaseDateStr) return true; 
                     return new Date(releaseDateStr) <= today;
                 }
                 
                 return true; 
              });

              return uniqueResults;
            });
        }
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
    <div className="row-container space-y-4">
      <div className="row-header flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-black tracking-tight text-foreground">{title}</h3>
          {isRefreshing && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary animate-pulse uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              Updating
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {onSeeMore && (
            <Button 
              variant="ghost" 
              className="see-more text-xs font-bold uppercase tracking-widest text-primary hover:text-primary hover:bg-primary/10 transition-all active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                onSeeMore();
              }}
            >
              See More <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          <div className="flex gap-2 relative z-[150]">
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
          items.filter(item => item.poster_path).map((item, idx) => (
            <MediaCard 
              key={`${item.id}-${idx}`} 
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

function BottomNav({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) {
  const tabs = [
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'upcoming', label: 'Coming Soon', icon: Calendar },
    { id: 'watchlist', label: 'My List', icon: PlusCircle },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-card/80 backdrop-blur-3xl border border-border rounded-3xl z-[1000] shadow-2xl flex items-center justify-around px-4">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : 'scale-100 hover:scale-105'}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-0'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeTabGlow"
                className="absolute -top-3 w-8 h-1 bg-primary rounded-md shadow-[0_0_15px_rgba(255,191,0,0.8)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function AnimatedCounter({ value, duration = 1000 }: { value: number | string, duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const target = typeof value === 'number' ? value : parseFloat(value.toString().replace('%', ''));
  
  useEffect(() => {
    if (isNaN(target)) return;
    
    let startTime: number | null = null;
    const startValue = 0;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function (outQuart)
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      
      const current = startValue + (target - startValue) * easedProgress;
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [target, duration]);

  const isPercent = typeof value === 'string' && value.includes('%');
  return (
    <span>
      {typeof value === 'number' ? displayValue.toFixed(1) : Math.round(displayValue)}
      {isPercent ? '%' : ''}
    </span>
  );
}

function RatingTrendIndicator({ history }: { history: any[] }) {
  if (history.length < 2) return null;
  const recent = history[0].rating;
  const previous = history[1].rating;
  
  const isRising = recent > previous;
  const isFalling = recent < previous;
  const isStable = recent === previous;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-tighter ${
      isRising ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
      isFalling ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
      'bg-muted/10 text-muted-foreground border-border'
    }`}>
      {isRising ? <TrendingUp className="w-2.5 h-2.5" /> : 
       isFalling ? <TrendingDown className="w-2.5 h-2.5" /> : 
       <Minus className="w-2.5 h-2.5" />}
      {isRising ? 'Rising' : isFalling ? 'Falling' : 'Stable'}
    </div>
  );
}

function NetflixHero({ item, type, onPlay, onInfo }: { item: any, type: string, onPlay: () => void, onInfo: () => void }) {
  const [omdbData, setOmdbData] = useState<any>(null);
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number>();
  
  useEffect(() => {
    setTimeout(() => setLoaded(true), 200);

    const handleScroll = () => {
      setOffset(window.scrollY * 0.4);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (item && item.id) {
        if (type === 'anime' || (typeof item.id === 'string' && item.id.startsWith('jikan_'))) {
            // Can't fetch TMDB details with a Jikan ID directly for OMDB ratings
            return;
        }
        // Map 'anime' to 'tv' for TMDB as TMDB stores anime as TV shows
        const tmdbType = type === 'anime' ? 'tv' : (type as 'movie' | 'tv');
        tmdbService.getDetails(item.id, tmdbType).then(details => {
             const imdbId = details?.external_ids?.imdb_id || details?.imdb_id;
             if (imdbId) {
                omdbService.getRatings(imdbId).then(ratings => {
                   if (ratings) {
                      setOmdbData(ratings);
                   }
                });
             }
        }).catch(err => console.error("Error fetching NetflixHero info:", err));
    }
  }, [item, type]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    function updateColor() {
      if (!videoRef.current || !ctx) return;
      try {
        if (videoRef.current.readyState >= 2) {
          ctx.drawImage(videoRef.current, 0, 0, 50, 50);
          const data = ctx.getImageData(0, 0, 50, 50).data;
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          if (count > 0) {
            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);
            applyGenreTheme(item, [r, g, b]);
          }
        }
      } catch (e) {
        // Handle cross-origin or unsupported canvas draw
      }
      animationFrameRef.current = requestAnimationFrame(updateColor);
    }
    
    // Start loop when video plays
    const handlePlay = () => {
       updateColor();
    };
    videoRef.current.addEventListener('play', handlePlay);
    
    return () => {
       if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
       if (videoRef.current) videoRef.current.removeEventListener('play', handlePlay);
    };
  }, [item?.preview]);

  if (!item) return null;

  const backdrop = `https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}`;
  const videoUrl = item.preview || null;

  const opacity = Math.max(1 - offset / 400, 0);

  return (
    <div className="hero-section">
      <canvas ref={canvasRef} className="color-canvas" width={50} height={50} />
      <div className="hero-bg-container">
        {videoUrl ? (
          <video
            ref={videoRef}
            className="hero-video"
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{ transform: `translateY(${offset}px)`, opacity }}
          />
        ) : (
          <img 
            className="hero-bg-image"
            src={backdrop} 
            alt={item.title || item.name}
            referrerPolicy="no-referrer"
            style={{ transform: `translateY(${offset}px)`, opacity }}
          />
        )}
        <div className="hero-vignette" />
      </div>

      {videoUrl && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-24 right-8 z-50 bg-black/40 hover:bg-white/20 border-white/20 rounded-full w-12 h-12 flex items-center justify-center backdrop-blur-md transition-all"
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = !videoRef.current.muted;
            }
          }}
        >
          <Volume2 className="w-5 h-5 text-white" />
        </Button>
      )}

      <div className="hero-content">
        <div className="space-y-4 md:space-y-4 animate-hero-content">
          <div className="flex flex-wrap items-center gap-3 md:gap-5">
             <Badge className="bg-white/20 backdrop-blur-md text-white font-black uppercase text-[10px] tracking-widest px-2 py-1 border border-white/20 rounded-sm">
               {type === 'movie' ? 'Cinematic Feature' : 'Premier Series'}
             </Badge>
             
             <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 text-emerald-400 font-black text-sm drop-shadow-lg">
                 <TrendingUp className="w-4 h-4" />
                 {(item.vote_average * 10).toFixed(0)}% Match
               </div>
               
               {omdbData?.imdb && (
                 <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-md border border-border shadow-[0_0_15px_rgba(255,191,0,0.3)]">
                    <span className="bg-primary text-black text-[9px] font-black px-1.5 py-0.5 rounded leading-none uppercase font-display">IMDb</span>
                    <span className="text-sm font-black text-white"><AnimatedCounter value={omdbData.imdb} /></span>
                 </div>
               )}

               {omdbData?.rottenTomatoes && (
                 <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-md border border-border shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                    <span className="text-base">🍅</span>
                    <span className="text-sm font-black text-white"><AnimatedCounter value={omdbData.rottenTomatoes + '%'} /></span>
                 </div>
               )}
             </div>

             {item.ratingHistory && <RatingTrendIndicator history={item.ratingHistory} />}
          </div>

          <h1 className="hero-title drop-shadow-2xl">
            {item.title || item.name}
          </h1>

          <p className="hero-overview drop-shadow-lg font-medium">
            {item.overview}
          </p>

          <div className="hero-buttons pt-4 flex gap-4">
            <Button 
                onClick={onPlay}
                className="hero-btn-play group h-12 md:h-14 font-black uppercase tracking-widest px-8 rounded-sm bg-white text-black hover:bg-zinc-200"
            >
              <Play className="w-5 h-5 md:w-6 md:h-6 fill-black mr-2 group-hover:scale-110 transition-transform" />
              Play
            </Button>
            <Button 
                onClick={onInfo}
                className="hero-btn-info group h-12 md:h-14 font-black uppercase tracking-widest px-8 rounded-sm bg-zinc-600/60 hover:bg-zinc-600/80 text-white backdrop-blur-md"
            >
              <Info className="w-5 h-5 md:w-6 md:h-6 mr-2 group-hover:scale-110 transition-transform" />
              More Info
            </Button>
          </div>
        </div>
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

function UpcomingContent({ onItemClick, onSeeMore }: { onItemClick: (item: any) => void, onSeeMore?: (genre: any) => void }) {
  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [anime, setAnime] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'movies' | 'series' | 'anime'>('all');
  const [selectedLang, setSelectedLang] = useState<string>('all');

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

      const filteredMovies = Array.from(new Map(movieData.results
        .filter((m: any) => m.release_date && m.release_date >= today && m.poster_path)
        .map((m: any) => [m.id, m])).values())
        .map((m: any) => ({ ...m, media_type: 'movie' }))
        .sort((a: any, b: any) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime());
      
      const filteredSeries = Array.from(new Map(seriesData.results
        .filter((s: any) => s.first_air_date && s.first_air_date >= today && s.poster_path)
        .map((s: any) => [s.id, s])).values())
        .map((s: any) => ({ ...s, media_type: 'tv' }))
        .sort((a: any, b: any) => new Date(a.first_air_date).getTime() - new Date(b.first_air_date).getTime());
      
      const filteredAnime = Array.from(new Map(animeData.results
        .filter((a: any) => {
          const releaseDate = a.first_air_date || a.release_date;
          return releaseDate && new Date(releaseDate) > new Date();
        })
        .map((a: any) => [a.id, a])).values())
        .map((a: any) => ({ ...a, media_type: 'anime', original_language: 'ja' }))
        .sort((a: any, b: any) => {
            const dateA = new Date(a.first_air_date || a.release_date || 0);
            const dateB = new Date(b.first_air_date || b.release_date || 0);
            return dateA.getTime() - dateB.getTime();
        });

      setMovies(filteredMovies);
      setSeries(filteredSeries);
      setAnime(filteredAnime);
      
      const cacheData = { 
        movies: filteredMovies.slice(0, 20), 
        series: filteredSeries.slice(0, 20), 
        anime: filteredAnime.slice(0, 20) 
      };
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

  const filterItems = (items: any[]) => {
    let filtered = items;
    if (selectedLang !== 'all') {
      filtered = filtered.filter(i => i.original_language === selectedLang);
    }
    return filtered;
  };

  const getActiveItems = () => {
    if (activeSubTab === 'movies') return filterItems(movies);
    if (activeSubTab === 'series') return filterItems(series);
    if (activeSubTab === 'anime') return filterItems(anime);
    return filterItems([...movies, ...series, ...anime].sort((a, b) => {
      const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
      const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
      return dateA - dateB;
    }));
  };

  const languages = [...new Set([...movies, ...series, ...anime].map(i => i.original_language).filter(Boolean))];

  const groupContent = (items: any[]) => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const getDate = (i: any) => new Date(i.release_date || i.first_air_date || 0);

    return {
      thisWeek: items.filter(i => getDate(i) <= nextWeek),
      thisMonth: items.filter(i => {
        const date = getDate(i);
        return date > nextWeek && date <= nextMonth;
      }),
      later: items.filter(i => getDate(i) > nextMonth)
    };
  };

  const renderSection = (title: string, items: any[], icon: React.ReactNode, endpoint?: string) => {
    if (items.length === 0) return null;
    return (
      <div className="row-container space-y-6">
        <div className="row-header flex items-center justify-between">
          <h3 className="text-2xl font-black tracking-tighter flex items-center gap-3">
            {icon}
            {title}
          </h3>
          {onSeeMore && endpoint && (
            <Button 
              variant="ghost" 
              className="text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10"
              onClick={() => onSeeMore({ name: title, endpoint })}
            >
              See More <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
        <div className="row-scroll px-4 md:px-0 media-row">
          {items.filter(item => item.poster_path).map((item, idx) => (
            <MediaCard 
              key={`${item.id}-${idx}`} 
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
          <div className="h-10 w-full max-w-md bg-card rounded-md animate-pulse mx-auto" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-6">
              <div className="h-8 w-48 bg-card rounded-xl animate-pulse" />
              <div className="flex gap-6 overflow-hidden">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="min-w-[220px] aspect-[2/3] bg-card rounded-3xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
    );
  }

  const activeItems = getActiveItems();
  const groups = groupContent(activeItems);

  return (
    <div className="space-y-12 py-8">
      {/* Tabs and Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4 mb-8">
        <div className="flex items-center gap-2 bg-card/50 p-1.5 rounded-2xl border border-border backdrop-blur-xl">
          {[
            { id: 'all', label: 'All' },
            { id: 'movies', label: 'Movies' },
            { id: 'series', label: 'Series' },
            { id: 'anime', label: 'Anime' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeSubTab === tab.id 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
           {languages.length > 1 && (
             <Select value={selectedLang} onValueChange={setSelectedLang}>
               <SelectTrigger className="w-[140px] bg-card/50 border-border rounded-xl h-10 text-[10px] font-black uppercase tracking-widest">
                 <SelectValue placeholder="Language" />
               </SelectTrigger>
               <SelectContent className="bg-card border-border">
                 <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">All Languages</SelectItem>
                 {languages.map(lang => (
                   <SelectItem key={lang} value={lang} className="text-[10px] font-bold uppercase tracking-widest">
                     {lang.toUpperCase()}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
           <Button 
             variant="ghost" 
             size="sm" 
             className="text-muted-foreground hover:text-white font-bold h-10 rounded-xl" 
             onClick={() => fetchUpcoming(true)}
           >
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </Button>
        </div>
      </div>

      {activeItems.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-card/50 rounded-full flex items-center justify-center mx-auto border border-border">
            <Calendar className="w-6 h-6 text-zinc-700" />
          </div>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">No upcoming content found for this selection</p>
        </div>
      ) : (
        <div className="space-y-16">
          {renderSection("🔥 Coming This Week", groups.thisWeek, <Zap className="w-6 h-6 text-primary" />, "upcoming")}
          {renderSection("📅 Coming This Month", groups.thisMonth, <Calendar className="w-6 h-6 text-primary" />, "upcoming")}
          {renderSection("⏳ Later Releases", groups.later, <Clock className="w-6 h-6 text-muted-foreground" />, "upcoming")}
        </div>
      )}
    </div>
  );
}

function HypeMeter({ score }: { score?: number }) {
  if (!score) return null;
  const isHot = score > 80;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 bg-muted rounded-md overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full ${isHot ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-primary'}`}
        />
      </div>
      <span className={`text-[9px] font-black ${isHot ? 'text-orange-500 animate-pulse' : 'text-muted-foreground'}`}>
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

function applyGenreTheme(item: any, ambientRGB?: [number, number, number]) {
  const genreBase: Record<string, string> = {
    Action: "neon",
    Thriller: "amoled", /* making thriller dark */
    Horror: "amoled",
    Romance: "warm",
    Comedy: "default",
    "Science Fiction": "sci",
    Animation: "anime"
  };

  const baseTheme = typeof window !== 'undefined' ? (localStorage.getItem('cineai-theme') || 'default') : 'default';
  let assignedTheme = baseTheme;
  
  if (item) {
      const genreNames = item.genres?.map((g: any) => typeof g === 'string' ? g : g.name) || [];
      for (let gName of genreNames) {
        if (genreBase[gName]) {
          assignedTheme = genreBase[gName];
          break;
        }
      }
      
      // Fallback if no direct genre found
      if (assignedTheme === baseTheme && item.genre_ids) {
          const names = item.genre_ids.map((id: number) => {
              // rough guess mapping for tmdb
              const tmdbMap: Record<number, string> = { 28: 'Action', 53: 'Thriller', 27: 'Horror', 10749: 'Romance', 35: 'Comedy', 878: 'Science Fiction', 16: 'Animation' };
              return tmdbMap[id];
          });
          for (let name of names) {
              if (name && genreBase[name]) {
                  assignedTheme = genreBase[name];
                  break;
              }
          }
      }
  }

  document.documentElement.setAttribute("data-theme", assignedTheme);
  
  // Also blend ambient if provided
  if (ambientRGB) {
    document.documentElement.style.setProperty("--ambient", `rgba(${ambientRGB[0]}, ${ambientRGB[1]}, ${ambientRGB[2]}, 0.5)`);
  }
}

import { SeasonComparisonGraph } from './components/SeasonComparisonGraph';
import { EpisodeHeatmap } from './components/EpisodeHeatmap';
import { SimilarContent } from './components/SimilarContent';
import { ReviewsPanel } from './components/ReviewsPanel';
import { ExpandableText } from './components/ExpandableText';

import { EpisodeCard } from './components/EpisodeCard';

function EpisodeList({ 
  itemId, 
  type, 
  onMarkWatched, 
  onToggleFavorite,
  watchedEpisodes = [],
  favoriteEpisodes = []
}: { 
  itemId: number; 
  type: 'tv' | 'anime'; 
  onMarkWatched: (ep: number) => void;
  onToggleFavorite: (ep: number) => void;
  watchedEpisodes?: number[];
  favoriteEpisodes?: number[];
}) {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [sortOption, setSortOption] = useState<'episode' | 'air_date' | 'rating'>('episode');

  useEffect(() => {
    const fetchSeasons = async () => {
      if (type === 'tv') {
        const details = await tmdbService.getDetails(itemId, 'tv');
        setSeasons(details.seasons || []);
      } else {
        setSeasons([{ season_number: 1, name: 'Season 1' }]);
      }
    };
    fetchSeasons();
  }, [itemId, type]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2 mt-8">
        <h3 className="text-xl font-bold">All Seasons</h3>
        <select 
          value={sortOption} 
          onChange={(e) => setSortOption(e.target.value as any)}
          className="bg-[#111] border border-white/10 text-white rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
        >
          <option value="episode">Order</option>
          <option value="rating">Rating</option>
          <option value="air_date">Newest</option>
        </select>
      </div>

      <div className="grid gap-4">
        {seasons.map((season, i) => (
           <CollapsibleSeason 
              key={season.id || season.season_number || i}
              season={season}
              itemId={itemId}
              type={type}
              sortOption={sortOption}
              watchedEpisodes={watchedEpisodes}
              favoriteEpisodes={favoriteEpisodes}
              onMarkWatched={onMarkWatched}
              onToggleFavorite={onToggleFavorite}
              defaultExpanded={type !== 'tv' || i === 0}
           />
        ))}
      </div>
    </div>
  );
}

function CollapsibleSeason({ 
  season, itemId, type, sortOption, watchedEpisodes, favoriteEpisodes, onMarkWatched, onToggleFavorite, defaultExpanded 
}: any) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!expanded || hasFetched) return;
    
    const fetchEpisodes = async () => {
      setLoading(true);
      try {
        if (type === 'tv') {
          const data = await tmdbService.getSeasonDetails(itemId, season.season_number);
          const imdbId = await tmdbService.getExternalIds(itemId, 'tv');
          
          let omdbEpisodes: any[] = [];
          if (imdbId) {
            omdbEpisodes = await omdbService.getSeasonEpisodes(imdbId, season.season_number) || [];
          }

          const combined = (data.episodes || []).map((ep: any) => {
            const omdbMatch = omdbEpisodes.find((o: any) => parseInt(o.Episode) === ep.episode_number);
            return {
              ...ep,
              imdbRating: omdbMatch && omdbMatch.imdbRating !== "N/A" ? parseFloat(omdbMatch.imdbRating) : null
            };
          });

          setEpisodes(combined);
        } else {
          const data = await jikanService.getAnimeEpisodes(itemId);
          setEpisodes(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch episodes", error);
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    };
    fetchEpisodes();
  }, [expanded, hasFetched, itemId, season.season_number, type]);

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  return (
    <div className="bg-card/30 border border-border rounded-2xl overflow-hidden mb-4">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
           <h4 className="font-bold uppercase tracking-widest text-sm">{season.name}</h4>
           {season.episode_count && <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">{season.episode_count} Episodes</span>}
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-border/50">
          {loading ? (
             <div className="mt-4 grid gap-4">
               {[...Array(3)].map((_, i) => (
                 <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />
               ))}
             </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {[...episodes].sort((a, b) => {
                 if (sortOption === 'rating') {
                    const aRating = a.imdbRating || a.vote_average || 0;
                    const bRating = b.imdbRating || b.vote_average || 0;
                    return bRating - aRating;
                 }
                 if (sortOption === 'air_date') {
                    const aDate = new Date(a.air_date || a.aired || 0).getTime();
                    const bDate = new Date(b.air_date || b.aired || 0).getTime();
                    return bDate - aDate;
                 }
                 return (a.episode_number || a.mal_id) - (b.episode_number || b.mal_id);
              }).map((ep) => {
                const epNum = ep.episode_number || ep.mal_id;
                const isWatched = watchedEpisodes.includes(epNum);
                const isFavorite = favoriteEpisodes.includes(epNum);
                const airDateLocal = ep.air_date || ep.aired;
                const isNew = airDateLocal && new Date(airDateLocal) > lastWeek && new Date(airDateLocal) <= new Date();
                
                const image = ep.still_path 
                  ? `https://image.tmdb.org/t/p/w500${ep.still_path}` 
                  : "https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop";

                return (
                  <EpisodeCard
                    key={epNum}
                    ep={ep}
                    epNum={epNum}
                    isWatched={isWatched}
                    isFavorite={isFavorite}
                    isNew={isNew as boolean}
                    image={image}
                    airDateLocal={airDateLocal}
                    onMarkWatched={onMarkWatched}
                    onToggleFavorite={onToggleFavorite}
                    tvId={itemId}
                    seasonNum={season.season_number}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
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
    <div className="space-y-4 p-4 rounded-3xl bg-card/40 border border-border">
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
      
      {loading && <div className="h-20 bg-muted/50 rounded-2xl animate-pulse" />}
      
      {order.length > 0 && (
        <div className="space-y-2">
          {order.map((item, i) => (
            <div key={i} className="flex items-center gap-3 group">
              <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-zinc-300 truncate">{item.step}</p>
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">{item.type}</p>
              </div>
              {i < order.length - 1 && (
                <div className="absolute left-[1.15rem] mt-8 w-0.5 h-4 bg-muted" />
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
      className="bg-gradient-to-br from-brand-amber to-amber-600 hover:shadow-[0_0_20px_rgba(255,191,0,0.3)] transition-all duration-500 rounded-2xl font-black text-xs uppercase tracking-widest h-12 px-6 group"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Dice5 className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />}
      Surprise Me
    </Button>
  );
}

let activePreviewVideo: HTMLVideoElement | null = null;
const previewCache: Record<number, number> = {};

function getBestStartTime(duration: number) {
  const min = duration * 0.25;
  const max = duration * 0.45;
  return Math.floor(Math.random() * (max - min) + min);
}

function fadeAudio(video: HTMLVideoElement) {
  video.muted = false;
  video.volume = 0;
  let vol = 0;
  const interval = setInterval(() => {
    vol += 0.05;
    video.volume = Math.min(vol, 0.5);
    if (vol >= 0.5) clearInterval(interval);
  }, 100);
}

export function MediaCard({ item, type, onClick, onHover }: { key?: any; item: any; type: 'movie' | 'tv' | 'anime'; onClick: () => void; onHover?: (url: string | null) => void }) {
  const { activeId, setActiveId } = useActive();
  const [ready, setReady] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [nextEpisode, setNextEpisode] = useState<any>(null);
  const [omdbRatings, setOmdbRatings] = useState<{ imdb: string; rotten: string; finalScore?: string | null; tmdb?: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuth();
  const { setHoveredBackdrop } = useBackdrop();
  const { watchlistItems, addToWatchlist, removeFromWatchlist, updateItemRating } = useWatchlist();

  const watchlistItem = watchlistItems.find(i => i.externalId === (item.id || item.mal_id));
  const isSaved = !!watchlistItem;
  const isActive = activeId === (item.id || item.mal_id);

  function getShift() {
    if (!cardRef.current) return 0;
    const rect = cardRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    
    const expandedWidth = 400; // From CSS
    const centerShift = -(expandedWidth - rect.width) / 2;
    const padding = 30;

    let finalLeft = centerShift;
    
    // Bounds checking
    if (rect.left + finalLeft < padding) {
      finalLeft = padding - rect.left;
    } else if (rect.left + finalLeft + expandedWidth > screenWidth - padding) {
      finalLeft = (screenWidth - padding) - (rect.left + expandedWidth);
    }
    
    return finalLeft;
  }

  const fetchDetailsAndNextEpisode = async () => {
     if (!details) {
        if ((type as any) === 'anime' || (typeof item.id === 'string' && item.id.startsWith('jikan_'))) {
            // Can't fetch TMDB details for anime
            return;
        }
        tmdbService.getDetails(item.id, ((type as any) === 'anime' ? 'tv' : type) as 'tv' | 'movie').then(d => {
           setDetails(d);
           if (type === 'tv' && d?.next_episode_to_air) {
              setNextEpisode(d.next_episode_to_air);
           }
        }).catch(err => console.error("Error fetching detail:", err));
     }
  };

  const fetchOmdbRatings = async () => {
    if (omdbRatings) return;
    if ((type as any) === 'anime' || (typeof item.id === 'string' && item.id.startsWith('jikan_'))) return;
    try {
      const tmdbType = ((type as any) === 'anime' ? 'tv' : type) as 'tv' | 'movie';
      const imdbId = await tmdbService.getExternalIds(item.id, tmdbType);
      if (imdbId) {
        const data = await omdbService.getRatings(imdbId);
        if (data) {
          const finalScore = getFinalRating({
            imdb: data.imdb,
            tmdb: item.vote_average,
            rotten: data.rottenTomatoes
          });
          setOmdbRatings({
             imdb: data.imdb ? String(data.imdb) : "N/A",
             rotten: data.rottenTomatoes ? `${data.rottenTomatoes}%` : "N/A",
             tmdb: item.vote_average ? String(item.vote_average) : "N/A",
             finalScore
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isActive) {
      if (videoRef.current) {
        if (activePreviewVideo && activePreviewVideo !== videoRef.current) {
           activePreviewVideo.pause();
        }
        activePreviewVideo = videoRef.current;
        
        const setupVideo = () => {
           if (!videoRef.current) return;
           const duration = videoRef.current.duration;
           if (isNaN(duration)) return;
           
           const id = item.id || item.mal_id;
           if (!previewCache[id]) {
              previewCache[id] = getBestStartTime(duration);
           }
           videoRef.current.currentTime = previewCache[id];
           videoRef.current.muted = true;
           videoRef.current.play().then(() => {
             setReady(true);
             setTimeout(() => {
                if (videoRef.current === activePreviewVideo) fadeAudio(videoRef.current!);
             }, 1200);
           }).catch(() => {});
        };

        if (videoRef.current.readyState >= 1) {
           setupVideo();
        } else {
           videoRef.current.onloadedmetadata = setupVideo;
           videoRef.current.load();
        }
      }
    } else {
      setReady(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.muted = true;
      }
    }
  }, [isActive]);

  const onEnter = () => {
    const backdrop = item.backdrop_path 
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/original${item.poster_path}`;
    
    if (onHover) onHover(backdrop);
    setHoveredBackdrop(backdrop);

    if (window.innerWidth < 768) return;

    timeoutRef.current = setTimeout(() => {
      setActiveId(item.id || item.mal_id);
      fetchDetailsAndNextEpisode();
      fetchOmdbRatings();
      
      if (cardRef.current) {
         const shift = getShift();
         cardRef.current.style.setProperty("--shift", `${shift}px`);
      }
    }, 400); // 400ms to allow smooth animation
  };

  const onLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveId(null);
    if (cardRef.current) {
      cardRef.current.style.transform = `scale(1) rotateX(0deg) rotateY(0deg)`;
      const poster = cardRef.current.querySelector('.poster') as HTMLElement;
      if (poster) poster.style.transform = `translateZ(0px)`;
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return; 
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Set variables for glare effect
    cardRef.current.style.setProperty("--light-x", `${(x / rect.width) * 100}%`);
    cardRef.current.style.setProperty("--light-y", `${(y / rect.height) * 100}%`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = Math.max(Math.min(-(y - centerY) / 12, 8), -8);
    const rotateY = Math.max(Math.min((x - centerX) / 12, 8), -8);

    cardRef.current.style.transform = `scale(1.25) translateY(-10px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    const poster = cardRef.current.querySelector('.poster') as HTMLElement;
    if (poster) poster.style.transform = `translateX(${rotateY * 2}px) translateY(${rotateX * 2}px) translateZ(20px)`;
  };

  const posterUrl = item.poster_path?.startsWith('http') 
    ? item.poster_path 
    : item.poster_path 
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000&auto=format&fit=crop';

  const progress = item.totalEpisodes && item.currentEpisode 
    ? (item.currentEpisode / item.totalEpisodes) * 100 
    : (item.watchedEpisodes?.length && item.totalEpisodes) 
      ? (item.watchedEpisodes.length / item.totalEpisodes) * 100
      : item.status === 'watching' ? 35 : 0;

  return (
    <div 
      ref={cardRef}
      className={`media-card font-sans transition-all duration-300 group ${isActive ? 'active z-[100]' : 'hover:z-50'}`}
      style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseMove={onMouseMove}
      onClick={() => {
        if (window.innerWidth < 768 && !isActive) {
          setActiveId(item.id || item.mal_id);
        } else {
          profileService.updateInteraction(item, 'click');
          onClick();
        }
      }}
    >
      <motion.img 
        layoutId={`poster-${item.id || item.mal_id}`}
        className="poster z-10 w-full h-full object-cover transition-transform duration-200" 
        src={posterUrl}
        alt={item.title || item.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000';
        }}
        style={{ opacity: isActive ? 0 : 1 }}
      />
      
      <div 
        className={`absolute inset-0 pointer-events-none rounded-xl transition-opacity duration-200 z-[15] ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{
          background: 'radial-gradient(circle at var(--light-x, 50%) var(--light-y, 50%), rgba(255,255,255,0.4) 0%, transparent 80%)',
          mixBlendMode: 'overlay',
        }}
      />


      {(item.status === 'watching' || (progress > 0 && progress < 100)) && !isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 backdrop-blur-sm z-20">
          <div 
            className="h-full bg-primary shadow-[0_0_15px_rgba(255,191,0,0.6)]" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      )}

      {isActive && (
        <div className="expanded" style={{ left: `calc(var(--shift))` }}>
          <div className="relative w-full aspect-video bg-[#111]">
             <img 
               className="w-full h-full object-cover pointer-events-none absolute inset-0 z-10 opacity-50" 
               src={item.backdrop_path ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}` : posterUrl}
               alt={`${item.title || item.name} Backdrop`}
               loading="lazy"
               referrerPolicy="no-referrer"
             />
             <video
               ref={videoRef}
               className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[400px] ${ready ? "opacity-100 z-20" : "opacity-0"}`}
               src={item.preview || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"}
               muted
               loop
               playsInline
               preload="metadata"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/20 to-transparent z-30" />
             <h4 className="absolute bottom-3 left-4 right-4 text-white font-black text-xl truncate z-40 drop-shadow-md">
                 {item.title || item.name}
             </h4>
          </div>

          <div className="p-4 flex flex-col gap-2 relative z-40 bg-[#111]">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                     size="icon"
                     className="bg-white hover:bg-zinc-200 text-black rounded-full w-8 h-8 transition-all flex items-center justify-center shrink-0"
                     onClick={(e) => {
                        e.stopPropagation();
                        profileService.updateInteraction(item, 'click');
                        onClick();
                     }}
                  >
                     <Play className="w-4 h-4 fill-black" style={{ marginLeft: '2px' }} />
                  </Button>
                  <Button
                     size="icon"
                     variant="outline"
                     className={`w-8 h-8 rounded-full bg-[#111]/80 hover:bg-zinc-800 border-border shadow-xl transition-all ${isSaved ? 'text-primary' : 'text-white'}`}
                     onClick={(e) => {
                       e.stopPropagation();
                       if (isSaved) {
                         removeFromWatchlist(item.id);
                       } else {
                         addToWatchlist(item, type);
                       }
                     }}
                  >
                     {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </Button>
                  <Button
                     size="icon"
                     variant="outline"
                     className="w-8 h-8 rounded-full bg-[#111]/80 hover:bg-zinc-800 border-border shadow-xl transition-all text-white"
                     onClick={(e) => {
                       e.stopPropagation();
                     }}
                  >
                     <ThumbsUp className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                   size="icon"
                   variant="outline"
                   className="w-8 h-8 rounded-full bg-[#111]/80 hover:bg-zinc-800 border-border shadow-xl transition-all text-white"
                   onClick={(e) => {
                     e.stopPropagation();
                     onClick();
                   }}
                >
                   <ChevronDown className="w-4 h-4" />
                </Button>
             </div>

             <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-xs font-black text-green-500">{Math.round((item.vote_average || 0) * 10)}% Match</span>
                <span className="border border-zinc-500 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-sm font-bold">
                   {(item.adult === true || item.rating === 'R') ? '18+' : '13+'}
                </span>
                <span className="text-xs text-zinc-300 font-bold">{(item.release_date || item.first_air_date)?.split('-')[0]}</span>
                {details?.runtime > 0 && <span className="text-xs text-zinc-300 font-bold">{Math.floor(details.runtime / 60)}h {details.runtime % 60}m</span>}
                {details?.number_of_seasons > 0 && <span className="text-xs text-zinc-300 font-bold">{details.number_of_seasons} Season{details.number_of_seasons > 1 ? 's' : ''}</span>}
                <span className="border border-zinc-500 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-sm font-bold">HD</span>
             </div>

             <div className="flex items-center gap-2 text-[10px] mt-2 bg-black/40 p-1.5 rounded-lg border border-white/10 w-fit">
                {omdbRatings?.finalScore && (
                  <span className="font-black text-xs text-[#00ffcc] drop-shadow-[0_0_8px_rgba(0,255,204,0.6)] px-1">
                    ⭐ {omdbRatings.finalScore}
                  </span>
                )}
                {omdbRatings?.imdb && omdbRatings.imdb !== "N/A" && (
                  <span className="border-l border-white/20 pl-2 text-zinc-300 font-medium">
                    IMDb {omdbRatings.imdb}
                  </span>
                )}
                {omdbRatings?.rotten && omdbRatings.rotten !== "N/A" && (
                  <span className="border-l border-white/20 pl-2 text-zinc-300 font-medium">
                    🍅 {omdbRatings.rotten}
                  </span>
                )}
                {omdbRatings?.tmdb && omdbRatings.tmdb !== "N/A" && (
                  <span className="border-l border-white/20 pl-2 text-zinc-300 font-medium">
                    TMDb {parseFloat(omdbRatings.tmdb).toFixed(1)}
                  </span>
                )}
             </div>

             {(item.genre_ids || item.genreIds) && (item.genre_ids || item.genreIds).length > 0 && (
               <div className="flex flex-wrap items-center gap-0 mt-1">
                 {(item.genre_ids || item.genreIds).slice(0, 3).map((id: number, idx: number) => (
                   <div key={id} className="flex items-center">
                     <span className="text-[10px] text-zinc-400 font-bold">
                       {TMDB_GENRE_MAP[id] || 'Other'}
                     </span>
                     {idx < Math.min((item.genre_ids || item.genreIds).length, 3) - 1 && (
                       <span className="w-1 h-1 rounded-full bg-zinc-600 mx-1.5" />
                     )}
                   </div>
                 ))}
               </div>
             )}

             {item.overview && (
               <p className="line-clamp-2 text-[11px] text-zinc-400 mt-2 leading-[1.4]">
                  {item.overview}
               </p>
             )}

             {watchlistItem && (
               <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 pb-1">
                 <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Your Rating</span>
                 <StarRating 
                   rating={watchlistItem.rating || 0} 
                   max={10} 
                   onRatingChange={(r) => updateItemRating(watchlistItem.id, r)} 
                 />
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, type, onItemClick }: { query: string, type: 'movie' | 'tv' | 'anime' | 'all', onItemClick: (item: any) => void }) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters state
  const [sortBy, setSortBy] = useState('relevance');
  const [filterYear, setFilterYear] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [filterGenres, setFilterGenres] = useState<string[]>([]);
  
  // AI Refinement State
  const [refinementInput, setRefinementInput] = useState('');
  const [refinementHistory, setRefinementHistory] = useState<string[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [activeVibeParams, setActiveVibeParams] = useState<any | null>(null);

  const clearFilters = () => {
    setFilterYear('all');
    setFilterRating('all');
    setFilterLanguage('all');
    setFilterGenres([]);
    setSortBy('relevance');
    setActiveVibeParams(null);
    setRefinementHistory([]);
  };

  const toggleGenre = (g: string) => {
    setFilterGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const performSearch = async (pageNum: number, vibeParams: any = null) => {
    let res;
    if (vibeParams) {
        // AI Discover mode
        const targetType = vibeParams.media_type || (type === 'all' ? 'movie' : type);
        try {
            if (targetType === 'anime') {
                const params: any = { q: vibeParams.query || '', page: pageNum };
                if (vibeParams.with_genres) params.genres = vibeParams.with_genres;
                res = await jikanService.discoverAnime(params);
            } else {
                const params: any = { page: pageNum };
                if (vibeParams.with_genres) params.with_genres = vibeParams.with_genres;
                if (vibeParams.primary_release_year) params.primary_release_year = vibeParams.primary_release_year;
                if (vibeParams['primary_release_date.gte']) params['primary_release_date.gte'] = vibeParams['primary_release_date.gte'];
                if (vibeParams['primary_release_date.lte']) params['primary_release_date.lte'] = vibeParams['primary_release_date.lte'];
                if (vibeParams.with_original_language) params.with_original_language = vibeParams.with_original_language;
                if (vibeParams.query) {
                    res = await tmdbService.searchMulti(vibeParams.query, pageNum);
                } else {
                    res = await tmdbService.discover(targetType as any, params);
                }
            }
        } catch (error) {
            console.error("AI Discover Failed:", error);
            res = { results: [], totalPages: 1 };
        }
    } else {
        // Standard text search
        if (type === 'anime') {
          res = await jikanService.searchAnime(query, pageNum);
        } else {
          res = await tmdbService.searchMulti(query, pageNum);
        }
    }
    
    let filtered = res.results || [];
    if (!vibeParams && type !== 'all' && type !== 'anime') {
      filtered = filtered.filter((i: any) => i.media_type === type);
    }
    return {
      results: Array.from(new Map(filtered.map((i: any) => [i.id, i])).values()) as any[],
      totalPages: res.totalPages || res.total_pages || 1
    };
  };

  useEffect(() => {
    setPage(1);
    setActiveVibeParams(null);
    setRefinementHistory([]);
    const fetchResults = async () => {
      if (!query) return;
      setLoading(true);
      try {
        const res = await performSearch(1);
        setResults(res.results);
        setTotalPages(res.totalPages);
      } catch (error) {
        console.error("Explore Search Failed", error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 500);
    return () => clearTimeout(timer);
  }, [query, type]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await performSearch(nextPage, activeVibeParams);
      setResults(prev => {
        const combined = [...prev, ...res.results];
        return Array.from(new Map(combined.map((i: any) => [i.id, i])).values());
      });
      setPage(nextPage);
    } catch (error) {
      console.error("Explore Search Load More Failed", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refinementInput.trim() || isRefining) return;
    
    setIsRefining(true);
    const newHistory = [...refinementHistory, refinementInput];
    setRefinementHistory(newHistory);
    const currentInput = refinementInput;
    setRefinementInput('');
    setLoading(true);
    setPage(1);

    try {
        const context = `${query} -> ${newHistory.join(' -> ')}`;
        const vibeParams = await aiService.parseVibeQuery(query, context);
        setActiveVibeParams(vibeParams);
        const res = await performSearch(1, vibeParams);
        setResults(res.results);
        setTotalPages(res.totalPages);
    } catch (error) {
        console.error("AI Refinement failed", error);
    } finally {
        setLoading(false);
        setIsRefining(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 40}, (_, i) => currentYear - i);

  const filteredItems = useMemo(() => {
    let output = applyFilters(results, {
      genres: filterGenres,
      language: filterLanguage === 'all' ? null : filterLanguage,
      rating: filterRating === 'all' ? null : Number(filterRating),
      year: filterYear === 'all' ? null : Number(filterYear)
    });

    output.sort((a, b) => {
      if (sortBy === 'popularity.desc') {
        return (b.popularity || 0) - (a.popularity || 0);
      } else if (sortBy === 'vote_average.desc') {
        return (b.vote_average || 0) - (a.vote_average || 0);
      } else if (sortBy === 'primary_release_date.desc' || sortBy === 'first_air_date.desc') {
        const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
        const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
        return dateB - dateA;
      } else if (sortBy === 'primary_release_date.asc' || sortBy === 'first_air_date.asc') {
        const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
        const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
        return dateA - dateB;
      }
      return 0; // relevance
    });

    return output;
  }, [results, filterGenres, filterLanguage, filterRating, filterYear, sortBy]);


  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Scouring the Vaults</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* AI Refinement Box */}
      <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-6 rounded-3xl relative overflow-hidden backdrop-blur-xl">
         <div className="absolute top-0 right-0 p-4 opacity-50">✨ AI Search</div>
         <h3 className="text-lg font-black tracking-tighter mb-4 text-white flex items-center gap-2">
           Not exactly what you're looking for?
           {activeVibeParams && <span className="text-xs ml-4 bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-widest leading-none">Modified</span>}
         </h3>
         
         <form onSubmit={handleRefine} className="flex flex-col sm:flex-row gap-3">
           <Input 
             placeholder="e.g. 'less romance and more explosions', 'make it darker', 'only from the 90s'" 
             value={refinementInput}
             onChange={(e) => setRefinementInput(e.target.value)}
             className="bg-black/50 border-white/10 text-sm h-12 font-medium"
           />
           <Button type="submit" disabled={isRefining || !refinementInput.trim()} className="h-12 px-8 font-black tracking-widest uppercase text-xs">
             {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refine'}
           </Button>
         </form>
         
         {refinementHistory.length > 0 && (
           <div className="mt-4 flex flex-col gap-2">
             <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Filters:</div>
             <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border opacity-60 line-through">"{query}"</Badge>
                {refinementHistory.map((h, i) => (
                  <Badge key={i} variant="secondary" className="bg-primary/20 text-primary border-primary/30">"{h}"</Badge>
                ))}
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-white underline ml-2">Clear All</button>
             </div>
           </div>
         )}
      </div>

      {/* Filters Bar */}
      {results.length > 0 && (
        <div className="bg-card/80 border border-border p-6 rounded-3xl flex flex-col gap-6 sticky top-24 z-[100] backdrop-blur-2xl shadow-2xl mb-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mr-2">Filters</span>
              <SmartGenreDropdown 
                genres={AVAILABLE_GENRES.map(g => ({ id: g, name: g }))}
                selectedGenres={filterGenres}
                toggleGenre={(g: any) => toggleGenre(g)}
                onClear={() => setFilterGenres([])}
              />
            </div>
            
            <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-3 pt-6 border-t border-border">
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Sort By</label>
                <select 
                  className="w-full bg-black/40 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="popularity.desc">Most Popular</option>
                  <option value="vote_average.desc">Highly Rated</option>
                  <option value="primary_release_date.desc">Release Date (Newest First)</option>
                  <option value="primary_release_date.asc">Release Date (Oldest First)</option>
                </select>
              </div>

              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Year</label>
                <select 
                  className="w-full bg-black/40 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  <option value="all">Any Release Year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Quality</label>
                <select 
                  className="w-full bg-black/40 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                >
                  <option value="all">Any Rating</option>
                  <option value="8">8+ Exceptional</option>
                  <option value="7">7+ Great</option>
                  <option value="6">6+ Good</option>
                </select>
              </div>

              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Audio/Sub</label>
                <select 
                  className="w-full bg-black/40 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  value={filterLanguage}
                  onChange={(e) => setFilterLanguage(e.target.value)}
                >
                  <option value="all">Any Language</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="ml">Malayalam</option>
                  <option value="en">English</option>
                  <option value="ko">Korean</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>

              <div className="flex items-end h-full pt-4 md:pt-0">
                {(filterGenres.length > 0 || filterYear !== 'all' || filterRating !== 'all' || filterLanguage !== 'all' || sortBy !== 'relevance') && (
                  <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground hover:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter h-10 border border-border bg-white/5">
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredItems.filter(item => item.poster_path || item.images?.jpg?.image_url).map((item, idx) => (
            <motion.div
              layout
              key={`${item.id || item.mal_id}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (idx % 20) * 0.03, duration: 0.4 }}
            >
              <MediaCard 
                  item={item} 
                  type={item.media_type || (type === 'all' ? 'movie' : type)} 
                  onClick={() => onItemClick({ ...item, media_type: item.media_type || (type === 'all' ? 'movie' : type) })} 
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredItems.length === 0 && results.length > 0 && !loading && (
        <div className="col-span-full py-20 text-center animate-in fade-in zoom-in duration-500">
            <Search className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <p className="text-muted-foreground font-bold">No matches found for your active filters.</p>
            <Button variant="link" onClick={clearFilters} className="text-primary mt-2">Clear filters</Button>
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="col-span-full py-20 text-center">
            <p className="text-muted-foreground font-bold">No hidden treasures found for "{query}"</p>
        </div>
      )}

      {page < totalPages && filteredItems.length > 0 && (
        <div className="col-span-full py-12 flex justify-center">
          <Button 
            onClick={loadMore} 
            disabled={loadingMore}
            className="bg-primary/20 hover:bg-primary/30 text-primary font-black uppercase tracking-widest rounded-full px-8 py-6 h-auto"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading
              </span>
            ) : 'See More Results'}
          </Button>
        </div>
      )}
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
            }
            if (filterRating !== 'all') {
              params['vote_average.gte'] = filterRating;
            }
            const res = await tmdbService.getDiscover(type, params);
            
            if (type === 'tv' && res.results) {
              res.results = res.results.filter((item: any) => 
                !(item.original_language === 'ja' && item.genre_ids?.includes(16))
              );
            }
            return res;
          };

          data = await fetchWithParams(filterYear, filterLanguage);

          if (data.results.length === 0 && reset) {
            setIsFallback(true);
            if (filterYear !== 'all') {
              data = await fetchWithParams('all', filterLanguage);
            }
            if (data.results.length === 0 && filterLanguage !== 'all') {
              data = await fetchWithParams('all', 'all');
            }
          }
        }
      }
      
      if (!data || !data.results) {
        if (reset) setItems([]);
        return;
      }
      
      setItems(prev => {
        const nextItems = Array.from(new Map((data.results || []).map((item: any) => [item.id, item])).values()) as any[];
        if (reset) return nextItems;
        const combined = [...prev, ...nextItems];
        return Array.from(new Map(combined.map(item => [item.id, item])).values());
      });
      setHasMore(data.results && data.results.length > 0 && p < (data.totalPages || 1));
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
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;
      
      if (scrollTop + clientHeight >= scrollHeight - 800 && !isLoading && hasMore) {
        setPage(prev => {
          const next = prev + 1;
          fetchItems(next);
          return next;
        });
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMore, sortBy, filterYear, filterRating, filterLanguage, genre.endpoint]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 40}, (_, i) => currentYear - i);

  const filteredItems = useMemo(() => {
    let result = applyFilters(items, {
      genres: filterGenres,
      language: filterLanguage === 'all' ? null : filterLanguage,
      rating: filterRating === 'all' ? null : Number(filterRating),
      year: filterYear === 'all' ? null : Number(filterYear)
    });

    result.sort((a, b) => {
      if (sortBy === 'popularity.desc') {
        return (b.popularity || 0) - (a.popularity || 0);
      } else if (sortBy === 'vote_average.desc') {
        return (b.vote_average || 0) - (a.vote_average || 0);
      } else if (sortBy === 'primary_release_date.desc' || sortBy === 'first_air_date.desc') {
        const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
        const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
        return dateB - dateA;
      } else if (sortBy === 'primary_release_date.asc' || sortBy === 'first_air_date.asc') {
        const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
        const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
        return dateA - dateB;
      }
      return 0;
    });

    return result;
  }, [items, filterGenres, filterLanguage, filterRating, filterYear, sortBy]);

  const backdropMovie = filteredItems.find(m => m.backdrop_path);

  return (
    <div className="relative min-h-screen">
      {backdropMovie && (
        <div 
          className="absolute top-0 left-0 right-0 h-[50vh] md:h-[60vh] z-0 pointer-events-none transition-all duration-700 ease-in-out"
          style={{ 
            backgroundImage: `url(https://image.tmdb.org/t/p/original${backdropMovie.backdrop_path})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 20%',
            maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
            opacity: 0.3
          }}
        />
      )}
      <div className="space-y-8 max-w-[1600px] mx-auto relative z-10 p-4 md:p-8 pt-8 md:pt-12">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-md bg-white/5 hover:bg-white/10 w-12 h-12 border border-border shadow-xl">
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <div className="space-y-1">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-sm">{genre.name}</h2>
                <p className="text-muted-foreground font-bold text-sm tracking-wide uppercase">Explore the target catalogue</p>
              </div>
            </div>
          </div>
        
        <div className="bg-card/80 border border-border p-6 rounded-3xl flex flex-col gap-6 sticky top-0 md:top-4 z-[110] backdrop-blur-2xl shadow-2xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mr-2">Filters</span>
              <SmartGenreDropdown 
                genres={AVAILABLE_GENRES.map(g => ({ id: g, name: g }))}
                selectedGenres={filterGenres}
                toggleGenre={(g: any) => toggleGenre(g)}
                onClear={() => setFilterGenres([])}
              />
            </div>
            
            <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-3 pt-6 border-t border-border">
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Sort By</label>
                <select 
                  className="w-full bg-black/40 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="popularity.desc">Most Popular</option>
                  <option value="vote_average.desc">Highly Rated</option>
                  <option value={type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc'}>Release Date (Newest First)</option>
                  <option value={type === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc'}>Release Date (Oldest First)</option>
                </select>
              </div>

              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Year</label>
                <select 
                  className="w-full bg-black/40 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  <option value="all">Release Year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Quality</label>
                <select 
                  className="w-full bg-black/40 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                >
                  <option value="all">Minimum Rating</option>
                  <option value="8">8+ Exceptional</option>
                  <option value="7">7+ Great</option>
                  <option value="6">6+ Good</option>
                </select>
              </div>

              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">Audio/Sub</label>
                <select 
                  className="w-full bg-black/40 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  value={filterLanguage}
                  onChange={(e) => setFilterLanguage(e.target.value)}
                >
                  <option value="all">Native Language</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="ml">Malayalam</option>
                  <option value="en">English</option>
                  <option value="ko">Korean</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>

              <div className="flex items-end h-full pt-4 md:pt-0">
                {(filterGenres.length > 0 || filterYear !== 'all' || filterRating !== 'all' || filterLanguage !== 'all') && (
                  <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground hover:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter h-10">
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isFallback && items.length > 0 && (
        <div className="bg-primary/10 border border-amber-500/20 text-primary px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center animate-in fade-in slide-in-from-top-2">
           Broadening search parameters for more results
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8 min-h-[50vh]">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item, idx) => (
            <motion.div
              layout
              key={`${item.id}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (idx % 20) * 0.03, duration: 0.4 }}
            >
              <MediaCard 
                item={item} 
                type={type} 
                onClick={() => onItemClick({ ...item, media_type: type })} 
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Loading Content</p>
        </div>
      )}

      {!isLoading && filteredItems.length === 0 && !isFallback && (
        <div className="text-center py-20 animate-in fade-in zoom-in duration-500">
           <Search className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
           <p className="text-muted-foreground font-bold">No matches found. Try relaxing your filters.</p>
           <Button variant="link" onClick={clearFilters} className="text-primary mt-2">Clear all filters</Button>
        </div>
      )}
      </div>
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
          <Badge className="bg-primary text-black font-black px-4 py-1.5 rounded-xl amber-glow">#1 TRENDING ANIME</Badge>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border">
            <Star className="w-4 h-4 text-primary fill-brand-amber" />
            <span className="text-sm font-black text-primary">{featured.vote_average}</span>
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
            className="border-border bg-white/5 backdrop-blur-md hover:bg-white/10 font-black h-14 px-8 rounded-2xl"
          >
            <PlusCircle className="w-6 h-6 mr-2" />
            Add to List
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

import { Mood, moodThemes } from './utils/mood';
import { GenreMenu } from './components/GenreMenu';
import { DynamicRow } from './components/DynamicRow';
import { MOVIE_ROWS, SERIES_ROWS, ANIME_ROWS, getRankedRows } from './utils/rowEngine';

function ExploreView({ 
  onItemClick,
  currentMood,
  onMoodChange,
  defaultType = 'movie'
}: { 
  onItemClick: (item: any) => void;
  currentMood: Mood;
  onMoodChange: (m: Mood) => void;
  defaultType?: string;
}) {
  const [activeExploreTab, setActiveExploreTab] = useState<'movie' | 'tv' | 'anime' | 'upcoming' | 'global'>(defaultType as any);

  useEffect(() => {
    setActiveExploreTab(defaultType as any);
  }, [defaultType]);

  const [seeMoreGenre, setSeeMoreGenre] = useState<{ id?: number, name: string, type: 'movie' | 'tv' | 'anime' | 'upcoming' | 'global', language?: string, endpoint?: any } | null>(null);
  const [visibleRows, setVisibleRows] = useState(5);
  const profile = profileService.getProfile();

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
    setVisibleRows(5); 
  }, [activeExploreTab]);

  const TABS = [
    { id: 'movie', label: 'Movies', icon: '🎬' },
    { id: 'tv', label: 'Series', icon: '📺' },
    { id: 'anime', label: 'Anime', icon: '🍥' },
    { id: 'global', label: 'Global', icon: '🌍' },
    { id: 'upcoming', label: 'Coming Soon', icon: '🆕' },
  ];

  const DYNA_ROWS = {
    movie: getRankedRows(MOVIE_ROWS, profile, currentMood),
    tv: getRankedRows(SERIES_ROWS, profile, currentMood),
    anime: getRankedRows(ANIME_ROWS, profile, currentMood),
  };

  const [exploreSearch, setExploreSearch] = useState('');

  return (
    <div className="space-y-8 py-4">
      <AnimatePresence mode="wait">
        {seeMoreGenre ? (
          <motion.div
            key="genre-view"
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] bg-background overflow-y-auto px-4 md:px-12 py-12"
          >
            <GenreFullView 
              genre={seeMoreGenre} 
              type={seeMoreGenre.type === 'upcoming' ? 'movie' : seeMoreGenre.type} 
              language={seeMoreGenre.language || 'all'} 
              onBack={() => setSeeMoreGenre(null)} 
              onItemClick={onItemClick} 
            />
          </motion.div>
        ) : (
          <motion.div
            key="explore-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-12"
          >
            {/* Search & Top Navigation */}
            <div className="sticky top-20 z-40 bg-black/90 backdrop-blur-md pb-4 pt-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-4xl font-black text-white px-8">
                    {activeExploreTab === 'movie' ? 'Movies' : activeExploreTab === 'tv' ? 'TV Shows' : 'Content'}
                  </h2>
                  <GenreMenu type={activeExploreTab as any} onSelectGenre={(g) => setSeeMoreGenre({ name: g, type: activeExploreTab as any })} />
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative group w-[200px] md:w-[300px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-white transition-colors" />
                      <Input 
                          placeholder="Search..."
                          value={exploreSearch}
                          onChange={(e) => setExploreSearch(e.target.value)}
                          className="h-10 pl-10 pr-4 bg-white/10 border-transparent focus:border-white/20 focus:bg-white/20 text-sm font-medium rounded-full shadow-md transition-all"
                      />
                  </div>
                </div>
            </div>

            {exploreSearch.length > 0 ? (
                <div className="pt-8">
                    <SearchResults 
                        query={exploreSearch} 
                        type={activeExploreTab === 'global' || activeExploreTab === 'upcoming' ? 'all' : activeExploreTab as any} 
                        onItemClick={onItemClick} 
                    />
                </div>
            ) : (
                <div className="space-y-12">
                    {activeExploreTab === 'anime' && <AnimeHero onItemClick={onItemClick} />}

                    <div className="space-y-12">
                        {activeExploreTab === 'global' ? (
                            <RegionAccordion onItemClick={onItemClick} onSeeMore={setSeeMoreGenre} />
                        ) : activeExploreTab === 'upcoming' ? (
                            <UpcomingContent 
                            onItemClick={onItemClick} 
                            onSeeMore={(genreInfo) => setSeeMoreGenre({ ...genreInfo, type: 'upcoming' })}
                            />
                        ) : (
                            DYNA_ROWS[activeExploreTab as 'movie' | 'tv' | 'anime'].slice(0, visibleRows).map((rowConfig, index) => (
                            <motion.div
                                key={rowConfig.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <DynamicRow 
                                  config={rowConfig} 
                                  userBehavior={profile} 
                                />
                            </motion.div>
                            ))
                        )}
                    </div>
                </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Main App Component ---

function StatsDashboard({ items, stats, avgRating }: { items: MediaItem[], stats: any, avgRating: string | number }) {
  const genreData = useMemo(() => {
    const genreCounts = items.reduce((acc, item) => {
      if (item.genreIds) {
        item.genreIds.forEach(id => {
          acc[id] = (acc[id] || 0) + (item.rating || 3);
        });
      }
      return acc;
    }, {} as Record<number, number>);
    
    return Object.entries(genreCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([genreId, score]) => ({
        name: TMDB_GENRE_MAP[parseInt(genreId)] || 'Unknown',
        score
      }));
  }, [items]);

  const ratingData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    items.forEach(item => {
      if (item.rating && item.rating > 0 && item.rating <= 10) {
        counts[item.rating - 1]++;
      }
    });
    return counts.map((count, index) => ({ rating: String(index + 1), count }));
  }, [items]);

  const dayData = useMemo(() => {
    // Simulating viewing time trends from `updatedAt` timestamps
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0,0,0,0,0,0,0];
    items.forEach(item => {
       if (item.updatedAt) {
          const d = new Date(item.updatedAt.toMillis ? item.updatedAt.toMillis() : item.updatedAt);
          if (!isNaN(d.getTime())) {
              counts[d.getDay()]++;
          }
       }
    });
    return days.map((day, i) => ({ day, count: counts[i] }));
  }, [items]);

  return (
    <motion.div
      key="stats"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-10"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-black tracking-tighter">Your Insights</h2>
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-border backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Live Data</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card/40 border-border backdrop-blur-md p-8 rounded-3xl shadow-2xl overflow-hidden min-h-[300px]">
          <h3 className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mb-6">Genre Popularity</h3>
          {genreData.length > 0 ? (
            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <BarChart data={genreData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <XAxis dataKey="name" tick={{fill: '#888', fontSize: 10}} tickLine={false} axisLine={false} />
                     <YAxis tick={{fill: '#888', fontSize: 10}} tickLine={false} axisLine={false} />
                     <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} 
                     />
                     <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {genreData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === 0 ? '#primary' : '#4f46e5'} className={index === 0 ? "fill-brand-amber/80" : "fill-primary/60"} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm italic">Rate some items to build your taste profile.</p>
          )}
        </Card>

        <Card className="bg-gradient-to-br from-brand-amber/20 to-amber-600/20 border-primary/20 backdrop-blur-md p-8 rounded-3xl flex flex-col items-center justify-center text-center space-y-6 shadow-2xl shadow-primary/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner relative z-10">
            <Star className="w-12 h-12 text-primary fill-brand-amber drop-shadow-lg" />
          </div>
          <div className="relative z-10">
            <p className="text-6xl font-black tracking-tighter text-white">{avgRating}</p>
            <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mt-2">Average Rating</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/40 border-border backdrop-blur-md p-8 rounded-3xl shadow-2xl min-h-[300px]">
           <h3 className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mb-6">Viewing Activity by Day</h3>
           <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <LineChart data={dayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <XAxis dataKey="day" tick={{fill: '#888', fontSize: 10}} tickLine={false} axisLine={false} />
                     <YAxis tick={{fill: '#888', fontSize: 10}} tickLine={false} axisLine={false} allowDecimals={false} />
                     <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} 
                     />
                     <Line type="monotone" dataKey="count" stroke="#eab308" strokeWidth={3} dot={{ fill: '#eab308', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
               </ResponsiveContainer>
           </div>
        </Card>
        
        <Card className="bg-card/40 border-border backdrop-blur-md p-8 rounded-3xl shadow-2xl min-h-[300px]">
           <h3 className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mb-6">Rating Distribution</h3>
           <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <BarChart data={ratingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <XAxis dataKey="rating" tick={{fill: '#888', fontSize: 10}} tickLine={false} axisLine={false} />
                     <YAxis tick={{fill: '#888', fontSize: 10}} tickLine={false} axisLine={false} allowDecimals={false} />
                     <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} 
                     />
                     <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#22c55e" />
                  </BarChart>
               </ResponsiveContainer>
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
          <Card key={i} className="bg-card/40 border-border backdrop-blur-md p-6 rounded-3xl space-y-4 hover:border-white/20 transition-all duration-300 group">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center border border-border group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-3xl font-black tracking-tighter">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

function MediaTracker() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [globalMood, setGlobalMood] = useState<Mood>('all');
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'watchlist' | 'history' | 'stats' | 'upcoming' | 'settings'>('home');
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', moodThemes[globalMood]);
  }, [globalMood]);

  // Watchlist Filters State
  const [watchlistFilterStatus, setWatchlistFilterStatus] = useState<'all' | MediaStatus>('all');
  const [watchlistFilterType, setWatchlistFilterType] = useState<'all' | MediaType>('all');
  const [watchlistGenreFilter, setWatchlistGenreFilter] = useState<number | 'all'>('all');
  
  const availableGenreIds = useMemo(() => {
    const ids = new Set<number>();
    items.forEach(item => {
      if (item.genreIds) {
        item.genreIds.forEach(id => ids.add(id));
      }
    });
    return Array.from(ids).sort((a, b) => (TMDB_GENRE_MAP[a] || '').localeCompare(TMDB_GENRE_MAP[b] || ''));
  }, [items]);

  // TMDb State
  const [searchResults, setSearchResults] = useState<TMDBItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Explore State
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [hoveredBackdrop, setHoveredBackdrop] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);

  const watchTrailer = async (item: any) => {
    let key = item.trailer_key || item.preview;
    if (!key) {
      try {
        if (item.media_type === 'anime') {
           const data = await jikanService.getAnimeDetails(item.externalId || item.id);
           key = (data as any)?.trailer?.youtube_id || data?.videos?.results?.[0]?.key;
        } else {
           const details = await tmdbService.getDetails(item.externalId || item.id, item.media_type as any || 'movie');
           const vid = details?.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
           if (vid) key = vid.key;
        }
      } catch (err) {
        console.error("Failed to fetch trailer", err);
      }
    }
    if (key) {
      setTrailerKey(key);
      setTrailerModalOpen(true);
    } else {
      alert("No trailer available for this title.");
    }
  };

  const [theme, setTheme] = useState<'default' | 'cyber' | 'minimal' | 'amoled' | 'custom'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('cineai-theme') as any) || 'default';
    }
    return 'default';
  });

  const [transitioning, setTransitioning] = useState(false);
  const [tabSwipe, setTabSwipe] = useState(false);

  const navigateWithAnimation = (tabId: typeof activeTab) => {
    if (tabId === activeTab) return;
    
    // Play dummy whoosh sound
    const whoosh = new Audio("data:audio/wav;base64,UklGRioAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQYAAAAKFA8SAwk="); // short minimal beep to prevent DOM error, actual whoosh can be plugged in
    whoosh.volume = 0.05;
    whoosh.play().catch(() => {});
    
    setTabSwipe(true);
    setTimeout(() => {
        setActiveTab(tabId);
        window.scrollTo(0, 0); // Reset scroll on "page" change
        setTimeout(() => setTabSwipe(false), 50); // slight delay before unswiping
    }, 400); // match transition
  };

  const changeTheme = useCallback((newTheme: typeof theme) => {
    setTheme(prev => {
        if (prev === newTheme) return prev;
        setTransitioning(true);
        setTimeout(() => {
          document.documentElement.setAttribute('data-theme', newTheme);
          try {
            localStorage.setItem('cineai-theme', newTheme);
          } catch (e) {}
          setTheme(newTheme); // We do this last in timeout to trigger re-renders exactly as backdrop switches or classes switch
        }, 200);
        setTimeout(() => {
          setTransitioning(false);
        }, 400);
        return prev;
    });
  }, []);

  const handleSelectItem = useCallback((item: any) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);

    const genreThemeMap: Record<string, 'default' | 'cyber' | 'minimal' | 'amoled'> = {
      'Action': 'cyber',
      'Science Fiction': 'cyber',
      'Sci-Fi': 'cyber',
      'Thriller': 'amoled',
      'Horror': 'amoled',
      'Crime': 'amoled',
      'Romance': 'minimal'
    };

    const genreIds = item.genre_ids || item.genreIds || [];
    const genres = item.genres 
      ? item.genres.map((g: any) => g.name) 
      : genreIds.map((id: number) => TMDB_GENRE_MAP[id] || '');

    for (const g of genres) {
      if (genreThemeMap[g]) {
        changeTheme(genreThemeMap[g]);
        break;
      }
    }
  }, [changeTheme]);

  useEffect(() => {
    const handleEvent = (e: any) => {
       handleSelectItem(e.detail);
    };
    window.addEventListener('ITEM_CLICKED', handleEvent);
    return () => window.removeEventListener('ITEM_CLICKED', handleEvent);
  }, [handleSelectItem]);

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
    
    if (theme === 'custom') {
      document.documentElement.style.setProperty('--bg', customThemeColors.background);
      document.documentElement.style.setProperty('--brand', customThemeColors.primary);
      document.documentElement.style.setProperty('--text', customThemeColors.foreground);
      document.documentElement.style.setProperty('--card', customThemeColors.card);
      document.documentElement.style.setProperty('--muted-text', customThemeColors.card);
      document.documentElement.style.setProperty('--border', `${customThemeColors.foreground}20`); // 20% opacity
    } else {
      document.documentElement.style.removeProperty('--bg');
      document.documentElement.style.removeProperty('--brand');
      document.documentElement.style.removeProperty('--text');
      document.documentElement.style.removeProperty('--card');
      document.documentElement.style.removeProperty('--muted-text');
      document.documentElement.style.removeProperty('--border');
    }
  }, [theme, customThemeColors]);

  const handleCustomColorChange = (key: keyof typeof customThemeColors, value: string) => {
    const newColors = { ...customThemeColors, [key]: value };
    setCustomThemeColors(newColors);
    try {
      localStorage.setItem('cineai-custom-colors', JSON.stringify(newColors));
    } catch (e) {}
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
          try {
            localStorage.setItem('anime_cache', JSON.stringify(results.slice(0, 15)));
          } catch (e) {}
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
  const [trendingHeroItem, setTrendingHeroItem] = useState<any | null>(null);
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

      const today = new Date();
      // Filter out watched/added items and seen items, AND exclude unreleased/upcoming items
      candidates = candidates.filter(c => {
        if (items.some(i => i.externalId === c.id) || profile.seenItems.includes(c.id)) return false;
        
        const dateStr = c.release_date || c.first_air_date;
        if (dateStr && new Date(dateStr) > today) {
           return false; // Skip upcoming content in regular discovery feed
        }
        return true;
      });

      // Deduplicate
      const uniqueCandidates = Array.from(new Map(candidates.map(item => [item.id, item])).values());

      if (uniqueCandidates.length > 0 && !trendingHeroItem) {
        // Pick a high rated one with a backdrop for the hero
        const withBackdrop = uniqueCandidates.filter(c => c.backdrop_path && c.vote_average > 7);
        const hero = withBackdrop.length > 0 
          ? withBackdrop[Math.floor(Math.random() * Math.min(withBackdrop.length, 5))]
          : uniqueCandidates[0];
        setTrendingHeroItem(hero);
      }

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
      handleSelectItem(winner);
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
      const words = cleanQuery(queryToUse);
      const cacheKey = `smart_discovery_${words.join('_')}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const parsedCache = JSON.parse(cached);
        if (parsedCache.length > 0) {
          setAiRecommendations(parsedCache);
          setAiHistory(prev => [...prev, queryToUse]);
          setAiQuery('');
          setIsAiLoading(false);
          return;
        }
      }
      
      // 1. Fetch wide candidate pools concurrently
      const promises: Promise<any[]>[] = [];
      
      // TMDB General Pools
      promises.push(tmdbService.getTrendingMovies().then(d => d.results.map((r: any) => ({ ...r, media_type: 'movie' }))));
      promises.push(tmdbService.getTrendingSeries().then(d => d.results.map((r: any) => ({ ...r, media_type: 'tv' }))));
      promises.push(tmdbService.getTopRated('movie').then(d => d.map((r: any) => ({ ...r, media_type: 'movie' }))));
      promises.push(tmdbService.getTopRated('tv').then(d => d.map((r: any) => ({ ...r, media_type: 'tv' }))));
      
      // TMDB Search if literal matches exist
      promises.push(tmdbService.searchMulti(queryToUse).then(d => d.results));

      // Jikan Pools (Anime)
      promises.push(jikanService.getTopAnime(1).then(d => d.results.map((r: any) => ({ ...r, media_type: 'anime' }))));
      promises.push(jikanService.getSeasonalAnime(1).then(d => d.results.map((r: any) => ({ ...r, media_type: 'anime' }))));
      promises.push(jikanService.searchAnime(queryToUse, 1).then(d => d.results.map((r: any) => ({ ...r, media_type: 'anime' }))));

      const resultsArray = await Promise.all(promises);
      const allCandidates = resultsArray.flat().filter(Boolean);

      // Deduplicate by ID
      const seen = new Set();
      const uniqueCandidates = allCandidates.filter(c => {
        const key = c.id;
        if (seen.has(key)) return false;
        seen.add(key);
        // Filter out anime from TMDB to rely on Jikan
        if (c.original_language === 'ja' && c.genre_ids?.includes(16) && c.media_type !== 'anime') {
          return false;
        }
        return true;
      });

      // Filter out items already in the user's list
      const unseenCandidates = uniqueCandidates.filter(c => !items.some(i => i.externalId === c.id));

      // 2. Score Items
      const scored = unseenCandidates.map(item => ({
        ...item,
        score: scoreItem(item, words)
      }));

      // 3. Rank Top 5 Matches
      const topPicks = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (topPicks.length === 0 || topPicks[0].score < 0) {
        toast.error('Could not find suitable recommendations for that specific search.');
        setIsAiLoading(false);
        return;
      }
      
      // 4. Format into AI Recommendations UI Payload
      const finalRecommendations = await Promise.all(topPicks.map(async (candidate, index) => {
          let providers: any[] = [];
          const actualId = (typeof candidate.id === 'string' && candidate.id.startsWith('jikan')) 
            ? candidate.id.replace('jikan_', '') 
            : candidate.id;
            
          if (candidate.media_type !== 'anime') {
            try {
              const pData = await tmdbService.getWatchProviders(Number(actualId), candidate.media_type === 'tv' ? 'tv' : 'movie');
              providers = pData?.US?.flatrate || [];
            } catch(e) {}
          }
          
          return {
            item: candidate,
            rank: index + 1,
            badge: index === 0 ? "Top Match" : "Great Match",
            reason: explain(candidate, queryToUse),
            verdict: candidate.vote_average > 8 ? 'Must Watch' : 'Worth a Try',
            type: candidate.media_type || (candidate.first_air_date ? 'tv' : 'movie'),
            providers
          };
      }));

      if (finalRecommendations.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(finalRecommendations));
        } catch (e) {
        }
        setAiRecommendations(finalRecommendations as any);
        setAiHistory(prev => [...prev, queryToUse]);
        setAiQuery('');
      } else {
        toast.error('Could not find suitable recommendations.');
      }
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      toast.error('Discovery engine is taking a break. Try again soon.');
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
      handleSelectItem(customEvent.detail);
    };

    window.addEventListener('open-detail-modal', handleOpenDetailModal);
    return () => window.removeEventListener('open-detail-modal', handleOpenDetailModal);
  }, []);

  useEffect(() => {
    if (!user) return;

    console.log("EXEC QUERIES FOR:", user.uid);
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
      mediaItems.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      setItems(mediaItems);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'mediaItems');
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'reminders'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedReminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Client-side sorting to avoid missing composite index errors
      sortedReminders.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReminders(sortedReminders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reminders');
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
      handleFirestoreError(error, OperationType.CREATE, 'mediaItems');
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
      handleFirestoreError(error, OperationType.DELETE, `mediaItems/${existingItem.id}`);
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
        handleFirestoreError(error, OperationType.UPDATE, `mediaItems/${existingItem.id}`);
      }
      return;
    }

    try {
      const type: MediaType = tmdbItem.media_type === 'tv' ? 'series' : (tmdbItem.media_type === 'anime' ? 'anime' : 'movie');
      await addDoc(collection(db, 'mediaItems'), {
        userId: user.uid,
        title: tmdbItem.title || tmdbItem.name || (tmdbItem as any).title_english,
        type: type,
        status: 'completed',
        currentEpisode: type === 'movie' ? undefined : 0,
        posterUrl: tmdbItem.poster_path?.startsWith('http') ? tmdbItem.poster_path : tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : undefined,
        externalId: tmdbItem.id,
        source: type === 'anime' ? 'jikan' : 'tmdb',
        language: tmdbItem.original_language || (tmdbItem as any).language || 'en',
        genreIds: tmdbItem.genre_ids || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success(`Marked ${tmdbItem.title || tmdbItem.name} as watched!`);
      profileService.updateInteraction(tmdbItem, 'like');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'mediaItems');
    }
  };

  const toggleReminder = async (tmdbItem: any) => {
    if (!user) {
      toast.error('Please sign in to set reminders');
      return;
    }

    const existing = reminders.find(r => r.externalId === tmdbItem.id);
    if (existing) {
      try {
        await deleteDoc(doc(db, 'reminders', existing.id));
        toast.success('Reminder removed');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `reminders/${existing.id}`);
      }
    } else {
      try {
        await addDoc(collection(db, 'reminders'), {
          userId: user.uid,
          externalId: tmdbItem.id,
          title: tmdbItem.title || tmdbItem.name || tmdbItem.title_english,
          releaseDate: tmdbItem.release_date || tmdbItem.first_air_date || 'TBA',
          posterUrl: tmdbItem.poster_path,
          createdAt: serverTimestamp(),
        });
        toast.success('Release reminder set!');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'reminders');
      }
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
      handleFirestoreError(error, OperationType.UPDATE, `mediaItems/${item.id}`);
    }
  };

  const markCompleted = async (item: MediaItem) => {
    setRatingItem(item);
  };

  const updateItemRating = async (id: string, newRating: number) => {
    try {
      await updateDoc(doc(db, 'mediaItems', id), {
        rating: newRating,
        updatedAt: serverTimestamp(),
      });
      toast.success('Rating updated!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `mediaItems/${id}`);
    }
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
      handleFirestoreError(error, OperationType.WRITE, 'mediaItems');
    }
  };

  const onToggleFavoriteEpisode = async (item: any, ep: number) => {
    if (!user) return;
    const existing = items.find(i => i.externalId === item.id);
    
    try {
      if (existing) {
        const favorites = existing.favoriteEpisodes || [];
        const newFavorites = favorites.includes(ep) 
          ? favorites.filter(e => e !== ep)
          : [...favorites, ep];
        
        await updateDoc(doc(db, 'mediaItems', existing.id), {
          favoriteEpisodes: newFavorites,
          updatedAt: serverTimestamp(),
        });
        toast.success(`Episode ${ep} ${favorites.includes(ep) ? 'removed from' : 'added to'} favorites`);
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
          favoriteEpisodes: [ep],
          genreIds: item.genre_ids || []
        });
        toast.success(`Added to list and marked episode ${ep} as favorite`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'mediaItems');
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
      handleFirestoreError(error, OperationType.UPDATE, `mediaItems/${ratingItem.id}`);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'mediaItems', id));
      toast.success('Removed from list.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `mediaItems/${id}`);
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
    <WatchlistContext.Provider value={{ watchlistItems: items, addToWatchlist, removeFromWatchlist, updateItemRating }}>
      <BackdropContext.Provider value={{ setHoveredBackdrop }}>
        <div className="min-h-screen pb-20 md:pb-0">
          <div className={`theme-overlay ${transitioning ? "show" : ""}`} />
        {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-black/80 backdrop-blur-3xl">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 amber-glow">
              <Film className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black tracking-[0.1em] text-primary font-display uppercase">
              CINEVIEW
            </h1>
          </div>

          <nav className="hidden lg:flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-border backdrop-blur-md">
            {[
              { id: 'home', label: 'Home' },
              { id: 'tv', label: 'TV Shows' },
              { id: 'movie', label: 'Movies' },
              { id: 'upcoming', label: 'New & Popular' },
              { id: 'watchlist', label: 'My List' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigateWithAnimation(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-[14px] font-medium transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'text-white' 
                    : 'text-zinc-300 hover:text-zinc-400'
                }`}
              >
                
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-border text-muted-foreground hover:text-primary transition-all"
              onClick={() => {
                const newTheme = theme === 'minimal' ? 'default' : 'minimal';
                setTheme(newTheme);
                localStorage.setItem('cineai-theme', newTheme);
              }}
              title="Toggle Theme"
            >
              {theme === 'minimal' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-border text-muted-foreground hover:text-primary transition-all"
              onClick={() => {
                smartRefreshManager.clearCache();
                window.location.reload();
              }}
              title="Refresh All Content"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            <div className="hidden md:flex items-center gap-4 pl-6 border-l border-border">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-white leading-none mb-1">{user?.displayName}</p>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Level {level} Cinephile</p>
                  <Progress value={levelProgress} className="w-24 h-1.5 bg-card progress-gradient" />
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={logout} 
                className="w-10 h-10 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className={`swipe-overlay ${tabSwipe ? "active" : ""}`} />
      
      <nav className="fixed bottom-0 left-0 right-0 z-[150] md:hidden bg-black/95 backdrop-blur-2xl border-t border-border flex items-center justify-around p-2 pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        {[
          { id: 'home', icon: Sparkles, label: 'Home' },
          { id: 'explore', icon: Compass, label: 'Explore' },
          { id: 'upcoming', icon: Calendar, label: 'Soon' },
          { id: 'watchlist', icon: Clock, label: 'My List' },
          { id: 'history', icon: History, label: 'History' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateWithAnimation(tab.id as any)}
            className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 w-16 ${
              activeTab === tab.id 
                ? 'text-white' 
                : 'text-muted-foreground hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-[9px] font-black tracking-widest uppercase">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="mx-auto pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-16"
            >
              {/* Cinematic Hero */}
              {trendingHeroItem && (
                 <NetflixHero 
                    item={trendingHeroItem} 
                    type={trendingHeroItem.media_type}
                    onPlay={() => {
                        handleSelectItem(trendingHeroItem);
                    }}
                    onInfo={() => {
                        handleSelectItem(trendingHeroItem);
                    }}
                 />
              )}

              <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-16">
                 {/* Discovery Engine Section */}
                 <div className="flex flex-col items-center gap-10 py-20">
                    <div className="text-center space-y-6">
                        <h2 className="text-5xl md:text-8xl font-black tracking-[-0.04em] text-white font-display uppercase leading-[0.9]">
                            Your Cinematic <br/> <span className="text-primary">Odyssey</span>
                        </h2>
                        <p className="text-white/50 font-medium text-xl max-w-2xl mx-auto">AI-powered discovery for the sophisticated cinephile.</p>
                    </div>

                    <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-8">
                        <div className="relative group flex-1 w-full">
                            <div className="absolute inset-0 bg-primary/5 blur-[80px] rounded-md group-focus-within:bg-primary/15 transition-all duration-1000" />
                            {isSearching ? (
                            <Loader2 className="absolute left-8 top-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-spin z-10" />
                            ) : (
                                <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-8 h-8 text-zinc-600 group-focus-within:text-primary transition-colors z-10" />
                            )}
                            <Input 
                                placeholder="Search by mood, genre, or title..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-20 h-20 md:h-24 bg-surface-card/60 border-border focus:border-primary/40 focus:ring-primary/10 rounded-3xl text-2xl font-black transition-all backdrop-blur-3xl shadow-2xl relative z-0 placeholder:text-zinc-700"
                            />
                            <AnimatePresence>
                            {(searchResults.length > 0 || (!isSearching && search.trim() && searchResults.length === 0)) && (
                                <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="search-modal-mobile md:absolute md:top-full md:bottom-auto md:left-0 md:right-0 md:mt-6 md:bg-card/95 md:backdrop-blur-22xl border border-border rounded-t-3xl md:rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.8)] z-[200] md:z-50 overflow-hidden flex flex-col"
                                >
                                <div className="absolute top-4 right-4 z-50 md:hidden">
                                  <Button variant="ghost" size="icon" onClick={() => setSearch('')} className="bg-black/50 text-white rounded-md border border-border backdrop-blur-md">
                                    <X className="w-5 h-5" />
                                  </Button>
                                </div>
                                <ScrollArea className="flex-1 h-full md:h-[500px]">
                                    <div className="p-6 space-y-4">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((result, idx) => (
                                <div 
                                    key={`${result.id}-${idx}`}
                                    className="flex items-center gap-6 p-4 hover:bg-white/5 rounded-[2rem] group transition-all cursor-pointer border border-transparent hover:border-border"
                                    onClick={() => {
                                    handleSelectItem(result);
                                    }}
                                >
                                    <div className="w-20 h-28 bg-surface-bg rounded-2xl overflow-hidden shrink-0 shadow-2xl border border-border">
                                        <img 
                                            src={result.poster_path ? `https://image.tmdb.org/t/p/w200${result.poster_path}` : 'https://images.unsplash.com/photo-1578632738980-43318b5c9440?q=80&w=1000'} 
                                            className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                                            referrerPolicy="no-referrer" 
                                            alt={result.title || result.name} 
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {result.media_type === 'movie' ? <Film className="w-4 h-4 text-muted-foreground shrink-0" /> : 
                                             result.media_type === 'tv' ? <Tv className="w-4 h-4 text-muted-foreground shrink-0" /> : 
                                             <MonitorPlay className="w-4 h-4 text-primary shrink-0" />}
                                            <p className="text-xl font-black text-white truncate drop-shadow-md font-display uppercase tracking-tight">{result.title || result.name}</p>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2">
                                            <Badge className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-primary/20 font-display">
                                                {result.media_type === 'tv' ? 'Series' : result.media_type}
                                            </Badge>
                                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg border border-border text-primary">
                                                <Star className="w-3.5 h-3.5 fill-brand-amber" />
                                                <span className="text-xs font-black">{result.vote_average?.toFixed(1)}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground font-bold">
                                                {(result.release_date || result.first_air_date)?.split('-')[0]}
                                            </span>
                                        </div>
                                    </div>
                                    <Button 
                                        className="bg-primary text-black hover:bg-primary/80 font-black h-12 px-8 rounded-2xl shadow-xl transition-all font-display uppercase text-xs tracking-widest"
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
                                        <div className="p-12 text-center space-y-4">
                                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                                <Search className="w-10 h-10 text-zinc-600" />
                                            </div>
                                            <p className="text-muted-foreground font-black text-xl">No treasures found for "{search}"</p>
                                        </div>
                                    )}
                                    </div>
                                </ScrollArea>
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <Button 
                                onClick={() => setIsAiModalOpen(true)}
                                className="h-16 md:h-20 px-8 bg-gradient-to-br from-brand-amber to-amber-600 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(255,191,0,0.2)] hover:shadow-primary/30 transition-all group shrink-0"
                            >
                                <Sparkles className="w-5 h-5 mr-3 group-hover:scale-125 transition-transform" />
                                Help Decide
                            </Button>
                            <DiscoveryMode onSelect={(item) => {
                                handleSelectItem(item);
                            }} />
                        </div>
                    </div>
                 </div>
                 
                 <AIRecommendationCarousel items={items} onItemClick={handleSelectItem} />

                 {/* Continue Watching Section */}
                 {items.filter(i => i.status === 'watching').length > 0 && (
                  <div className="row-container space-y-4">
                    <div className="row-header flex items-center justify-between px-4">
                      <div className="flex items-center gap-3">
                        <PlayCircle className="w-6 h-6 text-primary" />
                        <h3 className="text-2xl font-black tracking-tighter">Continue Watching</h3>
                      </div>
                      <div className="flex gap-2 relative z-[110]">
                         {/* Navigation for local scrolling rows */}
                         <Button 
                            variant="ghost" size="icon" className="nav-button h-10 w-10 rounded-2xl bg-white/5 border border-border pointer-events-auto"
                            onClick={(e) => { e.stopPropagation(); document.getElementById('continue-watching-row')?.scrollBy({ left: -400, behavior: 'smooth' }); }}
                         >
                            <ChevronLeft className="w-6 h-6" />
                         </Button>
                         <Button 
                            variant="ghost" size="icon" className="nav-button h-10 w-10 rounded-2xl bg-white/5 border border-border pointer-events-auto"
                            onClick={(e) => { e.stopPropagation(); document.getElementById('continue-watching-row')?.scrollBy({ left: 400, behavior: 'smooth' }); }}
                         >
                            <ChevronRight className="w-6 h-6" />
                         </Button>
                      </div>
                    </div>
                    <div id="continue-watching-row" className="row-scroll px-4 media-row no-scrollbar">
                      {items.filter(i => i.status === 'watching' && i.poster_path).map((item, idx) => (
                        <MediaCard 
                            key={`${item.id}-${idx}`} 
                            item={{ ...item, id: item.externalId }} 
                            type={item.type as any} 
                            onClick={() => {
                                handleSelectItem({ ...item, id: item.externalId });
                            }} 
                        />
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
                      className="relative w-full aspect-video md:aspect-[21/9] rounded-[2.5rem] overflow-hidden cursor-pointer group shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-border"
                      onClick={() => {
                        handleSelectItem(bestPick);
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
                        
                        <Button className="bg-primary text-black hover:bg-primary/80 font-black h-16 px-12 rounded-2xl shadow-2xl transition-all hover:scale-105 font-display uppercase tracking-widest text-sm amber-glow">
                          <Play className="w-5 h-5 mr-3 fill-black" strokeWidth={3} />
                          Unlock Masterpiece
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- SMART ENGINE: Contextual Time Picks --- */}
                {contextPicks.length > 0 && (
                  <div className="row-container space-y-6">
                    <div className="row-header flex items-center justify-between">
                      <h3 className="text-3xl font-black tracking-tighter flex items-center gap-4 text-white font-display uppercase italic">
                        <Clock className="w-8 h-8 text-primary" />
                        {currentSlotLabel}
                      </h3>
                    </div>
                    <div className="row-scroll flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x px-4 -mx-4 md:px-0 md:mx-0 media-row">
                      {contextPicks.filter(item => item.poster_path).map((item, index) => (
                        <div key={`${item.id}-${index}`} className="snap-start">
                          <MediaCard 
                            item={item} 
                            type={item.media_type || (item.name ? 'tv' : 'movie')} 
                            onClick={() => {
                              handleSelectItem(item);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* For You Section (Fallback/Global) */}
                <div className="row-container space-y-6">
                  <div className="row-header flex items-center justify-between">
                    <h3 className="text-3xl font-black tracking-tighter flex items-center gap-4 text-white font-display uppercase italic">
                      <Sparkles className="w-8 h-8 text-primary" />
                      Explore More
                    </h3>
                    <div className="flex gap-4">
                      <Button className="bg-primary/10 border border-primary/30 text-primary font-black hover:bg-primary/20 h-12 px-6 rounded-xl font-display uppercase tracking-widest text-[10px]" onClick={handleSmartSurprise}>
                        <Dice5 className="w-4 h-4 mr-2" /> Odyssey
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white font-bold" onClick={() => fetchInitialFeed(true)}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {isFeedLoading ? (
                      [...Array(3)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-card rounded-3xl animate-pulse border border-border" />
                      ))
                    ) : (
                      forYouFeed.filter(item => item.poster_path).map((item, index) => (
                        <motion.div 
                          key={`${item.id}-${index}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="group relative"
                        >
                      <div className="absolute -top-4 -left-4 z-20 w-12 h-12 bg-gradient-to-br from-brand-amber to-amber-600 rounded-2xl flex items-center justify-center font-black text-black shadow-2xl shadow-primary/20 border-4 border-zinc-950 rotate-[-10deg] group-hover:rotate-0 transition-transform duration-500">
                            #{index + 1}
                          </div>
                          <MediaCard 
                            item={item}
                            type={item.media_type}
                            onClick={() => {
                              profileService.updateInteraction(item, 'click');
                              handleSelectItem(item);
                            }}
                          />
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                <PicksForYouRow onItemClick={handleSelectItem} />
                
                {/* Binge Packs */}
                <BingePacksRow onItemClick={handleSelectItem} />

                {/* Top 10 This Month */}
                <GenreRow 
                  title="🔥 Top 10 This Month" 
                  type="movie" 
                  language="all" 
                  onItemClick={(item) => {
                    handleSelectItem(item);
                  }}
                  endpoint="top10"
                />

                {/* Coming Soon Section */}
                <UpcomingContent 
                    onItemClick={(item) => {
                        handleSelectItem(item);
                    }} 
                    onSeeMore={() => setActiveTab('explore')}
                />

                {/* Trending Now */}
                <GenreRow 
                  title="📈 Trending Now" 
                  type="tv" 
                  language="all" 
                  onItemClick={(item) => {
                    handleSelectItem(item);
                  }} 
                />
              </div>
            </motion.div>
          )}

          {(activeTab === 'movie' || activeTab === 'tv') && (
            <motion.div
              key="explore"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <ExploreView 
                onItemClick={(item) => handleSelectItem(item)} 
                currentMood={globalMood}
                onMoodChange={setGlobalMood}
                defaultType={activeTab}
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
                  <p className="text-muted-foreground text-sm font-medium">Items you're currently tracking</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={watchlistFilterStatus} onValueChange={(val: any) => setWatchlistFilterStatus(val)}>
                    <SelectTrigger className="w-[160px] bg-card/40 border-border rounded-xl focus:ring-primary/20">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="plan-to-watch">Plan to Watch</SelectItem>
                      <SelectItem value="watching">Watching</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={watchlistFilterType} onValueChange={(val: any) => setWatchlistFilterType(val)}>
                    <SelectTrigger className="w-[160px] bg-card/40 border-border rounded-xl focus:ring-primary/20">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="movie">Movies</SelectItem>
                      <SelectItem value="series">Series</SelectItem>
                      <SelectItem value="anime">Anime</SelectItem>
                    </SelectContent>
                  </Select>

                  <Badge className="bg-primary text-black font-black px-4 py-2 rounded-xl shadow-lg shadow-primary/20 ml-auto">
                    {items.filter(i => 
                      (watchlistFilterStatus === 'all' || i.status === watchlistFilterStatus || (watchlistFilterStatus === 'plan-to-watch' && i.status === 'plan_to_watch')) && 
                      (watchlistFilterType === 'all' || i.type === watchlistFilterType) &&
                      (watchlistGenreFilter === 'all' || (i.genreIds && i.genreIds.includes(watchlistGenreFilter as number)))
                    ).length} ITEMS
                  </Badge>
                </div>
              </div>

              {/* Genre Filter Chips */}
              {availableGenreIds.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-4">
                  <button
                    onClick={() => setWatchlistGenreFilter('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      watchlistGenreFilter === 'all'
                        ? 'bg-primary text-black shadow-lg shadow-primary/20'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border border-border'
                    }`}
                  >
                    ALL GENRES
                  </button>
                  {availableGenreIds.map(id => (
                    <button
                      key={id}
                      onClick={() => setWatchlistGenreFilter(id)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                        watchlistGenreFilter === id
                          ? 'bg-primary text-black shadow-lg shadow-primary/20'
                          : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border border-border'
                      }`}
                    >
                      {TMDB_GENRE_MAP[id] || 'Other'}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-6">
                {items.filter(i => 
                  (watchlistFilterStatus === 'all' || i.status === watchlistFilterStatus || (watchlistFilterStatus === 'plan-to-watch' && i.status === 'plan_to_watch')) && 
                  (watchlistFilterType === 'all' || i.type === watchlistFilterType) &&
                  (watchlistGenreFilter === 'all' || (i.genreIds && i.genreIds.includes(watchlistGenreFilter as number)))
                ).length > 0 ? (
                  items.filter(i => 
                    (watchlistFilterStatus === 'all' || i.status === watchlistFilterStatus || (watchlistFilterStatus === 'plan-to-watch' && i.status === 'plan_to_watch')) && 
                    (watchlistFilterType === 'all' || i.type === watchlistFilterType) &&
                    (watchlistGenreFilter === 'all' || (i.genreIds && i.genreIds.includes(watchlistGenreFilter as number)))
                  ).map((item, idx) => (
                    <Card 
                      key={`${item.id}-${idx}`} 
                      className="bg-card/40 border-border backdrop-blur-md hover:border-primary/30 transition-all group overflow-hidden rounded-[2rem] shadow-2xl"
                    >
                      <CardContent className="p-6 flex items-center gap-8">
                        <div 
                          className="w-24 h-36 rounded-2xl overflow-hidden shrink-0 bg-muted cursor-pointer shadow-2xl relative group/poster"
                          onClick={() => {
                            handleSelectItem({ id: item.externalId, media_type: item.type === 'series' ? 'tv' : 'movie', genreIds: item.genreIds });
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
                            <Badge variant="outline" className="text-[10px] uppercase border-border text-muted-foreground font-black tracking-widest px-2 py-0.5">
                              {item.type}
                            </Badge>
                          </div>
                          
                          {/* Genre Badges */}
                          {item.genreIds && item.genreIds.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {item.genreIds.slice(0, 3).map(id => (
                                <Badge 
                                  key={id} 
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWatchlistGenreFilter(id);
                                  }}
                                  className="bg-white/5 hover:bg-primary/20 hover:text-primary text-[9px] font-black uppercase tracking-tighter cursor-pointer transition-colors border border-border"
                                >
                                  {TMDB_GENRE_MAP[id] || 'Other'}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="space-y-4">
                            <div className="flex items-center gap-6 text-xs font-black uppercase tracking-widest">
                              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                                item.status === 'watching' 
                                  ? 'bg-primary/10 text-primary border-primary/20' 
                                  : item.status === 'completed'
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : 'bg-white/5 text-muted-foreground border-border'
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
                                  className="h-2 bg-card progress-gradient" 
                                />
                                <div className="flex justify-end">
                                  <span className="text-[10px] text-primary font-black tracking-widest">{Math.round(((item.currentEpisode || 0) / item.totalEpisodes) * 100)}% COMPLETE</span>
                                </div>
                              </div>
                            )}
                            {item.status === 'completed' && (
                              <div className="flex items-center gap-3 mt-4 bg-white/5 p-3 rounded-2xl border border-border w-max">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Your Rating</span>
                                <StarRating 
                                  rating={item.rating || 0} 
                                  max={5} 
                                  onRatingChange={(newRating) => updateItemRating(item.id, newRating)} 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.type !== 'movie' && (
                            <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-border">
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
                    <div className="w-24 h-24 bg-card/50 rounded-full flex items-center justify-center mx-auto border border-border">
                      <Clock className="w-10 h-10 text-zinc-700" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-black text-muted-foreground">Your watchlist is empty</p>
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
                      <Bell className="w-6 h-6 text-primary" />
                      Release Reminders
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium">Get notified when these items are released</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reminders.length > 0 ? (
                    reminders.map((reminder) => (
                      <Card 
                        key={reminder.id} 
                        className="bg-card/40 border-border backdrop-blur-md hover:border-amber-500/30 transition-all group overflow-hidden rounded-[2rem] shadow-2xl"
                      >
                        <CardContent className="p-5 flex items-center gap-6">
                          <div className="w-16 h-24 rounded-xl overflow-hidden shrink-0 bg-muted shadow-xl">
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
                            <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest">
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
                                handleFirestoreError(error, OperationType.DELETE, `reminders/${reminder.id}`);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center space-y-4 bg-card/20 rounded-[2rem] border border-border">
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
                  <p className="text-muted-foreground text-sm font-medium">Your completed cinematic journeys</p>
                </div>
                <Badge className="bg-emerald-500 text-black font-black px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20">
                  {items.filter(i => i.status === 'completed').length} WATCHED
                </Badge>
              </div>

              <div className="grid gap-8">
                {items.filter(i => i.status === 'completed').length > 0 ? (
                  items.filter(i => i.status === 'completed').map((item, idx) => (
                    <Card 
                      key={`${item.id}-${idx}`} 
                      className="bg-card/40 border-border backdrop-blur-md overflow-hidden rounded-[2.5rem] shadow-2xl group"
                    >
                      <CardContent className="p-8 flex gap-8">
                        <div 
                          className="w-32 h-48 rounded-2xl overflow-hidden shrink-0 shadow-2xl cursor-pointer relative group/poster"
                          onClick={() => {
                            handleSelectItem({ id: item.externalId, media_type: item.type === 'series' ? 'tv' : 'movie', genreIds: item.genreIds });
                          }}
                        >
                          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/poster:opacity-100 transition-opacity z-10 flex items-center justify-center">
                            <Info className="w-10 h-10 text-white" />
                          </div>
                          {item.posterUrl ? (
                            <img src={item.posterUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" alt={item.title} />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center"><Film className="w-12 h-12 text-zinc-700" /></div>
                          )}
                        </div>
                        <div className="flex-1 space-y-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="text-3xl font-black tracking-tighter leading-none">{item.title}</h3>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mt-3">
                                {item.type} • COMPLETED 
                                {item.type !== 'movie' && ` • ${item.totalEpisodes} EPISODES`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20 shadow-lg shadow-primary/5">
                              <StarRating 
                                rating={item.rating || 0} 
                                max={5} 
                                onRatingChange={(newRating) => updateItemRating(item.id, newRating)} 
                              />
                            </div>
                          </div>
                          {item.notes && (
                            <div className="bg-white/5 p-5 rounded-3xl border border-border italic text-muted-foreground text-sm leading-relaxed relative">
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
                    <div className="w-24 h-24 bg-card/50 rounded-full flex items-center justify-center mx-auto border border-border">
                      <History className="w-10 h-10 text-zinc-700" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-black text-muted-foreground">No watch history yet</p>
                      <p className="text-zinc-600 text-sm max-w-xs mx-auto">Start your cinematic journey and track your progress here!</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'upcoming' && (
            <motion.div
              key="upcoming"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <div className="flex items-center justify-between px-4 md:px-0">
                <div className="space-y-1">
                  <h2 className="text-4xl font-black tracking-tighter">Coming Soon</h2>
                  <p className="text-muted-foreground text-sm font-medium">Be the first to watch the latest releases</p>
                </div>
              </div>
              
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                <UpcomingContent 
                    onItemClick={(item) => {
                        handleSelectItem(item);
                    }} 
                    onSeeMore={() => setActiveTab('explore')}
                />
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
                <p className="text-muted-foreground text-sm font-medium">Personalize your cinematic experience</p>
              </div>
              
              <Card className="bg-card/40 border-border backdrop-blur-md overflow-hidden rounded-[2.5rem] shadow-2xl">
                <CardContent className="p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                      <Palette className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">Visual Theme</h3>
                      <p className="text-sm text-muted-foreground font-medium">Choose a style that matches your vibe</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    {[
                      { id: 'default', label: 'Cinematic Dark', icon: '🎬', color: 'bg-[#0B0B0F]' },
                      { id: 'cyber', label: 'Neon Cyber', icon: '🌌', color: 'bg-background' },
                      { id: 'minimal', label: 'Minimal Clean', icon: '🌿', color: 'bg-[#F8F9FA]' },
                      { id: 'amoled', label: 'AMOLED Black', icon: '🖤', color: 'bg-[#000000]' },
                      { id: 'custom', label: 'Custom Theme', icon: '🎨', color: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => changeTheme(t.id as any)}
                        className={`relative group p-6 rounded-3xl border-2 transition-all text-left ${
                          theme === t.id 
                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5 scale-[1.02]' 
                            : 'border-border hover:border-white/20 bg-white/5'
                        }`}
                      >
                        <div className="flex flex-col gap-4">
                          <span className="text-3xl drop-shadow-lg">{t.icon}</span>
                          <div>
                            <p className="text-sm font-black tracking-tight">{t.label}</p>
                            <div className={`w-full h-1.5 mt-3 rounded-md ${t.color} border border-border`} />
                          </div>
                        </div>
                        {theme === t.id && (
                          <div className="absolute top-3 right-3">
                            <div className="bg-primary p-1 rounded-md shadow-lg">
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
                      className="mt-6 p-6 bg-white/5 rounded-3xl border border-border space-y-6"
                    >
                      <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Customize Colors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Background</label>
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
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Primary Accent</label>
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
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Text (Foreground)</label>
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
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Card Background</label>
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

              <Card className="bg-card/40 border-border backdrop-blur-md overflow-hidden rounded-[2.5rem] shadow-2xl">
                <CardContent className="p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                      <LogOut className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">Account</h3>
                      <p className="text-sm text-muted-foreground font-medium">Manage your profile and session</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-border">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-amber to-amber-600 flex items-center justify-center font-black text-xl text-black shadow-xl">
                        {user?.displayName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-lg tracking-tight">{user?.displayName}</p>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{user?.email}</p>
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
            <StatsDashboard items={items} stats={stats} avgRating={avgRating ?? 0} />
          )}
        </AnimatePresence>

        {/* AI Recommendation Modal */}
        <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
          <DialogContent className="bg-background border-border text-white sm:max-w-lg overflow-hidden p-0">
            {isAiLoading ? (
              <div className="p-16 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-md animate-pulse" />
                  <div className="p-8 rounded-md bg-white/5 border border-border backdrop-blur-md relative z-10">
                    <Sparkles className="w-16 h-16 text-primary animate-bounce" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tighter">Consulting the AI Oracle...</h2>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto font-medium">Analyzing your request to find your perfect match.</p>
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
                    <Badge className="bg-primary text-black font-black px-4 py-2 rounded-xl shadow-lg shadow-primary/20 text-lg uppercase tracking-widest font-display">
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
                    className="text-5xl font-black tracking-tighter mb-4 cursor-pointer hover:text-primary transition-all duration-300 leading-none font-display uppercase"
                    onClick={() => {
                      if (aiRecommendations[currentAiIndex]?.item) {
                        handleSelectItem(aiRecommendations[currentAiIndex].item);
                      }
                    }}
                  >
                    {aiRecommendations[currentAiIndex]?.item?.title || aiRecommendations[currentAiIndex]?.item?.name || 'Unknown Title'}
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
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mb-3">Available On</p>
                      <div className="flex gap-3">
                        {aiRecommendations[currentAiIndex].providers.slice(0, 5).map((p: any) => (
                          <div key={p.provider_id} className="w-10 h-10 rounded-xl overflow-hidden border border-border shadow-lg group relative" title={p.provider_name}>
                            <img src={`https://image.tmdb.org/t/p/original${p.logo_path}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={p.provider_name} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mb-6">
                    <Button 
                      className="flex-1 bg-gradient-to-r from-brand-amber to-amber-600 hover:from-amber-400 hover:to-brand-amber text-black font-black h-14 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                      onClick={() => {
                        addFromTMDB({ ...aiRecommendations[currentAiIndex].item, media_type: aiRecommendations[currentAiIndex].type });
                        setIsAiModalOpen(false);
                      }}
                    >
                      <Plus className="w-6 h-6 mr-2" /> Add to Watchlist
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-14 px-6 rounded-2xl border-border bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
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
                  
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Not quite right? Refine search:</p>
                    <div className="flex gap-2">
                      <Input 
                        value={aiFeedback}
                        onChange={(e) => setAiFeedback(e.target.value)}
                        placeholder="e.g., 'more action', 'less romance', 'darker'..."
                        className="h-12 bg-white/5 border-border rounded-xl font-bold focus-visible:ring-primary"
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
                  <p className="text-muted-foreground font-medium">Describe what you want to watch...</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <textarea 
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      placeholder="e.g., Dark emotional anime under 30 mins, Exciting action movie like John Wick..."
                      className="w-full h-32 bg-card/50 border border-border focus:border-primary/50 focus:ring-primary/20 rounded-2xl p-4 text-lg font-medium text-white resize-none transition-all placeholder:text-zinc-600"
                    />
                  </div>

                  <Button 
                    className="w-full bg-gradient-to-r from-brand-amber to-amber-600 hover:from-amber-400 hover:to-brand-amber text-black font-black h-16 rounded-2xl shadow-2xl shadow-primary/20 text-xl mt-4 transition-all hover:scale-[1.02] active:scale-95"
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
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle>Rate your experience</DialogTitle>
            <DialogDescription className="text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
                {newRating === 0 ? 'Select a rating' : `${newRating}/5 stars`}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Review / Notes (Optional)</label>
              <textarea 
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="What did you think?"
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => confirmCompletion(newRating)} 
              className="w-full bg-primary hover:bg-amber-600 text-black font-bold"
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
        favoriteEpisodes={items.find(i => i.externalId === selectedItem?.id)?.favoriteEpisodes || []}
        onMarkEpisodeWatched={onMarkEpisodeWatched}
        onToggleFavorite={onToggleFavoriteEpisode}
        userProfile={profileService.getProfile()}
        onToggleReminder={toggleReminder}
        reminders={reminders}
        onWatchTrailer={(key) => {
           setTrailerKey(key);
           setTrailerModalOpen(true);
        }}
      />

      {trailerModalOpen && trailerKey && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
          <button
            className="absolute top-6 right-6 text-white hover:text-zinc-400 p-2 rounded-full bg-white/5 hover:bg-white/10 transition z-[10001] flex items-center gap-2 font-bold text-sm"
            onClick={() => {
              setTrailerModalOpen(false);
              setTrailerKey(null);
            }}
          >
            <X className="w-6 h-6" /> Close
          </button>

          {!trailerKey ? (
            <p className="text-white font-bold">No trailer available</p>
          ) : (
            <div className="w-full max-w-6xl aspect-video relative rounded-3xl overflow-hidden shadow-2xl z-[10000]">
              <div 
                 className="absolute inset-0 bg-black cursor-pointer group"
                 onClick={(e) => {
                   const target = e.currentTarget;
                   const iframe = document.createElement('iframe');
                   iframe.src = `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=0&controls=1&rel=0`;
                   iframe.allow = "autoplay; encrypted-media";
                   iframe.allowFullscreen = true;
                   iframe.className = "w-full h-full absolute inset-0 z-20 border-none bg-black";
                   target.replaceWith(iframe);
                 }}
              >
                 <img 
                   src={`https://img.youtube.com/vi/${trailerKey}/hqdefault.jpg`} 
                   className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                   alt="Trailer thumbnail"
                 />
                 <div className="absolute inset-0 mt-[100px] pointer-events-none bg-gradient-to-t from-black to-transparent" />
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-[0_0_40px_rgba(255,0,0,0.4)] group-hover:scale-110 transition-transform">
                   <Play className="w-8 h-8 ml-1 fill-white" />
                 </div>
              </div>
            </div>
          )}
        </div>
      )}

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
    <div className="min-h-screen bg-surface-bg text-white flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,191,0,0.05),transparent_70%)]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-4xl relative z-10"
      >
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-12 shadow-[0_0_50px_rgba(255,191,0,0.3)] amber-glow"
        >
          <Film className="w-12 h-12 text-black" />
        </motion.div>
        
        <h1 className="text-6xl md:text-9xl font-black tracking-[-0.05em] mb-8 font-display uppercase leading-[0.9]">
          Cinematic <br /> <span className="text-primary">Excellence.</span>
        </h1>
        
        <p className="text-white/40 text-xl md:text-2xl mb-14 leading-relaxed max-w-2xl mx-auto font-medium">
          The curated sanctuary for your media journey. 
          Track, discover, and refine your cinematic legacy with AI.
        </p>
        
        <div className="flex flex-col items-center gap-8">
          <Button 
            onClick={login} 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-black font-black h-20 px-12 text-xl rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 font-display uppercase tracking-widest amber-glow"
          >
            Begin Your Odyssey
          </Button>
          
          <div className="flex items-center gap-4 text-white/20 uppercase tracking-[0.3em] text-[10px] font-black">
            <span className="w-12 h-px bg-white/10" />
            Join 10,000+ Cinephiles
            <span className="w-12 h-px bg-white/10" />
          </div>
        </div>
      </motion.div>

      {/* Cinematic Overlays */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black to-transparent opacity-50" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent opacity-50" />
    </div>
  );
}

// --- App Root ---


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
                      const genreName = TMDB_GENRE_MAP[g];
                      if (genreName) {
                         reasons.push(`Because you like ${genreName}`);
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
             <div key={`${item.id}-${index}`} className="snap-start flex-shrink-0 w-40 flex flex-col gap-2">
                 <MediaCard 
                    item={item} 
                    type={item.media_type || (item.name ? 'tv' : 'movie')} 
                    onClick={() => onItemClick(item)}
                 />
                 <div className="flex flex-col gap-1 px-1 mt-2">
                   <div className="text-[#00ff88] text-xs font-bold">
                     {Math.min(99, Math.floor(Math.max((item.score || 0) * 1.5 + 70, 75)))}% Match
                   </div>
                 </div>
             </div>
         ))}
      </div>
    </div>
  );
}

export function BingePacksRow({ onItemClick }: { onItemClick: (item: any) => void }) {
  const [packs, setPacks] = useState<BingePack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     async function fetchPicks() {
        setLoading(true);
        try {
           const profile = profileService.getProfile();
           const generated = await bingePackService.generateForUser(profile);
           setPacks(generated);
        } catch (e) {
           console.error(e);
        } finally {
           setLoading(false);
        }
     }
     fetchPicks();
  }, []);

  if (loading) return <div className="animate-pulse h-[400px] bg-white/5 rounded-xl block w-full mb-8" />;
  if (!packs.length) return null;

  return (
    <div className="flex flex-col gap-12 my-12">
      {packs.map((pack) => (
         <div key={pack.id} className="binge-pack-container flex flex-col gap-4 px-4 md:px-8">
             <div className="flex flex-col">
                 <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">{pack.title}</h2>
                 <p className="text-white/60 mb-2 font-medium">{pack.description}</p>
                 <div className="flex gap-2 mb-3 items-center flex-wrap">
                    {pack.tags.map((tag, i) => (
                      <span key={i} className="text-[10px] uppercase font-bold tracking-wider bg-white/10 px-2 py-1 rounded-sm text-white/80">{tag}</span>
                    ))}
                 </div>
                 <div className="text-[#00ff88] text-xs font-bold mt-2">
                    {Math.min(99, Math.floor(Math.random() * 5 + 92))}% Match
                 </div>
             </div>
             
             <div className="flex gap-4 overflow-x-auto pb-8 pt-4 scrollbar-hide snap-x -mx-4 px-4 md:mx-0 md:px-0">
                 {pack.items.map((item, idx) => (
                     <div key={`${item.id}-${idx}`} className="snap-start flex-shrink-0 w-32 md:w-36 lg:w-40 relative group">
                        <div 
                          className="absolute -left-4 -bottom-6 text-[80px] font-black z-20 pointer-events-none group-hover:-translate-y-2 transition-transform duration-300 drop-shadow-2xl"
                          style={{ WebkitTextStroke: '2px rgba(255,255,255,0.8)', color: 'transparent', lineHeight: '1' }}
                        >
                          {idx + 1}
                        </div>
                        <div className="relative z-10 w-full">
                          <MediaCard item={item} type={pack.id === 'anime_binge' ? 'anime' : 'movie'} onClick={() => onItemClick(item)} />
                        </div>
                     </div>
                 ))}
             </div>
         </div>
      ))}
    </div>
  );
}

import { Intro } from './components/Intro';
import { AIRecommendationCarousel } from './components/AIRecommendationCarousel';

export default function App() {
  return (
    <ActiveProvider>
      <AuthProvider>
        <Intro />
        <AppContent />
      </AuthProvider>
    </ActiveProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => setLoaded(true), 200);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-2 border-primary/10 border-t-brand-amber rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${loaded ? "loaded" : ""}`}>
      {user ? <MediaTracker /> : <LandingPage />}
    </div>
  );
}
