const W = 720;
const H = 1280;

// 时钟位于画面高度的三分之一
const CLOCK_Y = H / 4;
const CLOCK_X = W / 3;

// 海洋从秒数字下方开始
const SOURCE_Y = CLOCK_Y + 188;

// 秒数字所在区域的中心
const SOURCE_X = 576;

let pg;
let seaLayer;

let timeString = "";

let clockGroups = [];
let falling = [];
let ocean = [];
let ripples = [];

let oceanTime = 0;
let frameT = 0;

const SLOT = 72;
const DIGIT_SIZE = 104;
const GLYPH_STEP = 3;

const MAX_FALLING = 1800;
const MAX_RIPPLES = 120;

// 海洋粒子循环容量
const OCEAN_CAPACITY = W * 9;

// =====================================
// SETUP
// =====================================

function setup() {
  pixelDensity(1);

  const renderer = createCanvas(W, H);

  renderer.elt.style.width = "100%";
  renderer.elt.style.height = "auto";
  renderer.elt.style.display = "block";

  pg = createGraphics(100, 130);
  pg.pixelDensity(1);

  seaLayer = createGraphics(W, H);
  seaLayer.pixelDensity(1);
  seaLayer.background(0);

  timeString = getTime();

  initializeClock();
}

// =====================================
// MAIN DRAW
// =====================================

function draw() {
  frameT += 0.008;

  drawBackground();

  checkTime();

  updateFalling();
  updateOcean();
  updateRipples();

  drawOcean();
  drawRipples();
  drawFalling();
  drawClock();
  drawSourceGlow();
  drawAtmosphere();
}

// =====================================
// TIME
// =====================================

function getTime() {
  return nf(hour(), 2) + ":" +
         nf(minute(), 2) + ":" +
         nf(second(), 2);
}

function checkTime() {
  let now = getTime();

  if (now === timeString) return;

  let old = timeString;

  for (let i = 0; i < 8; i++) {
    if (old[i] === now[i]) continue;
    if (old[i] === ":") continue;

    releaseDigit(i);
    clockGroups[i] = createDigit(now[i], i);

    // 秒数字变化时，在其下方产生涟漪
    if (i === 6 || i === 7) {
      let x = getSlotX(i) + SLOT / 2;

      addRipple(x, SOURCE_Y, 1);
    }
  }

  timeString = now;
}

// =====================================
// CLOCK POSITION
// =====================================

function getSlotX(i) {
  let total = 8 * SLOT;
  let start = (W - total) / 2+30;

  return start + i * SLOT;
}

function initializeClock() {
  clockGroups = [];

  for (let i = 0; i < 8; i++) {
    clockGroups.push(
      createDigit(timeString[i], i)
    );
  }
}

// =====================================
// PARTICLE FONT
// =====================================

function createDigit(char, index) {
  // 防止无效字符传给 p5.js text()
  if (char === undefined || char === null) {
    char = "0";
  }

  pg.clear();

  pg.textAlign(CENTER, CENTER);
  pg.textFont("monospace");
  pg.textStyle(BOLD);
  pg.textSize(DIGIT_SIZE);
  pg.noStroke();
  pg.fill(255);

  pg.text(String(char), 50, 65);
  pg.loadPixels();

  let points = [];

  for (let y = 0; y < 130; y += GLYPH_STEP) {
    for (let x = 0; x < 100; x += GLYPH_STEP) {
      let idx = 4 * (y * 100 + x);

      if (pg.pixels[idx] > 100) {
        points.push({
          x: getSlotX(index) + x - 50,
          y: CLOCK_Y + y - 65,
          size: random(0.8, 1.3),
          alpha: random(210, 255)
        });
      }
    }
  }

  return {
    char: String(char),
    points
  };
}

// =====================================
// DRAW CLOCK
// =====================================

function drawClock() {
  noStroke();

  for (let i = 0; i < 8; i++) {
    let group = clockGroups[i];

    if (!group) continue;

    for (let p of group.points) {
      fill(245, 250, 255, p.alpha);
      circle(p.x, p.y, p.size);
    }
  }

  // 冒号
  for (let i of [2, 5]) {
    let x = getSlotX(i) + SLOT / 2;

    fill(255);

    circle(x, CLOCK_Y - 14, 2.2);
    circle(x, CLOCK_Y + 20, 2.2);
  }
}

// =====================================
// FALLING DIGITS
// =====================================

function releaseDigit(index) {
  let group = clockGroups[index];

  if (!group) return;

  for (let p of group.points) {
    if (falling.length >= MAX_FALLING) {
      falling.shift();
    }

    falling.push({
      x: p.x,
      y: p.y,
      vx: random(-0.35, 0.35),
      vy: random(0.1, 0.6),
      g: 0,
      size: random(0.7, 1.3),
      alpha: 255
    });
  }
}

