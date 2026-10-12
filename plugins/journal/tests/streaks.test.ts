import { describe, expect, it } from 'vitest'
import { streaksOf } from '../src/shared/streaks.js'

describe('streaksOf', () => {
  it('今天写了，current 从今天往回数', () => {
    expect(streaksOf(['2026-10-10', '2026-10-11', '2026-10-12'], '2026-10-12')).toEqual({ current: 3, longest: 3 })
  })
  it('今天还没写，current 从昨天起算', () => {
    expect(streaksOf(['2026-10-10', '2026-10-11'], '2026-10-12')).toEqual({ current: 2, longest: 2 })
  })
  it('今天以后的日子不算：那些文件是排上去的待办，不是写过', () => {
    expect(streaksOf(['2026-10-12', '2026-10-13'], '2026-10-12')).toEqual({ current: 1, longest: 1 })
  })
  it('中断分段时 longest 取历史最长', () => {
    expect(streaksOf(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06'], '2026-10-06')).toEqual({ current: 2, longest: 3 })
  })
  it('重复与乱序都接受', () => {
    expect(streaksOf(['2026-10-12', '2026-10-12', '2026-10-11'], '2026-10-12')).toEqual({ current: 2, longest: 2 })
  })
  it('一天都没有是零', () => {
    expect(streaksOf([], '2026-10-12')).toEqual({ current: 0, longest: 0 })
  })
})
