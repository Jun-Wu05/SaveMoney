# SaveMoney 架构与维护说明

> 依据当前 `main` 分支实现整理。本文描述现状，不代表未来规划。

## 1. 产品与部署边界

SaveMoney 是 React + TypeScript + Vite 构建的 iPhone 优先 PWA，静态资源由 GitHub Pages 托管。无业务后端、用户账户、云同步、分析上报或付费 API。每个浏览器 / 主屏幕网页 App 的账本保存在其自己的本地存储环境中。

```text
iPhone Safari / 主屏幕 PWA
  ├─ React UI（首页 / 账单 / 统计 / 设置）
  ├─ 业务模块（金额、分类、预算、统计、导入导出）
  ├─ Dexie → IndexedDB（本地持久化）
  ├─ JSON / CSV / Excel（用户主动导入导出）
  └─ Service Worker / Cache Storage（离线应用资源）
                  ↑
       GitHub Pages（仅静态应用文件）
```

离线缓存与 IndexedDB 是不同的存储：缓存资源可帮助离线启动，但**不是账单备份**。

## 2. 关键模块

| 路径 | 职责 |
| --- | --- |
| `src/main.tsx` | React 入口，注册 Service Worker、提示更新 |
| `src/App.tsx` | 页面导航、状态协调、账单查询、数据管理 UI |
| `src/EntryEditor.tsx` | 新增/编辑账单弹窗、金额键盘与触摸交互 |
| `src/CategoryManager.tsx` | 分类管理表单 |
| `src/categoryIcons.tsx` | 分类图标与选择器 |
| `src/db.ts` | Dexie 表定义、版本迁移与基础读写 |
| `src/categories.ts` | 分类增改删与引用检查 |
| `src/budget.ts` / `src/categoryBudget.ts` | 月度及分类预算 |
| `src/backup.ts` | JSON 备份、校验、恢复、CSV 导出 |
| `src/csvImport.ts` / `src/importBills.ts` | CSV 解析与账单导入 |
| `src/excelExport.ts` | Excel 月度工作表导出 |
| `src/SpendingDonut.tsx` / `src/DailySpendingChart.tsx` / `src/SpendingTrend.tsx` | 统计图表 |
| `public/sw.js` | 静态资源预缓存与离线响应 |
| `.github/workflows/pages.yml` | CI 测试、构建和 Pages 部署 |

其他 `src/` 工具模块处理金额、本地日期、过滤、统计和月度回顾。新增功能应优先复用现有模块，而非继续向 `App.tsx` 堆积业务逻辑。

## 3. 数据模型

Dexie 数据库名称为 `SaveMoneyLedger`，当前 schema 为 **version 3**。

| 表 | 主键 | 主要字段 |
| --- | --- | --- |
| `entries` | `id` | `type`, `amountMinor`, `categoryId`, `date`, `note`, `createdAt`, `updatedAt` |
| `categories` | `id` | `name`, `type`, `icon`, `sortOrder` |
| `budgets` | `month` | `amountMinor` |
| `categoryBudgets` | `id` | `month`, `categoryId`, `amountMinor` |

金额使用**整数分**（`amountMinor`）；账单日期使用 `YYYY-MM-DD` 的**本地日历日期**。不要用浮点数直接累加金额，也不要在存储前强制转换为 UTC 日期。任何数据库版本升级必须保留已有数据，并通过迁移和备份兼容性测试。

## 4. 备份与恢复

- JSON 格式标识 `savemoney-backup`，当前 **version 1**；包含账单、分类、月度预算和分类预算。
- `validateBackupText()` 检查结构、金额、日期、重复 ID、分类引用和预算约束。
- 设置中的文件校验只读取 JSON，不修改 IndexedDB。
- `restoreBackup()` 再次验证数据，并在一个 Dexie 读写事务中清空并重建相关表。恢复是**覆盖**而非合并。
- F1 将“已触发下载”和“用户手动确认已保存”分别记录在 localStorage。确认不代表应用已经验证云端存在文件。
- CSV / Excel 不替代 JSON 完整备份。

详见 [数据安全说明](DATA_SAFETY.md)。

## 5. 离线与更新

`public/sw.js` 缓存应用资源，首次访问仍需联网。新版本 Service Worker 安装后，界面提示用户确认更新；避免在编辑中无提示刷新。缓存异常或浏览器清理数据可能影响离线可用性。

## 6. 维护流程

1. 建 Issue，说明问题、兼容性与验收标准。
2. 从 `main` 建短期分支；保持一次 PR 只解决一类问题。
3. 执行 `npm test`、`npm run build`；PR CI 成功后再合并。
4. 合并到 `main` 后检查 GitHub Pages 部署结果。
5. 涉及记账、触摸、离线、数据导入导出时，在 iPhone Safari / 主屏幕 PWA 实机验收。
6. 不得要求用户清空 Safari 网站数据来“修复”问题，除非已经充分说明风险并确保备份。

工程规则见 [AGENTS.md](../AGENTS.md)。[PRD.md](PRD.md) 为早期 MVP 文档，部分“下一阶段”措辞不代表当前功能缺失。
