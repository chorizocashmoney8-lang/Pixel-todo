> 1.1.0软件仓库文档快照。此轮来源为Vibecoding/docs/TECH_DESIGN.md;后续更新需与正式实现同步。

# 技术设计 · Pixel Todo 桌面版

状态:第二轮改版实施基准(2026-11-02)。对应 [PRD.md](PRD.md)。实现继续沿用 Electron + 原生 HTML/CSS/JS,在第一版上演进。

## 1. 技术栈与目录

- Electron,目标 Windows 10/11;electron-builder NSIS 安装包。
- 不引入前端框架;主进程 CommonJS,渲染层原生 JavaScript。
- 源码位于 `working/pixel-todo-desktop/`;用户验收的最终安装包位于 `deliverables/`。
- 使用 `node:test`;安全边界为 `contextIsolation: true`、`nodeIntegration: false`,通过 preload 白名单 IPC。

```text
main/       生命周期、窗口、托盘、计时、JSON存储、IPC
preload/    renderer可调用的有限API
renderer/app/     完整窗口、待办、番茄钟、统计、设置、提醒
renderer/widget/  角落小窗口
renderer/shared/  日期/排序/像素样式与动画
assets/     图标、授权字体、角色和音频资源
test/       纯逻辑、存储、计时、IPC测试
```

## 2. 状态与 v3→v4 迁移

- 主进程是唯一数据写入者;渲染进程仅拿状态副本并经 IPC 请求修改。状态更新后广播 `state:changed`。
- `pixel-todo.json` 版本升为4。保留 v3 的 tasks、pomodoros、timer 和已有 preferences;仅合并新增偏好默认值,不得重置已有值。
- 新增偏好包括 theme、font、buddy、idleMode/face/pose、animation、sound、volume。字段缺失使用 PRD 默认值。
- 文件使用临时文件写入后 rename;损坏文件备份后用默认状态启动。

## 3. 窗口、托盘与提醒

- 完整窗口无系统标题栏,尺寸约900×626,最小尺寸需保证页面控件可用;关闭按钮隐藏窗口,收起显示小窗。
- Widget按偏好在248/216像素宽之间切换,高度随角色区域切换;完整窗口展示期间隐藏。任务点击展开完整窗口;托盘点击可恢复。Widget右上角“×”进入暂时隐藏状态;自然到点提醒清除此状态并在完整窗口未显示时恢复Widget。托盘打开完整窗口也清除此状态,之后收起主窗口恢复Widget。
- Widget位置超出显示器工作区时回落主屏右下角;默认不置顶。
- 自然到点由主进程计时器触发一次提醒事件:渲染显示主题色像素弹窗并播放选定声音一次;主进程控制托盘慢闪10秒。确认事件停止音频和闪烁。
- 托盘提醒状态不能依赖渲染窗口是否可见;弹窗保持到确认。用户手动立即完成不触发自然结束提醒。

## 4. 计时与记录

- 以 `endAt` 时间戳计算剩余时间,由主进程负责计时与恢复。
- 自然完成和手动立即完成均写入一条记录并进入5分钟休息;记录增加 `completion: 'timer' | 'manual'`。放弃不写记录。
- 休息自然结束回 idle。应用重启后根据 phase/endAt 恢复;已过期的学习段最多补记一次,休息段回 idle。
- 渲染倒计时只在可见前台更新;隐藏/后台时取消动画和气泡轮换。

## 5. 渲染与素材

- 保留七套主题变量与七套已确认角色外观,构建时将角色SVG/像素图案作为本地静态资源打包,不运行时联网或依赖原型页面。
- Fusion Pixel 12px Proportional SC以其许可证允许的形式随软件分发;设置提供系统字体回退。
- 内置音频作为本地资源打包;导入音频复制到 userData/sounds/ 的受控文件中,不保存源路径。实现默认允许 WAV/MP3/OGG/M4A,非空单个文件不超过10 MB;取消选择不修改状态。音量由 renderer 音频播放层控制。
- CSS `steps()` 实现轻量逐帧动画;依据文档可见性及应用前后台状态暂停。随机角色轮换默认8秒,只在小窗可见且应用前台时运行。
- 所有任务文字以 `textContent` 展示,不将用户文本解释为HTML。

## 6. 安全与平台限制

- 仅支持 Windows;Electron sandbox/context isolation 保持开启,renderer不直接访问 Node 或文件系统。
- IPC逐项校验参数,文件操作和用户导入路径只由主进程处理。
- 不联网、不上传用户数据或音频。系统开机启动沿用 Electron `setLoginItemSettings`。

## 7. 测试与打包

- `npm test`:覆盖 v3→v4迁移及保留数据、偏好默认值、任务与回收站、计时自然/手动/放弃、统计、损坏文件恢复、IPC校验。
- 手动/自动界面验证:窗口收放和托盘恢复、248/216尺寸、七主题与角色、字体、设置持久化、提醒单次播放/10秒闪烁/确认停止、后台暂停。
- `npm run dist` 使用electron-builder构建 Windows NSIS 安装包。构建文件保留在 `dist/`;验收后的安装包复制到 `deliverables/`。
- Git上传由用户学习并手动执行;不在构建脚本中自动初始化、提交或推送。
