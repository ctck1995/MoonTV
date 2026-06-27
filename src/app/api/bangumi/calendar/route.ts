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

function proxyImageUrl(url: string | undefined, proxyBase: string): string | undefined {
  if (!url) return undefined;
  return proxyBase + encodeURIComponent(url);
}

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const bangumiImageProxy = process.env.BANGUMI_IMAGE_PROXY;

  try {
    const response = await fetch('https://api.bgm.tv/calendar', {
      signal: controller.signal,
    });
    const data: BangumiCalendarData[] = await response.json();

    // 如果配置了代理，则处理所有图片 URL
    const processedData = bangumiImageProxy
      ? data.map((day) => ({
          ...day,
          items: day.items.map((item) => ({
            ...item,
            images: item.images
              ? {
                  large: proxyImageUrl(item.images.large, bangumiImageProxy),
                  common: proxyImageUrl(item.images.common, bangumiImageProxy),
                  medium: proxyImageUrl(item.images.medium, bangumiImageProxy),
                  small: proxyImageUrl(item.images.small, bangumiImageProxy),
                  grid: proxyImageUrl(item.images.grid, bangumiImageProxy),
                }
              : undefined,
          })),
        }))
      : data;

    const cacheTime = await getCacheTime();
    return NextResponse.json(processedData, {
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
