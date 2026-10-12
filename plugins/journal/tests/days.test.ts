import { describe, expect, it } from 'vitest'
import { dayFileOf, parseDayLines, splitTrailingTags, statOfDay, taggedOf, tagsOf, todosOf, toggleTaskLine } from '../src/shared/days.js'

describe('dayFileOf', () => {
  it('只认 YYYY-MM-DD.mdx', () => {
    expect(dayFileOf('2026-10-12.mdx')).toBe('2026-10-12')
    expect(dayFileOf('2026-10-12.md')).toBeNull()
    expect(dayFileOf('随便.mdx')).toBeNull()
  })
})

describe('splitTrailingTags', () => {
  it('没有标签', () => {
    expect(splitTrailingTags('今天改完了那一节')).toEqual({ text: '今天改完了那一节', tags: [] })
  })
  it('一个标签、中文', () => {
    expect(splitTrailingTags('今天改完了那一节 #仿真')).toEqual({ text: '今天改完了那一节', tags: ['仿真'] })
  })
  it('几个标签都剥下来', () => {
    expect(splitTrailingTags('审稿意见两点 #学报 #审稿')).toEqual({ text: '审稿意见两点', tags: ['学报', '审稿'] })
  })
  it('# 前没有空白不算（URL 锚点、C# 这类不误伤）', () => {
    expect(splitTrailingTags('看了 https://x.com/a#frag')).toEqual({ text: '看了 https://x.com/a#frag', tags: [] })
    expect(splitTrailingTags('写了点 C#')).toEqual({ text: '写了点 C#', tags: [] })
  })
  it('只有标签的行，text 是空', () => {
    expect(splitTrailingTags('#周报')).toEqual({ text: '', tags: ['周报'] })
  })
  it('行尾空白先去掉', () => {
    expect(splitTrailingTags('一句话 #日志  ')).toEqual({ text: '一句话', tags: ['日志'] })
  })
})

describe('parseDayLines', () => {
  it('跳过 frontmatter 与空行，认任意缩进的任务', () => {
    const lines = parseDayLines('---\ntitle: x\n---\n- [ ] 发波形 #仿真\n- [x] 回复意见\n\n  - [ ] 缩进的也算\n今天改完了。 #仿真\n')
    expect(lines).toEqual([
      { text: '发波形', task: 'open', tags: ['仿真'] },
      { text: '回复意见', task: 'done', tags: [] },
      { text: '缩进的也算', task: 'open', tags: [] },
      { text: '今天改完了。', task: null, tags: ['仿真'] },
    ])
  })
  it('没有 frontmatter 也认', () => {
    expect(parseDayLines('一句话')).toEqual([{ text: '一句话', task: null, tags: [] }])
  })
})

describe('statOfDay', () => {
  it('记事、任务、勾掉分开数', () => {
    const lines = parseDayLines('- [ ] a\n- [x] b\n记一句\n')
    expect(statOfDay('2026-10-12', lines)).toEqual({ date: '2026-10-12', entries: 1, tasks: 2, done: 1 })
  })
})

const sample = [
  {
    date: '2026-10-11',
    lines: parseDayLines('- [ ] 昨天的事 #仿真\n- [x] 昨天做完的\n昨天的记事 #学报'),
  },
  {
    date: '2026-10-12',
    lines: parseDayLines('- [ ] 今天的事 #仿真\n今天的记事 #学报 #仿真'),
  },
]

describe('todosOf', () => {
  it('日期倒序，默认只列没勾的', () => {
    expect(todosOf(sample, false)).toEqual([
      { date: '2026-10-12', text: '今天的事', done: false },
      { date: '2026-10-11', text: '昨天的事', done: false },
    ])
  })
  it('includeDone 连勾上的一起列，行序保持', () => {
    expect(todosOf(sample, true).map((row) => [row.date, row.text])).toEqual([
      ['2026-10-12', '今天的事'],
      ['2026-10-11', '昨天的事'],
      ['2026-10-11', '昨天做完的'],
    ])
  })
})

describe('taggedOf', () => {
  it('一个标签的全部行，日期倒序', () => {
    expect(taggedOf(sample, '仿真')).toEqual([
      { date: '2026-10-12', text: '今天的事', task: 'open' },
      { date: '2026-10-12', text: '今天的记事', task: null },
      { date: '2026-10-11', text: '昨天的事', task: 'open' },
    ])
  })
  it('没有这个标签回空', () => {
    expect(taggedOf(sample, '不存在')).toEqual([])
  })
})

describe('toggleTaskLine', () => {
  it('把匹配的任务行翻转到给定状态，保留缩进与行尾标签', () => {
    const content = '开头一段\n- [ ] 发波形 #仿真\n- [x] 已完成\n结尾'
    const next = toggleTaskLine(content, '发波形', true)
    expect(next.changed).toBe(true)
    expect(next.content).toBe('开头一段\n- [x] 发波形 #仿真\n- [x] 已完成\n结尾')
  })

  it('已是目标状态就不动文件', () => {
    const content = '- [x] 已完成'
    expect(toggleTaskLine(content, '已完成', true)).toEqual({ content, changed: false })
  })

  it('文本对不上（含标签差异）不改；只认完全匹配', () => {
    const content = '- [ ] 发波形 #仿真'
    expect(toggleTaskLine(content, '发波形 #仿真', true).changed).toBe(false)
    expect(toggleTaskLine(content, '别的', true).changed).toBe(false)
  })

  it('翻回未完成也行', () => {
    expect(toggleTaskLine('- [x] 交报销', '交报销', false).content).toBe('- [ ] 交报销')
  })
})

describe('tagsOf', () => {
  it('计数、最近日子，按行数降序', () => {
    expect(tagsOf(sample)).toEqual([
      { tag: '仿真', lines: 3, lastDate: '2026-10-12' },
      { tag: '学报', lines: 2, lastDate: '2026-10-12' },
    ])
  })
})
