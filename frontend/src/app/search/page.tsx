'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { searchManga, crawlFromUrl } from '@/services/api';
import { MangaCard } from '@/components/MangaCard';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Link2, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [url, setUrl] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [crawledManga, setCrawledManga] = useState<any>(null);

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: (keyword: string) => searchManga(keyword),
    onSuccess: (data) => {
      setSearchResults(data.results || []);
      setCrawledManga(null); // Clear crawl results
    },
  });

  // Crawl mutation
  const crawlMutation = useMutation({
    mutationFn: (url: string) => crawlFromUrl(url),
    onSuccess: (data) => {
      setCrawledManga(data.manga);
      setSearchResults([]); // Clear search results
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      searchMutation.mutate(keyword.trim());
    }
  };

  const handleCrawl = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      crawlMutation.mutate(url.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4 md:px-6">
          <a href="/" className="flex items-center gap-2 font-bold text-2xl mr-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
            MangaVerse
          </a>
          <nav className="flex gap-6 text-sm font-medium">
            <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </a>
            <a href="/search" className="text-foreground">
              Search
            </a>
          </nav>
        </div>
      </header>

      <main className="container px-4 md:px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Search & Import Manga</h1>
          <p className="text-muted-foreground">Search NetTruyen or crawl directly from URL</p>
        </div>

        {/* Search & Crawl Forms */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Search Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search on NetTruyen
              </CardTitle>
              <CardDescription>
                Enter a manga title to search on NetTruyen.me.uk
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., One Piece, Naruto..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    disabled={searchMutation.isPending}
                  />
                  <Button type="submit" disabled={searchMutation.isPending || !keyword.trim()}>
                    {searchMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </>
                    )}
                  </Button>
                </div>
                
                {searchMutation.isError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    <span>Search failed. Please try again.</span>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Crawl Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Crawl from URL
              </CardTitle>
              <CardDescription>
                Paste a NetTruyen manga URL or manga ID to import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCrawl} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://nettruyen.me.uk/truyen-tranh/one-piece"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={crawlMutation.isPending}
                  />
                  <Button type="submit" disabled={crawlMutation.isPending || !url.trim()}>
                    {crawlMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Crawling...
                      </>
                    ) : (
                      <>
                        <Link2 className="mr-2 h-4 w-4" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
                
                {crawlMutation.isError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    <span>Crawl failed. Check the URL and try again.</span>
                  </div>
                )}
                
                {crawledManga && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 p-3 rounded-md">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Successfully imported: <strong>{crawledManga.title}</strong></span>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Search Results ({searchResults.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchResults([])}
              >
                Clear
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {searchResults.map((manga) => (
                <MangaCard key={manga.id} manga={manga} />
              ))}
            </div>
          </div>
        )}

        {/* Crawled Manga Detail */}
        {crawledManga && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Imported Manga</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCrawledManga(null)}
              >
                Clear
              </Button>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-[200px_1fr] gap-6">
                  {/* Cover */}
                  <div className="aspect-[2/3] relative overflow-hidden rounded-lg">
                    <img
                      src={crawledManga.thumbnail}
                      alt={crawledManga.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-3xl font-bold mb-2">{crawledManga.title}</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {crawledManga.genres?.map((genre: string) => (
                          <span
                            key={genre}
                            className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Author:</span>{' '}
                        <span className="font-medium">{crawledManga.author}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>{' '}
                        <span className="font-medium">{crawledManga.status}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Chapters:</span>{' '}
                        <span className="font-medium">{crawledManga.total_chapters}</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {crawledManga.description}
                    </p>
                    
                    <Button asChild>
                      <a href={`/manga/${crawledManga.id}`}>
                        View Manga
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!searchMutation.isPending && 
         !crawlMutation.isPending && 
         searchResults.length === 0 && 
         !crawledManga && (
          <div className="text-center py-20">
            <Search className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No results yet</h3>
            <p className="text-muted-foreground">
              Search for manga or paste a URL to get started
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
