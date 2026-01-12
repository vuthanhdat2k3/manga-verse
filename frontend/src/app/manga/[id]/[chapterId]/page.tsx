'use client';
import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChapterImages } from '@/services/api';
import { useParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function ChapterReader() {
  const params = useParams();
  const mangaId = params?.id as string;
  const chapterId = params?.chapterId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [lastTap, setLastTap] = useState(0);
  const [tapIndicator, setTapIndicator] = useState(false);
  
  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter', mangaId, chapterId],
    queryFn: () => getChapterImages(mangaId, chapterId),
    enabled: !!mangaId && !!chapterId
  });

  // Save last read chapter
  useEffect(() => {
    if (mangaId && chapterId) {
      localStorage.setItem(`lastRead_${mangaId}`, chapterId);
    }
  }, [mangaId, chapterId]);

  // Auto-prefetch next chapter
  useEffect(() => {
    if (chapter?.navigation?.next) {
      const nextChapterId = chapter.navigation.next.id;
      
      // Prefetch next chapter data
      queryClient.prefetchQuery({
        queryKey: ['chapter', mangaId, nextChapterId],
        queryFn: () => getChapterImages(mangaId, nextChapterId),
        staleTime: 10 * 60 * 1000, // 10 minutes
      });
      
      console.log(`🔄 Auto-prefetching next chapter: ${nextChapterId}`);
    }
  }, [chapter, mangaId, queryClient]);

  // Double-tap to navigate
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap;
    
    if (timeSinceLastTap < 500 && timeSinceLastTap > 0) {
      // Double tap detected
      if (chapter?.navigation?.next) {
        // Show indicator
        setTapIndicator(true);
        setTimeout(() => setTapIndicator(false), 300);
        
        // Navigate to next chapter
        router.push(`/manga/${mangaId}/${chapter.navigation.next.id}`);
      }
    }
    
    setLastTap(now);
  }, [lastTap, chapter, mangaId, router]);

  if (isLoading) return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-white gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
          Loading Chapter...
      </div>
  );

  if (!chapter) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Chapter not found</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
        {/* Sticky Header */}
        <header className="fixed top-0 inset-x-0 h-16 bg-black/90 backdrop-blur-md z-50 flex items-center justify-between px-4 md:px-6 border-b border-white/10 shadow-2xl transition-transform duration-300">
            <Link href={`/manga/${mangaId}`} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors group">
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium hidden md:inline">Back</span>
            </Link>
            
            <h1 className="text-base font-medium truncate max-w-[200px] md:max-w-md text-center px-4">
                {chapterId}
            </h1>
            
            <div className="flex gap-2">
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={!chapter.navigation?.prev}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => router.push(`/manga/${mangaId}/${chapter.navigation?.prev?.id}`)}
                 >
                    <ChevronLeft className={`w-6 h-6 ${!chapter.navigation?.prev ? 'opacity-20' : ''}`} />
                 </Button>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={!chapter.navigation?.next}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => router.push(`/manga/${mangaId}/${chapter.navigation?.next?.id}`)}
                 >
                    <ChevronRight className={`w-6 h-6 ${!chapter.navigation?.next ? 'opacity-20' : ''}`} />
                 </Button>
            </div>
        </header>

        {/* Reader Area with Double-tap */}
        <div 
          className="max-w-3xl mx-auto pt-16 pb-32 min-h-screen bg-neutral-900 shadow-2xl relative"
          onClick={handleDoubleTap}
        >
            {/* Double-tap indicator */}
            {tapIndicator && (
              <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div className="bg-primary/90 text-primary-foreground px-8 py-4 rounded-full text-lg font-bold animate-in fade-in zoom-in duration-200">
                  Next Chapter →
                </div>
              </div>
            )}

            {chapter.images && chapter.images.length > 0 ? (
                chapter.images.map((url, idx) => (
                    <img 
                        key={idx} 
                        src={url} 
                        alt={`Page ${idx + 1}`} 
                        className="w-full h-auto block select-none"
                        loading="lazy"
                    />
                ))
            ) : (
                <div className="p-20 text-center text-white/50">No images found for this chapter.</div>
            )}
        </div>

        {/* Bottom Navigation - Hidden on Mobile */}
        <div className="hidden md:block fixed bottom-8 left-1/2 -translate-x-1/2 z-40 transition-opacity duration-300">
             {chapter.navigation?.next ? (
                 <Button 
                    onClick={() => router.push(`/manga/${mangaId}/${chapter.navigation?.next?.id}`)}
                    className="rounded-full px-8 py-6 shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg"
                 >
                    Next Chapter <ChevronRight className="ml-2 w-5 h-5" />
                 </Button>
             ) : (
                 <div className="bg-black/80 backdrop-blur px-6 py-3 rounded-full border border-white/10 text-sm font-medium text-white/70">
                     You've reached the end
                 </div>
             )}
        </div>

        {/* Mobile hint */}
        {chapter.navigation?.next && (
          <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <div className="bg-black/70 backdrop-blur px-4 py-2 rounded-full border border-white/20 text-xs text-white/60 animate-pulse">
              Double-tap to next chapter
            </div>
          </div>
        )}
    </div>
  );
}
