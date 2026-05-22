/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'edge';

// 空结果的短缓存时间（秒），避免空结果被长期缓存导致后续搜索始终返回空
const EMPTY_RESULT_CACHE_TIME = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${EMPTY_RESULT_CACHE_TIME}, s-maxage=${EMPTY_RESULT_CACHE_TIME}`,
          'CDN-Cache-Control': `public, s-maxage=${EMPTY_RESULT_CACHE_TIME}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${EMPTY_RESULT_CACHE_TIME}`,
          'Netlify-Vary': 'query',
        },
      }
    );
  }

  const config = await getConfig();
  const apiSites = config.SourceConfig.filter((site) => !site.disabled);

  // 直接调用 searchFromApi，不再使用 Promise.race + setTimeout 包装
  // 原因：1. setTimeout 不清理导致内存泄漏
  //       2. 外层20秒超时与内层AbortController超时冲突且冗余
  //       3. .catch() 吞掉所有错误导致超时和空结果无法区分
  // 超时统一由 searchFromApi 内部的 AbortController 控制（15秒）
  const searchPromises = apiSites.map((site) => searchFromApi(site, query));

  try {
    const results = await Promise.allSettled(searchPromises);

    // 只收集成功（fulfilled）的结果，rejected 的站点不贡献结果但不影响其他站点
    const successResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);

    let flattenedResults = successResults.flat();

    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }

    // 动态缓存策略：
    // - 有结果：正常缓存（减少上游压力，提升体验）
    // - 结果：极短缓存5秒（避免空结果被长期锁定，5秒后重试有机会拿到数据）
    const cacheTime =
      flattenedResults.length > 0
        ? await getCacheTime()
        : EMPTY_RESULT_CACHE_TIME;

    return NextResponse.json(
      { results: flattenedResults },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
