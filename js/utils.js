// ============================================================
// utils.js — 通用工具:数学、绘制辅助、矩形碰撞、像素绘制助手
// ============================================================
(function () {
  const U = {};

  U.clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
  U.lerp  = (a, b, t) => a + (b - a) * t;
  U.sign  = (v) => v < 0 ? -1 : (v > 0 ? 1 : 0);
  U.rand  = (a, b) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(U.rand(a, b + 1));
  U.chance = (p) => Math.random() < p;

  // 轴对齐矩形重叠检测 {x,y,w,h}
  U.overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y;

  // 画一个填充圆角矩形
  U.rr = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  };

  // 简易像素文本(用 canvas 内置字体但关闭抗锯齿感)
  U.text = (ctx, str, x, y, size, color, align = 'left', weight = 'bold') => {
    ctx.font = `${weight} ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  };

  // 带描边的标题文字
  U.textOutline = (ctx, str, x, y, size, fill, stroke, align = 'center') => {
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(2, size / 8);
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  };

  // 画像素方块(用于精灵绘制) — 以 scale 放大
  U.px = (ctx, x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // 颜色调暗/调亮
  U.shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = U.clamp(Math.round(r + amt), 0, 255);
    g = U.clamp(Math.round(g + amt), 0, 255);
    b = U.clamp(Math.round(b + amt), 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  window.U = U;
})();
