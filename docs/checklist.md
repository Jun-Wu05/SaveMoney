# SaveMoney 交付清单

## 已实现（代码）

- [x] React + TypeScript + Vite 工程初始化
- [x] 五个基础页面：首页、记一笔、账单、统计、设置
- [x] Dexie + IndexedDB 本地账本存储
- [x] 收入与支出记录的新建、修改、删除
- [x] 月度明细及分类消费统计
- [x] JSON 完整备份、格式校验、事务恢复
- [x] CSV 账单导出
- [x] PWA Manifest、Service Worker、离线资源预缓存
- [x] GitHub Actions 测试与 GitHub Pages 部署工作流
- [x] 金额与备份格式的基础单元测试

## 尚待真实环境验证

- [ ] GitHub Actions 中 npm test 成功
- [ ] GitHub Actions 中 npm run build 成功
- [ ] GitHub Pages 已启用且发布成功
- [ ] iPhone 真机主屏幕安装
- [ ] 飞行模式下断网记账
- [ ] iPhone 实际导出、保存、恢复文件
- [ ] 多台 iPhone 互相独立，互不读取账单

## 安全底线

禁止在备份恢复通过前，宣传为绝对不会丢失数据的财务存储服务。
