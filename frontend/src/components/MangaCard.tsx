import Link from 'next/link';
import { Card } from "@/components/ui/card"
import { Manga } from '@/types';

export function MangaCard({ manga }: { manga: Manga }) {
  return (
    <Link href={`/manga/${manga.id}`}>
      <Card className="overflow-hidden hover:scale-105 transition-transform duration-300 border-none shadow-lg bg-card/50 backdrop-blur-sm group cursor-pointer">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
          <img 
            src={manga.thumbnail} 
            alt={manga.title} 
            className="object-cover w-full h-full group-hover:opacity-90 transition-opacity"
            loading="lazy"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-16">
            <h3 className="text-white font-bold truncate text-sm md:text-base">{manga.title}</h3>
          </div>
        </div>
      </Card>
    </Link>
  );
}
