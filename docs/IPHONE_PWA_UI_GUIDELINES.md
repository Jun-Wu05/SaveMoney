# iPhone PWA 界面开发与回归规范

适用范围：SaveMoney 全部 iPhone Safari「添加到主屏幕」的 PWA 页面，尤其是「我的好物」。

## 已发现问题
在 iPhone 主屏幕 PWA 中，点击「商品名称」「品牌 / 店铺」「商品要点」等输入框后，iOS WebKit 会自动放大视口；输入结束、失焦或关闭编辑页后，页面可能无法自动恢复，用户必须双指缩小。**Safari 浏览器标签页正常不代表主屏幕 PWA 正常。**

## 必须遵守的实现规范
1. **所有可聚焦表单控件的计算字体不得低于 16px**：包括 `input`、`textarea`、`select`、日期、金额、搜索框以及新建的弹窗输入。不要只检查 CSS 声明，要检查继承、媒体查询和实际计算样式。
2. 不通过 `user-scalable=no`、`maximum-scale=1` 禁止用户缩放来掩盖问题；保留系统无障碍缩放能力。
3. 优先复用 `GoodsPage.css` 中的现有样式及 `goodsPwaZoom.ts` 的恢复逻辑；新增弹层/表单同样要覆盖，不能依赖 Safari 标签页测试。
4. 输入框的容器宽度要适配窄屏，避免聚焦时横向溢出；页面切换、弹层关闭后检查滚动与焦点状态。
5. 不改变现有主题变量：`--goods-bg:#faf9f5`、`--goods-ink:#23211f`、`--goods-accent:#cc785c`、`--goods-line:#e9e4dc`、`--goods-soft:#f3eee8`。

## 每次新增或修改输入交互的验收清单
- [ ] iPhone Safari 标签页打开：逐个点击、输入、失焦，页面比例正常。
- [ ] **iPhone 主屏幕 PWA 打开**：重复相同操作，不发生自动放大。
- [ ] 点击输入框后使用键盘「完成」、点空白处、点返回、关闭弹窗，视口自动恢复。
- [ ] 商品名称、品牌、要点、评价、金额、日期、搜索、备注等所有输入控件逐一测试。
- [ ] 页面可正常上下滚动；横向不溢出；不出现白边、闪烁或滑动卡顿。
- [ ] 升级前备份数据；升级后已有商品、图片、分类、账单和导出仍正常。
- [ ] 不清除 PWA 网站数据；浏览器验收通过后必须再做主屏幕 PWA 真机验收。

## 回归参考
- `src/GoodsPage.css`：现有 `.goods-screen input, .goods-screen textarea, .goods-screen select { font-size:16px!important; }` 规则。
- `src/goodsPwaZoom.ts`：现有 PWA 缩放恢复机制。
- 新功能 PR 描述必须明确填写「Safari 测试结果」和「主屏幕 PWA 测试结果」，不能以一项代替另一项。
