# 固定像素新图帧 v8 · style-unified1

六名角色 × 22 类动作共 132 段，1476 个固定 PNG 帧条目。该数量包括重复曝光与各步相的停止收脚，不代表独立姿势总数。所有身体、四肢和服装由显式姿势坐标与像素画笔命令绘制；面部 / 发型形状保留原有角色参考图，并使用与身体一致的材质色阶。此版不调用图像生成，不使用 AI 补帧、光流、骨骼插值、网格变形或帧混合。

## 绘制与播放

- 绘制源：`scripts/draw-authored-frames.py`；可编辑导出：`drawings.json`，原始脸部参考：`reference/*-idle.png`。
- 每格 192×160 原生像素，固定胯部横轴 96，地面纵轴 144；运行以 0.5 本地尺寸绘制，保留原生像素。每个动作独立输出图集，清单记录边界、原点与文件摘要。
- 前进 / 后退各 16 个循环姿势。抬脚、落脚、屈膝、胯肩和护手随动直接体现在图帧中，按最终位移推进步相。支撑脚每曝光格反向移动一个本地单位，匹配 67.2 世界像素步幅。固定曝光格带来最多约 4.2 世界像素的离散移动，不能靠插值消除。
- 每个步相有对应的抬脚收回图帧。停止时冻结原步相并用 12 个逻辑帧播放收脚，避免同时拖动双脚。
- 拳脚各 12 个准备 / 接触 / 回收图帧，接触在第 4、5 号帧；招式使用既有发生、有效与收招时序。连打 SA 复用对应固定接触 / 收回帧，不对图片变形。苍月剑尖和持剑手分别绘制。
- 跳跃、空中攻击与必杀各 8 帧，防御 / 受击各 4 帧，倒地 / 起身各 6 帧。倒地的整体旋转在资产绘制时固化进 PNG，运行不额外旋转身体。
- 运行渲染与接触检查必须返回同一缓存 PNG 对象。左右朝向仅整体镜像；身体原点、衣服配色和比例跨动作保持统一。

## 回归与回放

真实 PNG 检查依赖 `@napi-rs/canvas`，按本机 Node 依赖路径设置 `NODE_PATH`。运行：

```sh
node scripts/check-body-motion.cjs
node scripts/check-stable-walk.cjs
node scripts/check-animation-consistency.cjs
node scripts/check-contact.cjs
node scripts/check-startup.cjs
node scripts/check-combo-balance.cjs
node scripts/check-dash.cjs
node scripts/render-drawn-frames.cjs
python3 scripts/encode-drawn-frames-gif.py
```

专项检查读取真实 PNG 脚底接触行并计算世界位置；固定帧对象检查阻止重新引入渲染变形副本。移动测试覆盖两侧、前后走、反复启停、右侧屏幕边缘和 30 / 60 / 120Hz。接触与推挤测试分别验证空挥不推人、真实拳脚接触及正常命中击退。

`output/drawn-frames/drawn-frames.gif` 来自生产游戏循环的 144 帧四栏回放，半速观看。历史 v7 网格步法和 `output/body-motion/` 退出当前版本。

## 画风统一 style-unified1

本次仅调整 RGB 绘制。衣服恢复原画的深蓝 / 绯红 / 暖象牙白 / 紫色，肌肉、服装、护手和头部采用统一的七级材质色阶；褶皱与肌肉明暗按当前固定姿势绘制。身体内部的粗黑分段线改为材质接缝色，外部轮廓和面部特征位置保留。不会补帧或变形。

修复前后 132 张图集的透明通道逐字节相同，1476 个图帧的边界、锚点、时序、接触帧和选帧配置完全相同，清单仅 PNG 摘要变化。`output/style-repair/appearance-check.json` 记录此项检查。战斗、AI、移动速度、连招与判定代码不变。
