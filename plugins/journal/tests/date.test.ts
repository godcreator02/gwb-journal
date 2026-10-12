import { describe, expect, it } from 'vitest'
import { addDays, dateOf, daysBetween, daysInMonth, isIsoDate, monthGrid, weekdayOf } from '../src/shared/date.js'

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
