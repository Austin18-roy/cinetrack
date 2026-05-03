import { create } from "zustand";

interface AppState {
  user: {
    genreScore: Record<number, number>;
    watchHistory: number[];
  };
  updateUserParams: (genres: number[], itemId: number) => void;
  // contentCache
  contentCache: Record<string, any>;
  setContent: (id: string, data: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: {
    genreScore: {},
    watchHistory: [],
  },
  
  contentCache: {},
  
  setContent: (id: string, data: any) =>
    set((state) => ({
      contentCache: { ...state.contentCache, [id]: data },
    })),
    
  updateUserParams: (genres: number[], itemId: number) =>
    set((state) => {
      const genreScore = { ...state.user.genreScore };
      genres.forEach((g) => {
        genreScore[g] = (genreScore[g] || 0) + 1;
      });
      const watchHistory = state.user.watchHistory.includes(itemId) 
        ? state.user.watchHistory 
        : [...state.user.watchHistory, itemId];
        
      return {
        user: {
          ...state.user,
          genreScore,
          watchHistory,
        },
      };
    }),
}));
