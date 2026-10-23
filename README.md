# SaveMoney · 个人本地记账

一款为 iPhone 日常使用设计的免费、轻量记账 PWA。打开就能记账，无需注册、登录或订阅。

**[打开 SaveMoney](https://jun-wu05.github.io/SaveMoney/)**

> **数据仅保存在当前设备。** SaveMoney 没有账号、云同步或账单服务器。手机丢失、删除网页 App、清理网站数据或浏览器存储异常都可能导致记录无法恢复。请定期导出完整 JSON 备份，并确认文件已保存到 iCloud Drive 等独立位置。详见 [数据安全说明](docs/DATA_SAFETY.md)。

## 功能

- **快速记账**：记录支出/收入、金额、分类、日期和备注；支持编辑、删除、复制账单与常用分类排序。
- **账单查看**：按月浏览，支持日历/列表视图、筛选和搜索。
- **消费统计**：首页环形分类图、每日支出、分类排行、近六个月趋势及月度回顾。
- **预算管理**：月度总预算与分类预算。
- **分类管理**：添加、修改、删除未使用分类，自定义分类图标。
- **导入与导出**：完整 JSON 备份/恢复、CSV 导入与导出、按月份工作表导出 Excel。
- **离线使用**：首次联网打开并成功缓存后，可在支持的设备环境中离线记账；应用更新由用户确认。

> JSON 是完整备份格式（包括账单、分类和预算）；CSV / Excel 主要用于查看、整理或交换账单，不等价于完整 JSON 备份。

## iPhone 使用

1. 使用 Safari 打开 [在线地址](https://jun-wu05.github.io/SaveMoney/)。
2. 在分享菜单中选择 **添加到主屏幕**，从主屏幕打开 SaveMoney。
3. 新增一笔账单，确认首页、账单和统计数据正常。
4. 打开 **设置 → 数据管理**，导出完整 JSON；在「文件」App 或 iCloud Drive 中找到文件后，手动确认已保存。
5. 可选择已保存的 JSON 文件进行**只读校验**，不会覆盖账本。真正执行「恢复」会覆盖当前所有账单、分类和预算，请谨慎操作。

**重要：** Safari 浏览器与主屏幕网页 App 可能具有不同的存储环境；请始终从你实际记账的入口操作备份，切勿假定数据自动共享。建议至少每周确认一次外部备份。

## 本地开发

要求 Node.js 22（与 CI 一致）和 npm。

```bash
npm install
npm run dev
npm test
npm run build
```

开发服务器地址以终端输出为准。生产构建包含 TypeScript 类型检查、Vite 构建与离线预缓存清单生成。

## 技术架构

React 19 · TypeScript · Vite · Dexie / IndexedDB · Vitest · Lucide · GitHub Actions · GitHub Pages。

- **无后端、无登录、无云同步**；账单不会主动上传到开发者服务器。
- 金额以整数分存储，账单日期按本地日历日保存。
- `src/App.tsx` 负责主要页面协调；记账编辑、分类管理和图标组件已独立拆分。
- `src/db.ts` 维护 IndexedDB；`src/backup.ts` 维护 JSON 备份格式和校验。
- `public/sw.js` 提供离线缓存；`.github/workflows/pages.yml` 负责 PR 测试与 main 分支部署。

详见 [架构文档](docs/ARCHITECTURE.md)。

## 发布与验收

仓库通过 GitHub Actions 在 PR 上执行 `npm test` 和 `npm run build`；合并到 `main` 后构建并部署 GitHub Pages。自动化测试不能替代 iPhone Safari 和主屏幕 PWA 的实机验证，尤其是触摸、离线、备份和恢复操作。

如首次部署，请在 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**，再查看 [Actions](https://github.com/Jun-Wu05/SaveMoney/actions) 结果。

## 项目文档

- [架构与模块说明](docs/ARCHITECTURE.md)
- [数据安全、备份与恢复](docs/DATA_SAFETY.md)
- [AI / 开发约束](AGENTS.md)
- [初始产品需求（MVP 历史基线）](docs/PRD.md)

当前定位是**个人本地使用**，不计划引入多人共享、银行同步、账号体系、广告或收费 API。
