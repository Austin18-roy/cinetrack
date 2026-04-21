import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { GenreRow } from '../App';

export const REGION_LANG_MAP = {
  asia: {
    icon: '🌏',
    label: 'Asian Content',
    languages: [
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'th', name: 'Thai' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'te', name: 'Telugu' },
      { code: 'ml', name: 'Malayalam' }
    ]
  },
  europe: {
    icon: '🌍',
    label: 'European Content',
    languages: [
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'es', name: 'Spanish' },
      { code: 'it', name: 'Italian' },
      { code: 'nl', name: 'Dutch' }
    ]
  },
  america: {
    icon: '🌎',
    label: 'American Content',
    languages: [
      { code: 'en', name: 'English (US)' },
      { code: 'es', name: 'Spanish (LatAm)' },
      { code: 'pt', name: 'Portuguese (Brazil)' }
    ]
  },
  africa: {
    icon: '🌍',
    label: 'African Content',
    languages: [
      { code: 'sw', name: 'Swahili' },
      { code: 'am', name: 'Amharic' },
      { code: 'ha', name: 'Hausa' }
    ]
  }
};

export function RegionAccordion({ onItemClick, onSeeMore }: { onItemClick: (item: any) => void, onSeeMore: (genre: any) => void }) {
  const [expandedRegions, setExpandedRegions] = useState<string[]>(['asia']); // Default expand Asia

  const toggleRegion = (regionKey: string) => {
    setExpandedRegions(prev => 
      prev.includes(regionKey) ? prev.filter(k => k !== regionKey) : [...prev, regionKey]
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {Object.entries(REGION_LANG_MAP).map(([key, region]) => (
        <div key={key} className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden">
          <button 
            className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
            onClick={() => toggleRegion(key)}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{region.icon}</span>
              <h3 className="text-2xl font-black">{region.label}</h3>
            </div>
            {expandedRegions.includes(key) ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
          </button>
          
          <AnimatePresence>
            {expandedRegions.includes(key) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 pt-0 space-y-12">
                  {region.languages.map(lang => (
                    <GenreRow 
                      key={lang.code}
                      title={`${lang.name} Movies & Series`}
                      type="movie"
                      language={lang.code}
                      onItemClick={onItemClick}
                      onSeeMore={() => onSeeMore({
                        name: `${lang.name} Content`,
                        type: 'movie',
                        language: lang.code
                      })}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
