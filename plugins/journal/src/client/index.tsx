/**
 * 浏览器侧入口：外壳按窗格 id 分发到日志窗格（月历与待办）或当天窗格（一天的 mdx），
 * 状态栏「快速记录」走 mountStatusItem。
 *
 * 类名一律带 `journal:` 前缀：样式只作用于本插件，靠的是类名唯一，不靠 DOM 祖先关系（弹层
 * portal 到 body 也有样式）。样式入口在 `styles.css`。可点的控件用 shadcn 官方组件（`components/ui/`）。
 * react 由页面的 importmap 提供（提供方是 shell），构建时不打包，见 build.ts。
 */

import type { PaneArgs, PaneHandle, StatusItemArgs, StatusItemHandle } from '@godcreator/gwb-shell/pane'
import { DAY_PANE, JOURNAL_PANE, TAGS_PANE } from '../shared/types.js'
import { mountDayPane } from './day-pane.js'
import { mountJournalPane } from './journal-pane.js'
import { mountStatusCapture } from './status-capture.js'
import { mountTagsPane } from './tags-pane.js'

export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  if (args.pane.id === DAY_PANE) return mountDayPane(args, container)
  if (args.pane.id === JOURNAL_PANE) return mountJournalPane(args, container)
  if (args.pane.id === TAGS_PANE) return mountTagsPane(args, container)
  throw new Error(`这个窗格 id 不认识：${args.pane.id}`)
}

export function mountStatusItem(args: StatusItemArgs, container: HTMLElement): StatusItemHandle {
  return mountStatusCapture(args, container)
}
