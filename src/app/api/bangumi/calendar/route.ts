import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';

export interface BangumiCalendarData {
  weekday: {
    en: string;
  };
  items: {
    id: number;
    name: string;
    name_cn: string;
    rating: {
      score: number;
    };
    air_date: string;
    images: {
      large: string;
      common: string;
      medium: string;
      small: string;
      grid: string;
    };
  }[];
}

export const runtime = 'edge';

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('https://api.bgm.tv/calendar', {
      signal: controller.signal,
    });
    const data: BangumiCalendarData[] = await response.json();

    const cacheTime = await getCacheTime();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取番组日历失败', details: (error as Error).message },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
