# 美术素材

## 当前角色画风：B 版历史原画恢复

当前游戏的六名角色、132 段动作使用 [characters/art-restoration/](characters/art-restoration/) 中的 132 张固定 PNG 图集。来源、比例、锚点、重建命令和回归说明见 [画风恢复设计](characters/art-restoration/DESIGN.md)。本次恢复直接复用选定历史版本的完整原画，没有重新生成角色或使用 AI 补帧。

`js/arcade-animation.js` 将恢复目录接入当前动画系统；二段跳、冲刺、连招、AI、操作及场景功能保留。`animation-v7/` 和 `animation-v8/` 的旧素材及绘制源仍保留，目录中显示较早的最后修改时间不代表当前游戏没有更新。

## 历史素材来源与场景说明

以下记录早期角色素材与场景的制作过程；其中历史角色图集的运行方式属于当时版本，当前角色以本页顶部的恢复目录为准。场景资源仍由当前场景系统使用。

本版本使用内置 image_gen 生成六名原创角色和四张场景，参考经典动漫像素格斗游戏的清晰轮廓、服饰层次与舞台氛围；未直接使用《死神 VS 火影》的角色图片或地图文件。

- `characters/*-v2.png`：每名角色 4×4 透明姿势图集，共 16 帧。运行时裁切、统一比例并缓存命中闪光版本。
- `stages/*-v2.png`：四张场景。运行时降采样为 640×360 的像素层，叠加环境动画。
- `characters/prompts.json`：角色生成提示词，共用提示加各角色描述。
- `stages/prompts.json`：场景生成提示词。

素材均从项目本地加载，不依赖外部图片服务。当前是有限关键帧动画；升龙与突进各有一个专用姿势，移动及受击位移由游戏逻辑驱动。

## 移动图集 v3

`characters/*-movement-v3.png` 使用内置 image_gen、以各角色 v2 图集为外观参考新增；每张 8 列×4 行，共 32 帧，依次为前进、后退、前跳、后跳。完整提示词与参考列表见 `characters/movement-prompts.json`。苍月后跳部分素材朝左，渲染时逐帧镜像校正，始终保持面向对手。

## 宽幅场景 v3

`stages/*-panorama-v3.png`：通过内置 image_gen，以各地图 `*-v2.png` 为编辑参考扩展左右场景。完整图直接绘制为 1440×540 舞台，统一比例，无镜像拼接和逐行变形。中央保留原场景构图，左右新增各不相同的建筑和环境。提示词见 `stages/panorama-prompts.json`。旧素材保留作源文件。

## 新增舞台

内置 imagegen 以现有道场全景为画风参考，生成三张独立宽幅场景：`station-panorama-v3.png`（雨夜车站）、`snow-panorama-v3.png`（雪山神社）、`garden-panorama-v3.png`（空中庭院）。文件位于 `stages/`，提示词见 `stages/new-stage-prompts.json`。均为完整全景，无镜像拼接。

## 拳脚投技图集 v4

内置 imagegen 为六名角色各生成4×4透明图集，`characters/*-combat-v4.png`。四行分别为轻脚、重脚、下段踢击、投技，每行4帧。参考原角色图集保持身份与像素画风，提示词见 `characters/combat-prompts.json`。


## 街机动作重绘 v7

使用内置 imagegen 参考原六名角色，重新绘制固定根节点的街机关键姿势。`characters/animation-v7/` 保存六名角色完整的 7 组 4×4 图集：移动、站姿、防御、跳跃、空中攻击、拳脚必杀和受击起身。所有图集均通过透明连通区域编目后接入运行时。

生成结果按实际透明连通区域生成 `manifest.json`，不按网格盲切。所有 PNG 原样保存；运行时 Canvas 只隔离和裁切角色，保持每段统一比例，不逐帧拉伸或叠化。运行时按角色完整加载；该角色素材加载失败时回退到自己的原图集。

### 角色形象修正

内置 imagegen 重绘了 13 张人物形象错误的图集，另存 `characters/animation-v7/*-identity-v1.png`。全部六名角色的衣服、发型和武器以原始角色与站姿图为准，素材列表及文件摘要锁定在 `identity-lock.json`。生成提示词和参考路径保存在 `identity-prompts.json`、`identity-extra-prompts.json`，具体修正清单见同目录 `DESIGN.md`。

`scripts/catalog-animation-v7.py` 用 Pillow 读取原图生成目录元数据，不修改图片；需要本地 Pillow 环境。`js/arcade-animation.js` 消费目录并缓存实际帧，招式逻辑保持 60 Hz。
