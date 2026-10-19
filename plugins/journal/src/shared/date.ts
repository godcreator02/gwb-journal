/**
 * 日志要的日期：「今天」、前后一天、某个月有哪几天、月历网格。
 *
 * 「今天」按东八区算，不跟本机时区走：用户常在亚洲与美国之间往返，在美国晚上九点记的，记到中国的第二天。
 * 把一个时刻换成日期串只有 `todayOf` 这一处，用 `formatUtc8`。
 * 其余函数进出都是 `YYYY-MM-DD` 字符串，只做日历算术：内部借本机时区零点的 `Date` 来算（`dateOf` 造、`isoOfLocalMidnight` 读回），
 * 结果与本机时区无关。
 */

import { formatUtc8 } from '@godcreator/utc8-time'

/** `YYYY-MM-DD` 的形状 */
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** `YYYY-MM` 的形状 */
const MONTH = /^(\d{4})-(\d{2})$/

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

/**
 * 日期串 → 本地零点那个 `Date`。形状不对、或那一天根本不存在（`2026-02-30`）回 null。
 *
 * **回读一遍是必须的**：`new Date(2026, 1, 30)` 不报错，它悄悄滚到 3 月 2 日——那不是人要的那一天。
 */
export function dateOf(iso: string): Date | null {
  const matched = ISO.exec(iso)
  if (matched === null) return null
  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  const at = new Date(year, month - 1, day)
  return at.getFullYear() === year && at.getMonth() === month - 1 && at.getDate() === day ? at : null
}

/** 这个串是不是一天 */
export function isIsoDate(text: string): boolean {
  return dateOf(text) !== null
}

/** `dateOf` 造出来的本机零点 → 日期串。只给日历算术用，不拿它换真实时刻：那会按本机时区算 */
function isoOfLocalMidnight(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 读真实时间的钟 */
export const systemClock = { now: (): Date => new Date() }

/** 今天，东八区的那一天。钟由调用方给（生产是 `systemClock`，测试是固定钟） */
export function todayOf(clock: { now(): Date }): string {
  return formatUtc8(clock.now(), 'yyyy-MM-dd')
}

/** 前后挪几天；日期形状不对回 null */
export function addDays(iso: string, days: number): string | null {
  const at = dateOf(iso)
  if (at === null) return null
  at.setDate(at.getDate() + days)
  return isoOfLocalMidnight(at)
}

/** 从 `from` 到 `to` 隔几天（`to` 在前是负数）；形状不对回 null。按日历日数，不受夏令时那一小时影响 */
export function daysBetween(from: string, to: string): number | null {
  const start = dateOf(from)
  const end = dateOf(to)
  if (start === null || end === null) return null
  return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000)
}

/** 这一天所在的月（`YYYY-MM`），形状不对回 null */
export function monthOf(iso: string): string | null {
  return isIsoDate(iso) ? iso.slice(0, 7) : null
}

/** 这个月有哪几天，从 1 号起。月份形状不对回空表 */
export function daysInMonth(month: string): string[] {
  const matched = MONTH.exec(month)
  if (matched === null) return []
  const year = Number(matched[1])
  const index = Number(matched[2])
  if (index < 1 || index > 12) return []
  // 下个月 0 号就是这个月最后一天——不用记闰年
  const last = new Date(year, index, 0).getDate()
  const out: string[] = []
  for (let day = 1; day <= last; day += 1) out.push(`${month}-${String(day).padStart(2, '0')}`)
  return out
}

/** 星期几：0 = 周一 … 6 = 周日（中国习惯周一排在头一格）。形状不对回 null */
export function weekdayOf(iso: string): number | null {
  const at = dateOf(iso)
  return at === null ? null : (at.getDay() + 6) % 7
}

/**
 * 月历网格：一周一行、周一起，含上下月补白那些格子（格子里是邻月的日期）。
 *
 * 从 1 号所在那一周的周一起、到最后一天所在那一周的周日止——**行数按需**，不硬撑六行：
 * 2 月恰好四周时多出来的两行空白对读者没有任何用处。
 */
export function monthGrid(month: string): string[][] {
  const days = daysInMonth(month)
  const first = days[0]
  if (first === undefined) return []
  const lead = weekdayOf(first)
  if (lead === null) return []
  const grid: string[][] = []
  let cursor = addDays(first, -lead) ?? first
  const last = days[days.length - 1] ?? first
  for (;;) {
    const week: string[] = []
    for (let index = 0; index < 7; index += 1) {
      week.push(cursor)
      cursor = addDays(cursor, 1) ?? cursor
    }
    grid.push(week)
    if (week.includes(last)) break
  }
  return grid
}

/** 月份前后挪几个月（`2026-01` 往前一月是 `2025-12`）；形状不对回 null */
export function shiftMonth(month: string, by: number): string | null {
  const matched = MONTH.exec(month)
  if (matched === null) return null
  const at = new Date(Number(matched[1]), Number(matched[2]) - 1 + by, 1)
  return `${String(at.getFullYear()).padStart(4, '0')}-${String(at.getMonth() + 1).padStart(2, '0')}`
}

/** 给人看的月份：`2026年9月` */
export function formatMonth(month: string): string {
  const matched = MONTH.exec(month)
  if (matched === null) return month
  return `${String(Number(matched[1]))}年${String(Number(matched[2]))}月`
}

/** 给人看的一天：`9月20日 周日` */
export function formatDay(iso: string): string {
  const at = dateOf(iso)
  if (at === null) return iso
  const weekday = WEEKDAYS[(at.getDay() + 6) % 7] ?? ''
  return `${String(at.getMonth() + 1)}月${String(at.getDate())}日 ${weekday}`
}
