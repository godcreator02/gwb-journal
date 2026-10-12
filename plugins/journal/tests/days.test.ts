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
  it('几个标签都剥下来；/ 表示层级，整体是一个标签', () => {
    expect(splitTrailingTags('审稿意见两点 #学报 #仿真/MMC')).toEqual({ text: '审稿意见两点', tags: ['学报', '仿真/MMC'] })
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
    lines: parseDayLines('- [ ] 昨天的事 #仿真\n- [x] 昨天做完的\n昨天的记事 #学报 #仿真'),
  },
  {
    date: '2026-10-12',
    lines: parseDayLines('- [ ] 今天的事 #仿真/MMC\n今天的记事 #学报 #仿真/效率'),
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
  it('一个标签的全部行，日期倒序；行尾带它实际打的标签', () => {
    expect(taggedOf(sample, '学报', false)).toEqual([
      { date: '2026-10-12', text: '今天的记事', task: null, tags: ['学报', '仿真/效率'] },
      { date: '2026-10-11', text: '昨天的记事', task: null, tags: ['学报', '仿真'] },
    ])
  })
  it('默认连下级一起：查「仿真」也回「仿真/MMC」的行（照旧 bn-tags 的习惯）', () => {
    expect(taggedOf(sample, '仿真', false).map((row) => row.text)).toEqual(['今天的事', '今天的记事', '昨天的事', '昨天的记事'])
  })
  it('exact 只回精确路径', () => {
    expect(taggedOf(sample, '仿真', true).map((row) => row.text)).toEqual(['昨天的事', '昨天的记事'])
    expect(taggedOf(sample, '仿真/MMC', false).map((row) => row.text)).toEqual(['今天的事'])
  })
  it('没有这个标签回空', () => {
    expect(taggedOf(sample, '不存在', false)).toEqual([])
  })
})

describe('tagsOf', () => {
  it('按路径段组树：lines 是直接行数、withChildren 连下级，根按 withChildren 降序', () => {
    const tree = tagsOf(sample)
    expect(tree).toHaveLength(2)
    const sim = tree.find((node) => node.path === '仿真')
    expect(sim?.lines).toBe(2)
    expect(sim?.withChildren).toBe(4)
    expect(sim?.children.map((child) => child.path)).toEqual(['仿真/MMC', '仿真/效率'])
    expect(sim?.lastDate).toBe('2026-10-12')
    const journal = tree.find((node) => node.path === '学报')
    expect(journal?.withChildren).toBe(2)
  })
  it('没有标签回空树', () => {
    expect(tagsOf([])).toEqual([])
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
