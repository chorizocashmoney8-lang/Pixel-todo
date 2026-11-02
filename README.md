# Pixel Todo

Windows桌面待办与番茄钟,当前软件版本 **1.1.0**。

功能包括角落小窗/托盘、待办与回收站、25+5分钟番茄钟、手动立即完成、统计、7套像素主题及角色、字体和声音设置。全部数据存储在本机。

## 开发

在此目录执行(当前工程使用Node.js 24)：

```bash
npm ci
npm test
npm start
npm run dist
```

`dist/`包含构建产物,Windows安装包为 `Pixel Todo Setup 1.1.0.exe`。打包复用已安装的Electron运行时并使用系统证书库;不关闭TLS校验。

## 目录

- `main/`:计时、JSON持久化、窗口、托盘和音频导入。
- `preload/`:页面有限API。
- `renderer/`:完整窗口、小窗、提醒和共享主题/角色。
- `assets/`:本地音频、字体和应用图标。
- `test/`:Node自动测试。
- `docs/`:本次1.1.0对应的需求/技术设计快照。

## 升级与数据

保留原数据文件位置;v3升级为v4,首次升级时创建 `pixel-todo.json.v3.bak`。用户数据不放在源码仓库中,重新构建不会清空待办。

安装前从托盘退出旧版。开发检查通过独立数据目录运行,不会读取个人待办。

## Git

源码、测试、资源、package.json和锁文件需要纳入版本控制。`node_modules/`、`dist/`和本地配置由`.gitignore`排除。安装包使用GitHub Release附件发布,不加入普通Git提交。

## 资源

Fusion Pixel字体采用OFL-1.1,许可证见 `assets/fonts/OFL.txt`。角色使用本项目已确认的像素素材;三种内置提示音为本项目原创合成音频。待办页仅使用一行有署名的现代诗。
