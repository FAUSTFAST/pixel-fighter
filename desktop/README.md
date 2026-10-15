# Pixel Fighter 桌面构建与发布

这套工具只读取原来的 `index.html`、`css/`、`js/` 和运行素材。网页开发、原启动脚本、GitHub Pages 与现有战斗架构继续保留。所有中间文件、运行时、测试记录和安装包均位于被 Git 忽略的 `output/desktop/`；不会写回角色、动画或战斗代码。

## 当前保护点

- 工作分支：`codex/desktop-packaging`，原 `main` 未改动。
- 开始封装前检查点：`efa479ec1137fd5d9a7d2d741dc6cd475edde847`。
- 标签：`before-desktop-packaging-20261015`，包含当时唯一未跟踪的 `animation-v8/review.png`。
- 全历史离线 Git bundle：`output/desktop/checkpoint/pixel-fighter-before-desktop.bundle`，已经 `git bundle verify` 确认包含完整历史。请另存到外置盘或自己的备份介质，避免与电脑同时损坏。
- 该 bundle 保存 Git 源码、素材和全部已有提交；不含 `output/` 中可再生成的历史回放、缓存与安装包。

安全查看检查点（不要重置当前工作区）：

```sh
git worktree add --detach ../pixel-fighter-before-desktop before-desktop-packaging-20261015
```

独立恢复备份为一个新目录：

```sh
git clone output/desktop/checkpoint/pixel-fighter-before-desktop.bundle ../pixel-fighter-recovered
```

不要对现有目录使用 `reset --hard`、强制覆盖或强制推送。以后要撤销封装，可在保存当前修改后对封装提交使用 `git revert`；游戏源文件本身没有被重写。

## 环境与命令

开发电脑需要 Node.js 22.12+、npm、Git；macOS 构建还需要 Xcode Command Line Tools。玩家不需要这些工具。依赖全部是构建时依赖，版本及完整性固定在 `package-lock.json`，游戏包没有生产 npm 依赖。

```sh
npm ci
npm run desktop:prepare
npm run desktop:test
npm run desktop:regression
npm run desktop:build:win
npm run desktop:build:mac
npm run desktop:verify
```

Mac 构建必须在 macOS 上运行；Windows 可以在 Windows 本机构建，本项目也已在 Mac 上交叉构建 x64 ZIP。Windows 上只验证对应产物：

```sh
npm run desktop:verify -- --platform=win
```

开发预览：`npm run desktop:dev`。如果本机 npm 的安装脚本策略跳过 Electron 下载，先运行 `node node_modules/electron/install.js`。网页原有启动方式不受影响。

**不要同时在同一个 checkout 内运行两个构建命令**，两者会共享可再生成的 staging；CI 使用完全独立的 Windows/Mac runner。安装包已独立保存，重新构建只更新对应版本的生成文件，不触碰原始项目。需要保留旧安装包时先另存，或先更新版本号。

## 输出

`output/desktop/releases/`：

- `Pixel-Fighter-Windows-x64-v1.0.zip`：解压整个文件夹，打开 `Pixel Fighter.exe`；不要只移动 EXE，旁边的 DLL、资源和语言文件必须保留。
- `Pixel-Fighter-macOS-Universal-v1.0.zip`：解压得到 `Pixel Fighter.app`。
- `Pixel-Fighter-macOS-Universal-v1.0.dmg`：将应用拖入 `Applications` 快捷方式安装。
- `SHA256SUMS.txt`：对最终 ZIP/DMG 校验。

`mac-universal/` 和 `win-unpacked/` 是独立构建输出，不是原始项目。公开发布只上传上面三个包和校验文件/必要发行说明，不能上传整个 `output/`、源码目录或 Git bundle。

版本从根 `package.json` 读取。`1.0.0` 的文件名显示 `v1.0`，`1.1.0` 显示 `v1.1`，非零补丁版本完整保留。以后运行 `npm version 1.1.0 --no-git-tag-version`（或 `1.2.0`、`2.0.0`）同步更新包与锁文件，再重新执行构建命令即可。Git 提交和锁文件照常用于 Codex 开发。

## 封装与源码保护边界

