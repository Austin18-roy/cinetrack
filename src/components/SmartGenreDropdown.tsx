import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiService } from '../services/aiService';
import { Loader2, Sparkles, Search, X } from 'lucide-react';

export function SmartGenreDropdown({ 
  genres, 
  selectedGenres, 
  toggleGenre,
  onClear
}: { 
  genres: { id: number | string, name: string }[], 
  selectedGenres: (number | string)[], 
  toggleGenre: (id: number | string) => void,
  onClear: () => void
}) {
  const [open, setOpen] = useState(false);
  const [isSmartFiltering, setIsSmartFiltering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSmartFilter = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSmartFiltering(true);
    setOpen(true);
    try {
      const lowerQuery = searchQuery.toLowerCase();
      
      let suggestedStr = "[]";
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const apiKey = typeof process.env.GEMINI_API_KEY === 'string' ? process.env.GEMINI_API_KEY : (import.meta as any).env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            const genAI = new GoogleGenAI({ apiKey });
            const prompt = `User query: "${searchQuery}". Available genres: ${genres.map(g => g.name).join(', ')}. Which 1-3 genres fit best? Return ONLY a valid JSON array of strings exactly matching the available genres. No markdown, no other text.`;
            const response = await genAI.models.generateContent({
               model: 'gemini-3.5-flash',
               contents: prompt
            });
            suggestedStr = response.text || "[]";
        }
      } catch (e) {
         console.warn("AI Smart Genre failed, falling back to basic matching", e);
      }
      
      let parsed = [];
      try {
        parsed = JSON.parse(suggestedStr.replace(/```json/g, '').replace(/```/g, '').trim());
      } catch (e) {
        // Fallback local search
        parsed = genres.filter(g => g.name.toLowerCase().includes(lowerQuery)).map(g => g.name);
      }

      if (parsed.length > 0) {
        onClear(); // Clear existing
        parsed.forEach((genreName: string) => {
          const match = genres.find(g => g.name === genreName);
          if (match) toggleGenre(match.id);
        });
      } else {
        // Fallback exact match
        const localMatches = genres.filter(g => lowerQuery.includes(g.name.toLowerCase()));
        if (localMatches.length > 0) {
           onClear();
           localMatches.forEach(m => toggleGenre(m.id));
        }
      }
    } catch (e) {
       console.error("Smart filter error", e);
    }
    setIsSmartFiltering(false);
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ zIndex: 9999 }}>
      
      <div className="flex flex-wrap items-center gap-2">
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-bold text-sm tracking-wider uppercase transition-all"
          onClick={() => setOpen(!open)}
        >
          Genres <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>
        
        {/* Chips */}
        <AnimatePresence>
            {selectedGenres.map(id => {
                const name = genres.find(g => g.id === id)?.name;
                if (!name) return null;
                return (
                    <motion.span 
                        key={id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="bg-primary/20 text-primary px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1 cursor-pointer hover:bg-primary/30 transition-colors"
                        onClick={() => toggleGenre(id)}
                    >
                        {name} <X className="w-3 h-3 ml-1" />
                    </motion.span>
                );
            })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
           <motion.div
             initial={{ opacity: 0, y: -10, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: -10, scale: 0.95 }}
             transition={{ duration: 0.2 }}
             className="absolute top-[110%] left-0 bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 w-[320px] shadow-[0_20px_60px_rgba(0,0,0,0.9)]"
           >
             {/* Smart Filter Input */}
             <div className="relative mb-4 group">
               <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                 {isSmartFiltering ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Sparkles className="w-4 h-4 text-primary opacity-50 group-focus-within:opacity-100" />}
               </div>
               <input 
                 type="text"
                 placeholder="E.g., 'Space thriller', 'feel good'"
                 className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-primary/50 text-white text-sm rounded-xl py-2.5 pl-9 pr-24 outline-none transition-all"
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSmartFilter()}
               />
               <button 
                 className="absolute inset-y-1.5 right-1.5 bg-primary hover:bg-primary/80 text-white text-[10px] font-black uppercase tracking-widest px-3 rounded-lg transition-colors flex items-center disabled:opacity-50"
                 onClick={handleSmartFilter}
                 disabled={isSmartFiltering || !searchQuery.trim()}
               >
                 Smart
               </button>
             </div>

             <div className="max-h-[300px] overflow-y-auto no-scrollbar grid grid-cols-2 gap-1.5 pr-2">
               {genres.map(g => {
                 const isActive = selectedGenres.includes(g.id);
                 return (
                   <div
                     key={g.id}
                     className={`px-3 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                       isActive 
                         ? "bg-primary text-white shadow-md" 
                         : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                     }`}
                     onClick={() => toggleGenre(g.id)}
                   >
                     {g.name}
                   </div>
                 );
               })}
             </div>
             
             {selectedGenres.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{selectedGenres.length} Selected</span>
                    <button onClick={onClear} className="text-[10px] font-black text-white hover:text-primary uppercase tracking-widest transition-colors">Clear All</button>
                </div>
             )}
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
