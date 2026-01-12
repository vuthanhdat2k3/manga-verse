'use client';

import { useQuery } from '@tanstack/react-query';
import { getMangas } from '@/services/api';
import { MangaCard } from '@/components/MangaCard';
import { Input } from "@/components/ui/input"
import { Search } from 'lucide-react';
import { useState } from 'react';

export default function Home() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mangas', page, search],
    queryFn: () => getMangas(page, search),
    placeholderData: (prev) => prev
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4 md:px-6">
          <a href="/" className="flex items-center gap-2 font-bold text-2xl mr-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
            MangaVerse
          </a>
          <nav className="hidden md:flex gap-6 text-sm font-medium mr-6">
            <a href="/" className="text-foreground hover:text-primary transition-colors">
              Home
            </a>
            <a href="/search" className="text-muted-foreground hover:text-foreground transition-colors">
              Search
            </a>
          </nav>
          <div className="flex flex-1 items-center justify-end md:justify-center">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                   type="search"
                   placeholder="Search manga..." 
                   className="pl-8 bg-muted/50 focus:bg-background transition-colors"
                   value={search} 
                   onChange={(e) => setSearch(e.target.value)}
                />
             </div>
          </div>
        </div>
      </header>

      <main className="container px-4 md:px-6 py-8 space-y-8">
        <div>
           <h2 className="text-3xl font-bold tracking-tight mb-2">Popular Updates</h2>
           <p className="text-muted-foreground">The latest manga updates from our collection.</p>
        </div>

        {isLoading ? (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
               {[...Array(10)].map((_, i) => (
                   <div key={i} className="aspect-[2/3] bg-muted/20 animate-pulse rounded-xl" />
               ))}
           </div>
        ) : isError ? (
           <div className="text-center py-20 text-destructive">
               Failed to load mangas. Is the backend running?
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {data?.data.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