- Electron 44.7.2 / electron-builder 26.15.3；保留现有 60 Hz 游戏循环，不改招式、碰撞、动画、输入或视觉参数。
- 生产 JS 使用 Terser 压缩、局部变量名混淆。保留全局 API、属性名和脚本顺序，禁用不安全数学优化，不生成 Source Map。没有使用字符串虚拟机、动态 eval 等易破坏功能的重度混淆。
- HTML/CSS、图集、JSON 逐字节复制；根据三个实际动画 manifest 的覆盖顺序提取最终图集，同时保留角色 fallback 图、七张舞台图及 Web Audio 配乐脚本。新增素材/入口后应重新审核 `prepare.cjs` 和依赖闭包测试。
- ASAR 只包含 225 个运行文件：桌面入口/协议、最小包元数据，以及 24 个脚本、HTML/CSS、196 个运行资源。没有原 Git 历史、测试、开发文档、审阅图、绘图工程或历史废弃图集；法律要求的 Electron/Chromium 许可证仍保留。
- **ASAR 是归档，不是加密。压缩与混淆不能彻底阻止逆向，运行必需的 JS 和图片仍可被提取。** 不要把密钥、服务端验证或商业秘密放进客户端。
- Renderer 无 Node.js、无 preload/IPC 桥，开启 sandbox、contextIsolation、webSecurity；限制导航、新窗口、下载和权限。自定义安全本地协议支持 JSON fetch/Canvas；CSP 不允许外部脚本、eval 或在线连接，HTTP(S)/WebSocket 请求另行拦截。
- 所有运行资源离线打包；没有 CDN、遥测或自动下载更新。首次键盘/鼠标交互按原逻辑解锁音频。设置存入桌面应用自己的 Chromium 用户数据目录，与浏览器版分开。
- 保留 GPU 加速和现有响应式像素画布；窗口按屏幕工作区域初始化，支持 Retina/高 DPI，F11 切换全屏。最小化/失焦仍使用游戏原有暂停逻辑。没有禁用沙箱来节省内存。
- 安装时 npm audit 报告 8 项 moderate，来自构建工具的同一 `sprintf-js` 精度格式化拒绝服务公告及其依赖链（`GHSA-hp3w-g68c-fv3c`）；它们没有进入游戏 ASAR。没有执行会降级构建工具的 `npm audit fix --force`。报告在 `output/desktop/dependency-audit.json`，正式发布前应复查上游修复；这不等同于“所有依赖零风险”。

## 系统支持与签名

- Windows 10/11 x64：便携包，未做 Authenticode 签名，SmartScreen 可能提示未知发布者。完整运行时随包提供。
- macOS 13+：所有 13 个 Mach-O 二进制都含 arm64 与 x86_64；ZIP 用 `ditto --keepParent --sequesterRsrc` 保存权限与框架符号链接。
- 当前机器没有 Apple Developer ID 身份。应用仅做 ad-hoc 临时签名，`codesign --verify --deep --strict` 通过，**没有 Developer ID 签名或 Apple 公证**。本机构建后能启动，不表示互联网下载后一定能双击启动。下载包带隔离属性时，Gatekeeper 可能阻止打开；确认来源和 SHA256 后，按 macOS 的“隐私与安全性 → 仍要打开”等明确批准流程处理。不要关闭系统 Gatekeeper。
- 正式可信分发需要用户提供自己的 Developer ID Application 证书并完成 notarization/staple；Windows 可信发布需要自己的代码签名身份。证书、密码和 Apple API 私钥只能放受保护的 CI secrets/keychain，不能提交 Git。
- 当前配置明确禁用公证、启用临时签名。获得证书后需另行审核改为正式签名配置，缩减临时签名所需的 `disable-library-validation` 权限，再重新构建验证；不要仅放一个证书就声称已经公证。

## GitHub 自动构建与公开发布

目前仅增加本地工作流文件，**没有推送、运行远程构建、修改可见性、创建公开仓库或正式发布**。

1. 经用户确认后，将源码仓库 `FAUSTFAST/pixel-fighter` 改为 Private；保留全部历史，禁止 Archive。私有化不会收回别人以前已经下载的公开副本。权限仅保持所有者/明确授权的人，不添加协作者。
2. 经用户确认后，另建空的公开发布仓库，例如 `FAUSTFAST/pixel-fighter-releases`；只放必要说明及包。GitHub 自动显示的 Source code ZIP 来自该发布仓库自己的少量说明文件，不应来自原源码仓库。
3. `.github/workflows/desktop-build.yml` 支持手动运行及 `desktop-v*` 标签触发。Windows 使用 `windows-latest`，Mac 使用 `macos-latest`，分别安装锁定依赖、测试、构建和校验。`fail-fast: false`，失败不会改动源码；两边均成功后才收集为 `desktop-release-bundle`。Artifacts 保留 30 天，审计 JSON 单独保存，不混入公开包。
4. 工作流默认只有 `contents: read`，不自动发布，不需要发布 token。上传此工作流并在 GitHub 成功运行前，不能声称 CI 已验证。新的桌面版本用 `desktop-v1.1.0` 等标签，先确保 `package.json` 对应版本一致。
5. 在源仓库设置受保护的 `desktop-release` environment，启用 required reviewers（套餐支持时），并配置 `RELEASE_REPOSITORY_TOKEN`：fine-grained token **只允许公开发布仓库** 的 Contents 写入/必要 Metadata 读取，不赋予源码仓库权限。使用专用最小权限 token，不在代码或日志打印。
6. `.github/workflows/desktop-publish.yml` 必须由人手动执行，传入成功的构建 run ID、目标仓库、版本。它先确认源码已是 Private、目标与源不同、构建来自本仓库正确工作流且成功；下载唯一集中 artifact，只允许三个规定包和 SHA256 文件，校验后才在公开仓库建立 **draft release**。不 checkout/push 源码到公开库，也不自动正式发布。随后由用户审阅并点击发布。
7. 若套餐无法使用 environment required reviewers，不要把它当作受保护审批；保留手动触发、最小权限 secrets 和 draft 阶段，并由用户最终发布。

