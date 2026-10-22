# SaveMoney 小账本

给自己和朋友使用的极简 iPhone 记账 PWA。

- **不需要账号**：每个用户的数据独立保存在自己设备的 IndexedDB。
- **没有后端**：不上传账单。
- **免费分享**：通过 HTTPS 网页地址添加到 iPhone 主屏幕。
- **支持离线**：首次联网加载、安装完成后可离线记账。
- **提供数据备份**：设置页面导出 JSON、恢复 JSON，或者将账单导出为 CSV。

## 在线地址

启用 GitHub Pages 并成功完成构建部署后：

https://jun-wu05.github.io/SaveMoney/

### 第一次启用 GitHub Pages

1. 打开此仓库 `Settings → Pages`。
2. 在 `Build and deployment → Source` 中选择 `GitHub Actions`。
3. 打开 `Actions` 观察 `Test and publish iPhone PWA` 工作流。
4. 如果没有触发，在 Actions 中选择该工作流并点击 `Run workflow`（main 分支）。
5. 等待绿色部署成功，再打开上面的在线网址。

> 本项目使用 GitHub Pages 免费托管。公开仓库代码不包含你的个人账本。

## Windows 开发

安装 Node.js 22 或受支持的 LTS 版本。

```bash
npm install
npm test
npm run build
npm run dev
```

电脑开发预览：终端输出的本地网址。GitHub Pages 上线后使用真实 iPhone 的 Safari 测试。

## iPhone 使用

1. 用 **Safari** 打开在线地址。
2. 点击分享图标 → **添加到主屏幕**。
3. 打开桌面上的 SaveMoney，新增一笔账单。
4. 进入 **设置 → 导出完整备份**，务必将备份保存到“文件”或 iCloud Drive。
5. **设置 → 从备份恢复** 可恢复 JSON 文件（会覆盖当前账本）。

**注意**：它不是 App Store 原生 iOS App，也没有跨设备自动同步。iOS 清理网站存储、卸载网页 App、设备丢失或损坏，都可能使本地账单丢失。建议至少每周备份，重要交易需要单独保存副本。

## 发布前检查

- [ ] CI 测试及生产构建通过
- [ ] GitHub Pages 部署成功
- [ ] iPhone Safari 和主屏幕 PWA 都能新增、编辑、删除记录
- [ ] 断网后能打开、保存及查看账单
- [ ] JSON 完整备份、恢复无数据丢失
- [ ] iPhone 中 CSV 导出可打开
- [ ] iPhone 大小屏适配

## 技术

React + TypeScript + Vite + Dexie/IndexedDB + GitHub Actions + GitHub Pages。不存在后端服务、账号系统或收费 API。

开发约束详见 [AGENTS.md](AGENTS.md)，产品需求详见 [docs/PRD.md](docs/PRD.md)。
