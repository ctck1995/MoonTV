'use client';

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

export async function GetBangumiCalendarData(timeout?: number): Promise<BangumiCalendarData[]> {
  const controller = new AbortController();
  const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;

  try {
    const response = await fetch('https://api.bgm.tv/calendar', {
      signal: controller.signal,
    });
    const data = await response.json();
    return data;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

