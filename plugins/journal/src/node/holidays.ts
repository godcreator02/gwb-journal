/**
 * 法定假日与调休：每年由国务院公布、算不出来，从 holiday-cn（github.com/NateScarlet/holiday-cn）按年下载，
 * 经 jsDelivr 取，整份缓存在本插件的数据文档 `holidays` 里。
 *
 * 今年（按东八区算）以前的年份缓存了就不再下载；今年与以后缓存超过 `REFRESH_DAYS` 天重新下载（公告偶尔会补发更正），
 * 还没公布（数据源里那一年是空表）的超过一天就重新下载。下载不到时有缓存就用缓存、状态报 `stale`，没有缓存报 `failed`，原因写进返回结果。
 * 下载时刻 `fetchedAt` 写东八区带偏移的 ISO 串。
 */

import { utc8Iso, utc8PartsOf } from '@godcreator/utc8-time'
import type { HolidayYearStatus } from '../shared/types.js'

export const HOLIDAY_DOC = 'holidays'

/** 一年的状态，加上那一年的每个假日与调休日 */
export interface HolidayYear extends HolidayYearStatus {
  days: HolidayDay[]
}

/** 已公布的今年与以后的年份，缓存几天后重新下载 */
export const REFRESH_DAYS = 7

/** 还没公布的年份，缓存几天后重新下载 */
export const UNPUBLISHED_REFRESH_DAYS = 1

export function holidayUrlOf(year: number): string {
  return `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${String(year)}.json`
}

export interface HolidayDay {
  date: string
  name: string
  off: boolean
}

interface CachedYear {
  fetchedAt: string
  days: HolidayDay[]
}

interface HolidayCache {
  years: Record<string, CachedYear>
}

/** 本插件数据文档 `holidays` 的读写（生产是 `gwbData`） */
export interface HolidayStore {
  read(): Promise<unknown>
  write(value: HolidayCache): Promise<void>
}

/** 取一个地址的内容，回状态码与正文；连不上、超时就抛 */
export type FetchText = (url: string) => Promise<{ status: number; text: string }>

export interface HolidayBook {
  holidaysFor(years: readonly number[]): Promise<HolidayYear[]>
}

/**
 * holiday-cn 一年那份 JSON → 那一年的假日与调休日。形状不对就抛，写明哪儿不对：
 * 数据源换了格式要让人看见，不悄悄当成「没有假日」
 */
export function parseHolidayYear(text: string, year: number): HolidayDay[] {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (err) {
    throw new Error(`${String(year)} 年的节假日数据不是 JSON：${err instanceof Error ? err.message : String(err)}`)
  }
  const rec = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : null
  if (rec === null || rec['year'] !== year || !Array.isArray(rec['days'])) throw new Error(`${String(year)} 年的节假日数据形状不对：要 { year: ${String(year)}, days: [...] }`)
  return (rec['days'] as unknown[]).map((raw, index) => {
    const day = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const { date, name, isOffDay } = day
    if (typeof date !== 'string' || typeof name !== 'string' || typeof isOffDay !== 'boolean') {
      throw new Error(`${String(year)} 年的节假日数据第 ${String(index + 1)} 条形状不对：要 { date, name, isOffDay }`)
    }
    return { date, name, off: isOffDay }
  })
}

/** 缓存文档：不是本插件写的形状就当没有缓存（缓存没命中就去下载，文档下次写入时整份换掉） */
function cacheOf(raw: unknown): HolidayCache {
  const rec = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null
  const years = rec?.['years']
  if (typeof years !== 'object' || years === null) return { years: {} }
  return { years: years as Record<string, CachedYear> }
}

function ageInDays(fetchedAt: string, now: Date): number {
  return (now.getTime() - new Date(fetchedAt).getTime()) / 86_400_000
}

export function needsFetch(year: number, cached: CachedYear | undefined, now: Date): boolean {
  if (cached === undefined) return true
  if (year < utc8PartsOf(now).year) return false
  const limit = cached.days.length === 0 ? UNPUBLISHED_REFRESH_DAYS : REFRESH_DAYS
  return ageInDays(cached.fetchedAt, now) > limit
}

export function createHolidayBook(deps: { fetchText: FetchText; store: HolidayStore; clock: { now(): Date } }): HolidayBook {
  /** 同一年同时只下载一次：窗格连着刷新几次时不重复请求 */
  const inFlight = new Map<number, Promise<HolidayYear>>()
  /** 写缓存排队：几年同时下载回来时，后写的不覆盖先写的 */
  let writes: Promise<void> = Promise.resolve()

  const remember = (year: number, entry: CachedYear): Promise<void> => {
    const next = writes.then(async () => {
      const cache = cacheOf(await deps.store.read())
      cache.years[String(year)] = entry
      await deps.store.write(cache)
    })
    // 队列只管先后：这一次写失败由拿着 next 的调用方收到，不让后面排队的写跟着失败
    writes = next.catch(() => undefined)
    return next
  }

  const fetchYear = async (year: number, cached: CachedYear | undefined): Promise<HolidayYear> => {
    const now = deps.clock.now()
    try {
      const reply = await deps.fetchText(holidayUrlOf(year))
      if (reply.status !== 200) throw new Error(`${holidayUrlOf(year)} 回 HTTP ${String(reply.status)}`)
      const days = parseHolidayYear(reply.text, year)
      const entry = { fetchedAt: utc8Iso(now), days }
      await remember(year, entry)
      return { year, state: days.length === 0 ? 'unpublished' : 'published', fetchedAt: entry.fetchedAt, error: null, days }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      if (cached === undefined) return { year, state: 'failed', fetchedAt: null, error, days: [] }
      return { year, state: 'stale', fetchedAt: cached.fetchedAt, error, days: cached.days }
    }
  }

  return {
    async holidaysFor(years) {
      const cache = cacheOf(await deps.store.read())
      const now = deps.clock.now()
      return Promise.all(
        years.map((year) => {
          const cached = cache.years[String(year)]
          if (!needsFetch(year, cached, now) && cached !== undefined) {
            return Promise.resolve<HolidayYear>({ year, state: cached.days.length === 0 ? 'unpublished' : 'published', fetchedAt: cached.fetchedAt, error: null, days: cached.days })
          }
          const running = inFlight.get(year)
          if (running !== undefined) return running
          const started = fetchYear(year, cached).finally(() => inFlight.delete(year))
          inFlight.set(year, started)
          return started
        }),
      )
    },
  }
}