function updateFalling() {
  for (let i = falling.length - 1; i >= 0; i--) {
    let p = falling[i];

    p.g += 0.045;
    p.vy += p.g;
    p.vy = min(p.vy, 5);

    p.x += p.vx;
    p.y += p.vy;

    p.size *= 0.999;

    // 数字粒子落入海洋起点
    if (p.y >= SOURCE_Y) {
      addRipple(p.x, SOURCE_Y, 0);
      falling.splice(i, 1);
    }
  }
}

function drawFalling() {
  noStroke();

  for (let p of falling) {
    fill(245, 250, 255, p.alpha);
    circle(p.x, p.y, p.size);
  }
}

// =====================================
// OCEAN PARTICLES
// Original Noise movement algorithm
// =====================================

function updateOcean() {

  // 粒子扩散范围随时间逐渐扩大
  let spread = min(
    W * 0.48,
    8 + oceanTime * 0.035
  );

  // 每帧生成 9 个粒子
  for (let i = 0; i < 9; i++) {

    let index = oceanTime % OCEAN_CAPACITY;

    // 从秒数字下方的涟漪中心生成
    let x = SOURCE_X + random(-spread, spread);

    x = constrain(x, 0, W);

    ocean[index] = {
      x: x,
      y: SOURCE_Y + random(-2, 3),
      g: 0,
      s: 3
    };

    oceanTime++;
  }

  // 原始参考算法：Noise 控制运动
  for (let p of ocean) {

    if (!p) continue;

    p.s *= 0.997;

    let n = noise(
      p.x / W,
      p.y / 9,
      oceanTime / W
    );

    // 横向运动
    if (n > 0.4) {
      p.x += 0;
    } else {
      p.x += n % 0.1 > 0.05 ? 1 : -1;
      p.g = 0;
    }

    // 纵向运动
    if (n > 0.4) {
      p.g += 0.5;
      p.y += p.g;
    } else {
      p.y += 0.5;
    }
  }
}

// =====================================
// DRAW OCEAN
// Original trails and blur
// =====================================

function drawOcean() {

  // 黑色半透明覆盖，保留上一帧轨迹
  seaLayer.background(0, 9);

  // 原参考代码中的模糊效果
  seaLayer.filter(BLUR);

  // 蓝色 Noise 粒子
  for (let p of ocean) {

    if (!p) continue;

    let depth = constrain(
      (p.y - SOURCE_Y) / (H - SOURCE_Y),
      0,
      1
    );

    seaLayer.stroke(
      75 + depth * 30,
      155 + depth * 45,
      255,
      210
    );

    seaLayer.strokeWeight(p.s);
    seaLayer.point(p.x, p.y);
  }

  image(seaLayer, 0, 0);
}

// =====================================
// RIPPLE
// =====================================

function addRipple(x, y, initialRadius = 1) {

  ripples.push({
    x: x,
    y: y,
    radius: initialRadius,
    alpha: 150,
    strength: 1
  });

  // 限制涟漪数量，避免长期运行造成性能下降
  if (ripples.length > MAX_RIPPLES) {
    ripples.shift();
  }
}

function updateRipples() {
  for (let i = ripples.length - 1; i >= 0; i--) {
    let r = ripples[i];

    // 向外扩散
    r.radius += 0.8;

    // 逐渐淡出
    r.alpha *= 0.94;

    // 动画结束后移除
    if (r.alpha < 2) {
      ripples.splice(i, 1);
    }
  }
}

function drawRipples() {
  noFill();

  for (let r of ripples) {
    stroke(160, 215, 255, r.alpha);
    strokeWeight(0.8);

    ellipse(
      r.x,
      r.y,
      r.radius * 4,
      r.radius * 0.8
    );
  }
}

// =====================================
// SOURCE GLOW
// =====================================

function drawSourceGlow() {
  noStroke();

  // 秒数字下方的柔和蓝色光源
  for (let i = 0; i < 5; i++) {
    fill(80, 165, 255, 5);

    ellipse(
      SOURCE_X,
      SOURCE_Y,
      25 + i * 28,
      12 + i * 12
    );
  }

  // 中心光点
  fill(180, 225, 255, 65);

  circle(
    SOURCE_X,
    SOURCE_Y,
    3
  );
}

// =====================================
// BACKGROUND
// =====================================

function drawBackground() {
  let ctx = drawingContext;

  let gradient = ctx.createLinearGradient(
    0, 0, 0, H
  );

  gradient.addColorStop(0, "#071a3b");
  gradient.addColorStop(0.45, "#0b3268");
  gradient.addColorStop(0.65, "#10457e");
  gradient.addColorStop(1, "#03152f");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

// =====================================
// ATMOSPHERE
// =====================================

function drawAtmosphere() {
  noStroke();

  fill(195, 220, 255, 125);

  textAlign(CENTER, CENTER);
  textFont("monospace");
  textSize(11);

 

  fill(145, 185, 225, 80);
  textSize(9);

  
}