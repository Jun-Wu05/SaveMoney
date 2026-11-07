# SaveMoney「我的好物」导出交接（2026-11-07）

- 仓库：Jun-Wu05/SaveMoney；正式站点：https://jun-wu05.github.io/SaveMoney/。
- 本次 PR #179：好物首页右上角新增「导出」；独立页面提供带图 Excel 和 ZIP 完整归档。
- Excel 三个 Sheet：「全部好物」含64×64嵌入照片、价格、完整分类路径、要点、评价；「分类目录」保留空分类、层级和排序；「AI分析说明」内置分析提示词。
- ZIP 包含同一 Excel、images/独立照片及好物专用 backup.json（商品ID、分类ID、图片对应路径）。**当前未实现 ZIP 导入**，保留原 JSON 账本备份。
- 文件由浏览器本地生成，不上传服务器；原账单及数据库不变。采用 write-excel-file 与 fflate；导出前请检查 iPhone 存储空间。
- 验收：检查无图/有图、Excel 单元格保留换行和照片、空分类、ZIP 图片/JSON 对应、分享保存到「文件」App；勿清除 PWA 数据。