## 验证与人工验收

自动检查报告均在 `output/desktop/`：

- `resource-manifest-*.json`：源文件与包内文件 SHA256、196 个运行资源，动态 JSON 引用闭包。
- `production-regression.json`：压缩前后六名角色 1,452 个实际原画精灵逐像素一致；七地图、三个镜头位置共 21 张画面一致；三档 AI 下 6,480 个确定性战斗帧状态一致。使用项目真实 PNG、原游戏循环/物理/接触检测，而不是假图帧。
- `verification-win.json`：x64 PE、随附运行时、ZIP 路径、ASAR 白名单及哈希。**这是包检查，不是 Windows 实机启动测试。**
- `verification-mac.json`：13 个 Mach-O 双架构、临时签名、ZIP 解压后的可执行权限/符号链接、只读挂载 DMG 的应用和 Applications 链接。**这不等同于 Intel Mac/Gatekeeper 实机通过。**
- 原有移动、原画连续性、碰撞、连段、冲刺、二段跳和 AI 检查仍可照常运行；包装测试不会替代这些游戏规则检查。

每个平台正式发布前分别人工验收，记录系统版本/芯片/包 SHA256，不能只用构建成功代替：

1. 在没有 Node.js 的 Windows 10、Windows 11、Apple Silicon Mac、Intel Mac 上解压完整包，从 EXE/Finder 启动；Mac 另测 DMG 拖入 Applications。首次安全拦截单独记录，不使用系统保护全局关闭绕过。
2. 断开网络后重启游戏，等待六名角色与七张地图全部加载；无缺图、fallback、控制台异常。主菜单、出招表、动作图鉴、设置页可打开/关闭。
3. 双方各走前后、反复启停、移到屏幕两端；角色风格、比例、脚底和朝向与网页当前版一致。测试单跳/二段跳和六种空中拳脚、普通技、波、上升/突进必杀、OD、SA、投技。
4. 分别确认真实命中、挥空、防御、硬直、连招与伤害修正、普通冲刺/斗气冲刺；失焦暂停、恢复、重开训练场正常。
5. 三档 AI 对战、双人键盘、经典/现代、重绑按键、手柄连接/断开，确认不会被系统快捷键意外抢占。F11 与窗口/系统全屏分别测试；Retina/4K 和缩放/外接显示器检查比例与清晰度。
6. 首次键盘/鼠标交互后实际听音乐与击打音效，测试音量/静音/切地图和重启后的设置保存；没有音频硬件的 CI 不能代替听音验收。

本机已完成 Apple Silicon Mac 的打包应用启动、主菜单/训练设置、疾风/铁拳与美琳/闪电的实际原画战斗画面、键盘移动、地面扣血、空中重脚命中/受击特效、霓虹舞台切换、AI 行动、暂停出招表和 Retina 窗口/全屏切换。系统再次锁屏后停止进一步 UI 操作；听音、全部角色/技能完整交互、断网重启、Windows 与 Intel Mac 的实际启动尚需验收。不会把这些写成已通过。

额外执行原 `scripts/check-stage-depth.cjs` 时，它要求战斗文件与早期 `17923fd` 完全相同，因此在 `fighter.js` 字节比对处失败：该基准早于已经提交的空中招式功能。当前 `fighter.js` 与封装前检查点 SHA256 完全相同，未为让旧测试通过而改动原测试或游戏。本次 21 张地图画面对比覆盖当前版本的压缩前后视觉一致性，但不把旧测试记录成通过。

官方依据：[Electron 安全建议](https://www.electronjs.org/docs/latest/tutorial/security)、[本地协议](https://www.electronjs.org/docs/latest/api/protocol)、[electron-builder macOS 配置与临时签名](https://www.electron.build/v26/docs/mac/)、[Windows 配置](https://www.electron.build/v26/docs/win/)。
