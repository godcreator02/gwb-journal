/**
 * 标签窗格：全部标签的树（`#仿真/MMC` 是「仿真」的下级，缩进一层），点一个标签在原地展开它的全部行
 * （默认连下级一起）；行上可以勾待办、点日期打开那天的「当天」窗格。
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChevronLeftIcon } from 'lucide-react'
import type { HostBridge, PaneArgs, PaneHandle, ShellBridge } from '@godcreator/gwb-shell/pane'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DAY_PANE } from '../shared/types.js'
import { TAGGED_COMMAND, TAGS_COMMAND, TOGGLE_COMMAND, type TagNode, type TaggedRow } from '../shared/types.js'
import { callData, errorText } from './calls.js'

export function mountTagsPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  const root = createRoot(container)
  root.render(<TagsPane host={args.host} shell={args.shell} />)
  return {
    dispose() {
      root.unmount()
      container.replaceChildren()
    },
  }
}

function TagsPane({ host, shell }: { host: HostBridge; shell: ShellBridge }): ReactNode {
  const [tag, setTag] = useState<string | null>(null)
  const [tree, setTree] = useState<TagNode[] | null>(null)
  const [rows, setRows] = useState<TaggedRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadTree = useCallback(async (): Promise<void> => {
    try {
      const result = await callData<{ tags: TagNode[] }>(host, TAGS_COMMAND, {})
      setTree(result.tags)
      setError(null)
    } catch (caught) {
      setError(errorText(caught))
    }
  }, [host])

  const loadRows = useCallback(
    async (picked: string): Promise<void> => {
      try {
        const result = await callData<{ rows: TaggedRow[] }>(host, TAGGED_COMMAND, { tag: picked })
        setRows(result.rows)
        setError(null)
      } catch (caught) {
        setError(errorText(caught))
      }
    },
    [host],
  )

  useEffect(() => {
    if (tag === null) void loadTree()
  }, [loadTree, tag])

  useEffect(() => {
    if (tag !== null) void loadRows(tag)
  }, [loadRows, tag])

  const openDay = (date: string): void => {
    shell.openPane(DAY_PANE, { key: date, params: { date } })
  }

  const toggle = useCallback(
    async (row: TaggedRow): Promise<void> => {
      if (row.task === null || tag === null) return
      try {
        await callData(host, TOGGLE_COMMAND, { date: row.date, text: row.text, done: row.task !== 'done' })
        await loadRows(tag)
      } catch (caught) {
        setError(errorText(caught))
      }
    },
    [host, tag, loadRows],
  )

  const nodeLine = (node: TagNode, depth: number): ReactNode => (
    <div key={node.path}>
      <button
        type="button"
        className={`journal:flex journal:w-full journal:items-center journal:gap-2 journal:rounded-md journal:py-1 journal:pr-2 journal:text-left journal:hover:bg-muted ${depth === 0 ? 'journal:pl-2' : ''}`}
        style={depth === 0 ? undefined : { paddingLeft: `${String(depth * 14 + 8)}px` }}
        title={`看「${node.path}」的全部行（含下级）`}
        onClick={() => setTag(node.path)}
      >
        <span className="journal:flex-none journal:font-medium">{node.tag}</span>
        <Badge variant="secondary" className="journal:flex-none">{String(node.withChildren)}</Badge>
        {node.lines === node.withChildren ? null : <span className="journal:flex-none journal:text-xs journal:text-muted-foreground">{`直接 ${String(node.lines)}`}</span>}
        <span className="journal:ml-auto journal:flex-none journal:text-xs journal:text-muted-foreground">{node.lastDate}</span>
      </button>
      {node.children.map((child) => nodeLine(child, depth + 1))}
    </div>
  )

  const rowLine = (row: TaggedRow): ReactNode => (
    <div key={`${row.date}-${row.text}`} className="journal:flex journal:min-w-0 journal:items-center journal:gap-2 journal:py-0.5">
      <Button variant="ghost" size="sm" className="journal:w-[104px] journal:flex-none journal:justify-start" aria-label={`打开 ${row.date} 的日志`} onClick={() => openDay(row.date)}>
        {row.date}
      </Button>
      {row.task === null ? <span className="journal:w-4 journal:flex-none" /> : (
        <Checkbox checked={row.task === 'done'} aria-label={row.task === 'done' ? `取消勾选：${row.text}` : `勾上：${row.text}`} onCheckedChange={() => void toggle(row)} />
      )}
      <Button variant="ghost" size="sm" className="journal:min-w-0 journal:flex-1 journal:justify-start" title={row.text} onClick={() => openDay(row.date)}>
        <span className={`journal:truncate ${row.task === 'done' ? 'journal:text-muted-foreground journal:line-through' : ''}`}>{row.text === '' ? '（空）' : row.text}</span>
      </Button>
      {row.tags.map((each) => (
        <Badge key={each} variant="outline" className="journal:flex-none">{`#${each}`}</Badge>
      ))}
    </div>
  )

  return (
    <div className="journal:flex journal:h-full journal:flex-col journal:gap-2 journal:overflow-y-auto journal:px-3 journal:py-3 journal:text-sm">
      {error === null ? null : (
        <p role="alert" className="journal:m-0 journal:flex-none journal:rounded-md journal:border journal:border-destructive journal:bg-destructive/10 journal:px-3 journal:py-2 journal:text-destructive">
          {error}
        </p>
      )}
      {tag === null ? (
        <section aria-label="全部标签" className="journal:min-w-0 journal:flex-1">
          <div className="journal:flex journal:items-center journal:gap-2 journal:py-2">
            <h2 className="journal:m-0 journal:text-sm journal:font-medium">全部标签</h2>
            <span className="journal:text-xs journal:text-muted-foreground">名字里写 / 表示层级；点开看行（连下级）</span>
            <Button variant="ghost" size="sm" className="journal:ml-auto" onClick={() => void loadTree()}>
              刷新
            </Button>
          </div>
          {tree === null ? <p className="journal:m-0 journal:text-muted-foreground">读取中…</p> : null}
          {tree !== null && tree.length === 0 ? <p className="journal:p-4 journal:text-muted-foreground">还没有标签。行尾写 `#名字` 就有了。</p> : null}
          {tree?.map((node) => nodeLine(node, 0))}
        </section>
      ) : (
        <section aria-label={`标签 ${tag}`} className="journal:min-w-0 journal:flex-1">
          <div className="journal:flex journal:items-center journal:gap-2 journal:py-2">
            <Button variant="ghost" size="sm" aria-label="回到全部标签" onClick={() => setTag(null)}>
              <ChevronLeftIcon />
              全部标签
            </Button>
            <h2 className="journal:m-0 journal:text-sm journal:font-medium">{`#${tag}`}</h2>
            {rows === null ? null : <Badge variant="secondary">{String(rows.length)}</Badge>}
            <Button variant="ghost" size="sm" className="journal:ml-auto" onClick={() => tag !== null && void loadRows(tag)}>
              刷新
            </Button>
          </div>
          {rows === null ? <p className="journal:m-0 journal:text-muted-foreground">读取中…</p> : null}
          {rows !== null && rows.length === 0 ? <p className="journal:p-4 journal:text-muted-foreground">没有打这个标签的行。</p> : null}
          {rows?.map((row) => rowLine(row))}
        </section>
      )}
    </div>
  )
}
