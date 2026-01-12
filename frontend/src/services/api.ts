import axios from 'axios';
import { Manga, ChapterDetail } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const api = axios.create({ baseURL: API_URL });

export const getMangas = async (page = 1, search = ''): Promise<{ data: Manga[], pagination: any }> => {
  const { data } = await api.get('/mangas', { params: { page, search } });
  return data;
};

export const getMangaDetail = async (id: string): Promise<Manga> => {
  const { data } = await api.get(`/mangas/${id}`);
  return data;
};

export const getChapterImages = async (mangaId: string, chapterId: string): Promise<ChapterDetail> => {
  const { data } = await api.get(`/mangas/${mangaId}/${chapterId}`);
  return data;
};

export const searchManga = async (keyword: string): Promise<{ success: boolean, keyword: string, count: number, results: Manga[] }> => {
  const { data } = await api.get('/search', { params: { keyword } });
  return data;
};

export const crawlFromUrl = async (url: string): Promise<{ success: boolean, manga: Manga }> => {
  const { data } = await api.post('/crawl', { url });
  return data;
};

