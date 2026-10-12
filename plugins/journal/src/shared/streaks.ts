// 连续天数：当前与历史最长
import { addDays } from './date.js'

/**
 * `days` 是有内容的日子，重复与乱序都接受。
 * `current` 从今天往回数，今天还没写就从昨天起算：一天还没过完就算中断，这个数每天上午都是错的。
 * `longest` 是今天及以前最长的一段。今天以后的日子不算：还没到的日子里有文件是排上去的待办，不是写过
 */
export function streaksOf(days: readonly string[], today: string): { current: number; longest: number } {
  const written = new Set(days.filter((day) => day <= today))
  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const day of [...written].sort()) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1
    if (run > longest) longest = run
    previous = day
  }
  let cursor = written.has(today) ? today : addDays(today, -1)
  let current = 0
  while (cursor !== null && written.has(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }
  return { current, longest }
}
