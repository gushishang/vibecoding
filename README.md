# PLWeb 云端作品远程编辑器（Vue Vapor + Naive UI）

## 功能
1. 现代 Markdown 编辑器（`md-editor-v3`，带工具栏和预览）。
2. 云端作品列表获取：登录后从 Physics-Lab 云端拉取当前用户 Discussion 作品。
3. 云端更新作品：读取作品后通过 `Contents/SubmitExperiment` 更新标题与正文。
4. 登录信息本地保存：邮箱/密码写入 localStorage；UI 使用弹窗登录。
5. 日志折叠面板：调试日志可折叠显示，折叠时编辑器高度更高。
6. 标题关键字搜索：左侧支持按云端标题关键字检索。
7. 分类是本地可编辑，标签是云端只读；支持按本地分类筛选。
8. 列表缩略图：通过代理加载封面缩略图，避免防盗链问题。
9. 更换封面：顶部 icon 按钮上传图片并调用云端换封面流程。

## 启动
```bash
npm install
npm run dev
```

## 测试
```bash
npm run test
npm run build
```
