import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HistoryState {
  history: Record<string, string>; // mangaId -> lastReadChapterId
  setLastRead: (mangaId: string, chapterId: string) => void;
  getChapter: (mangaId: string) => string | undefined;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: {},
      setLastRead: (mangaId, chapterId) => set((state) => ({
        history: { ...state.history, [mangaId]: chapterId }
      })),
      getChapter: (mangaId) => get().history[mangaId]
    }),
    {
      name: 'manga-history',
    }
  )
);
