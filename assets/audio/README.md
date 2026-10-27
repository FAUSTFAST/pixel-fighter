# 再战黎明 / Break of Dawn

Pixel Fighter 原创纯器乐主题曲，152 BPM，约 82 秒。旋律与编排由本项目制作，使用真实电吉他、贝斯与原声鼓的单音录音采样，不是真人乐队完整录音。

结构：吉他引子 → 主题 → 清音吉他间奏 → 乐队渐进回归 → 主旋律再现 → 收尾。
录音以本地 MP3 资源加载，无在线 CDN。首页首次点击或按键后播放；支持原有音乐开关、总音量和设置试听。进入对战切回原有舞台配乐。

首页在 3.257894737–79.047368421 秒之间循环，首次保留引子。独立音频保留完整收尾。

## 原始录音与许可

- [FreePats FSBS Electric Guitar Clean #1](https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html)：Fender 电吉他录音，CC0-1.0。
- [Karoryfer Big Little Bass](https://github.com/sfzinstruments/karoryfer.big-little-bass)：贝斯录音，CC0-1.0。
- [Karoryfer Big Rusty Drums](https://github.com/sfzinstruments/karoryfer.big-rusty-drums)：原声鼓组录音，CC0-1.0。
- [Karoryfer 官方许可说明](https://shop.karoryfer.com/pages/free-samples)。

许可副本位于 `licenses/`；逐文件的固定提交 URL 与 SHA-256 位于 `scripts/music/sample-manifest.json`。原始采样仅用于构建，不进入网页或桌面运行资源清单。游戏只需 `break-of-dawn-v1.mp3`。

## 重建

在仓库根目录执行（Python 3.12、FFmpeg；不影响普通游戏运行）：

```sh
python3 -m venv output/theme-song/venv
output/theme-song/venv/bin/python -m pip install -r scripts/music/requirements.txt
output/theme-song/venv/bin/python scripts/music/fetch-samples.py
output/theme-song/venv/bin/python scripts/music/render-theme.py
ffmpeg -i output/theme-song/Pixel-Fighter-Break-of-Dawn-premaster.wav -af volume=-1.56dB -c:a libmp3lame -b:a 224k assets/audio/break-of-dawn-v1.mp3
```

导出参数匹配本次成曲。后续改变编排时需重新测量响度、检查循环点，并同步更新 `js/soundtracks.js` 的循环时间。
