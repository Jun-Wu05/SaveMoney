# SaveMoney 架构与维护说明

> 依据 2026-10-23 GitHub `main` 功能基线整理，描述现状，不代表未来规划。

## 产品与部署边界

SaveMoney 是 React + TypeScript + Vite 构建的 iPhone 优先 PWA，由 GitHub Pages 托管**静态文件**，无业务后端、账号、云同步或付费 API。Safari 与主屏幕 Web App 的本地账本存储环境可能不同。

```text
iPhone Safari / 主屏幕 PWA
  ├─ React UI：首页 / 账单 / 统计 / 设置（点击导航）
  │   ├─ 记账弹层和分类管理
  │   ├─ 账单日历、图表和预算
  │   └─ 账单条目的独立左滑删除
  ├─ 业务模块：金额、分类、预算、统计、导入导出
  ├─ Dexie → IndexedDB（本地账本）
  ├─ JSON / CSV / Excel（用户主动导入导出）
  └─ Service Worker / Cache Storage（离线应用资源）
                     ↑
       GitHub Pages（仅静态应用文件）
```

离线 Cache Storage 与 IndexedDB 分离；**离线缓存不是账本备份**。

## 主要代码模块

| 路径 | 职责 |
| --- | --- |
| `src/main.tsx` | React 入口、Service Worker 注册与用户确认更新 |
| `src/App.tsx` | 点击导航、页面状态、账单筛选和数据管理 |
| `src/EntryEditor.tsx` / `src/amountKeypad.ts` | 记账弹层、金额键盘、账单编辑与局部触摸 |
| `src/CategoryManager.tsx` / `src/categoryIcons.tsx` | 分类管理与图标 |
| `src/db.ts` | Dexie schema、版本迁移和基础账单读写 |
| `src/categories.ts` / `src/quickEntry.ts` | 分类维护、常用分类与最近账单 |
| `src/budget.ts` / `src/categoryBudget.ts` | 月度总预算与分类预算 |
| `src/ledgerFilters.ts` / `src/calendarData.ts` / `src/ExpenseCalendar.tsx` | 账单筛选与日历 |
| `src/backup.ts` | JSON 备份、校验、事务恢复、CSV 导出 |
| `src/csvImport.ts` / `src/excelImport.ts` / `src/importBills.ts` | CSV/XLSX 解析、导入预览、去重及账单写入 |
| `src/excelExport.ts` | Excel 按月份工作表及汇总导出 |
| `src/SpendingDonut.tsx` / `src/DailySpendingChart.tsx` / `src/SpendingTrend.tsx` | 消费结构、每日支出和趋势图 |
| `public/sw.js` | 静态资源离线缓存 |
| `.github/workflows/pages.yml` | PR 测试/构建和 main 分支 Pages 发布 |

其余工具模块负责金额、本地日期、统计和月度回顾。新增功能优先复用已有模块，不继续把业务逻辑堆入 `App.tsx`。

## 数据结构

Dexie 数据库为 `SaveMoneyLedger`，当前 schema **version 3**。

| 表 | 主键 | 主要字段 |
| --- | --- | --- |
| `entries` | `id` | `type`, `amountMinor`, `categoryId`, `date`, `note`, `createdAt`, `updatedAt` |
| `categories` | `id` | `name`, `type`, `icon`, `sortOrder` |
| `budgets` | `month` | `amountMinor` |
| `categoryBudgets` | `id` | `month`, `categoryId`, `amountMinor` |

交易金额为整数分，日期为本地日历 `YYYY-MM-DD`。修改 schema 必须规划兼容迁移、回归测试和备份恢复验证，不得清除现有记录来解决问题。

## 文件、恢复与本地存储

- JSON 标识 `savemoney-backup`，当前版本 v1，涵盖账单、分类、总预算与分类预算；是唯一完整恢复格式。
- `validateBackupText()` 负责格式及引用检查；只读文件校验不会修改账本。
- `restoreBackup()` 再次校验后在 Dexie 事务中**覆盖**现有相关表，而不是合并。
- CSV / XLSX 可解析兼容账单文件、预览并去重；Excel 可按月分 Sheet 和汇总导出。它们均不等同 JSON 完整备份。
- 备份下载与用户确认已保存的时间存于本地提示状态，**无法自动证明文件已被云端保存**。

## 交互稳定性与更新

- 四个主标签通过**点击**切换；设置子页用明确的返回按钮。此前开发的全局主标签左右滑动、设置边缘返回已经撤销。
- 账单条目独立左滑删除保留；账单日历、图表、记账弹层也可有各自的点击或局部触摸交互。
- 不将局部手势扩展为全局页面切换，避免抢夺 iOS 主屏幕 PWA 的滚动和触摸操作。
- Service Worker 缓存静态资源，提示用户确认更新；不能用清空网站数据、卸载主屏幕 App 作为常规更新排错手段。

## 发布与验证

1. Issue → 独立分支 → PR。
2. 执行 `npm test` 和 `npm run build`，CI 失败不得视为通过。
3. 合并 `main` 后分别确认 GitHub Pages build/deploy 状态。
4. Safari 与主屏幕 PWA 各自实测重要触摸、离线、导入导出、备份恢复场景。
5. 自动测试通过不等于实机验收已完成，状态见 [checklist.md](checklist.md)。

工程规则见 [AGENTS.md](../AGENTS.md)，产品范围见 [PRD.md](PRD.md)。
