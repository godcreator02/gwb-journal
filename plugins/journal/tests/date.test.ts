import { afterEach, describe, expect, it } from 'vitest'
import { addDays, dateOf, daysBetween, daysInMonth, isIsoDate, monthGrid, todayOf, weekdayOf } from '../src/shared/date.js'

const originalTimeZone = process.env['TZ']

/** node 在给 process.env.TZ 赋值时就换本机时区，用它模拟电脑设成别的时区 */
function useMachineTimeZone(zone: string): void {
  process.env['TZ'] = zone
}

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env['TZ']
  else process.env['TZ'] = originalTimeZone
})

describe('todayOf：按东八区，不跟本机时区', () => {
  it('电脑在太平洋时区，美国晚上 8 点是中国的第二天', () => {
    useMachineTimeZone('America/Los_Angeles')
    const at = new Date('2026-10-17T20:28:05-07:00')
    expect(at.getDate()).toBe(17)
    expect(todayOf({ now: () => at })).toBe('2026-10-18')
  })
  it('东八区零点前一秒还是前一天', () => {
    useMachineTimeZone('America/Los_Angeles')
    expect(todayOf({ now: () => new Date('2026-10-17T23:59:59+08:00') })).toBe('2026-10-17')
    expect(todayOf({ now: () => new Date('2026-10-18T00:00:00+08:00') })).toBe('2026-10-18')
  })
})

describe('日历算术与本机时区无关', () => {
  for (const zone of ['America/Los_Angeles', 'Asia/Shanghai', 'Pacific/Kiritimati']) {
    it(zone, () => {
      useMachineTimeZone(zone)
      expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
      expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
      expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
      expect(weekdayOf('2026-10-12')).toBe(0)
      expect(monthGrid('2026-10')[0]?.[0]).toBe('2026-09-28')
    })
  }
})

describe('dateOf', () => {
  it('认正常的一天', () => {
    expect(dateOf('2026-10-12')).not.toBeNull()
  })
  it('不存在的那一天回 null（回读校验拦住悄悄滚动）', () => {
    expect(dateOf('2026-02-30')).toBeNull()
    expect(dateOf('2026-13-01')).toBeNull()
    expect(dateOf('不是日期')).toBeNull()
  })
  it('isIsoDate 跟着 dateOf', () => {
    expect(isIsoDate('2026-01-01')).toBe(true)
    expect(isIsoDate('2026-1-1')).toBe(false)
  })
})

describe('addDays / daysBetween', () => {
  it('跨月、跨年', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('坏日期', 1)).toBeNull()
  })
  it('按日历日数', () => {
    expect(daysBetween('2026-10-01', '2026-10-12')).toBe(11)
    expect(daysBetween('2026-10-12', '2026-10-01')).toBe(-11)
  })
})

describe('daysInMonth', () => {
  it('闰年二月', () => {
    expect(daysInMonth('2028-02')).toHaveLength(29)
    expect(daysInMonth('2026-02')).toHaveLength(28)
  })
  it('月份形状不对回空表', () => {
    expect(daysInMonth('2026-13')).toEqual([])
  })
})

describe('weekdayOf', () => {
  it('周一到周日是 0 到 6', () => {
    expect(weekdayOf('2026-10-12')).toBe(0)
    expect(weekdayOf('2026-10-11')).toBe(6)
  })
})

describe('monthGrid', () => {
  it('2026-10：从 9月28日（周一）起、到 11月1日（周日）止，一周一行', () => {
    const grid = monthGrid('2026-10')
    expect(grid[0]?.[0]).toBe('2026-09-28')
    expect(grid[0]?.[3]).toBe('2026-10-01')
    expect(grid.at(-1)?.at(-1)).toBe('2026-11-01')
    expect(grid).toHaveLength(5)
  })
  it('2月恰好四周时不硬撑六行', () => {
    // 2021-02-01 是周一、28 天，恰好四周
    expect(monthGrid('2021-02')).toHaveLength(4)
  })
})
