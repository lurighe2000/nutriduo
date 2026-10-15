// Story-sized (1080×1920) images of a run to share on social networks.
export type ShareTemplate = "foto" | "mapa" | "color" | "sticker";

export interface ShareCardData {
  label: string;
  stats: { value: string; unit?: string; label: string }[];
  date: string;
  segments: [number, number][][];
  colors: { c1: string; c2: string; c3: string };
  dark: boolean;
  photo?: CanvasImageSource & { width: number; height: number };
}

const W = 1080;
const H = 1920;
const TILE = 256;
type Box = { x: number; y: number; w: number; h: number };

function mercator([lat, lng]: [number, number], zoom: number) {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** Projects the route so it fits `box`, keeping its shape. */
function fit(segments: [number, number][][], box: Box, zoom = 18) {
  const all = segments.flat().map((p) => mercator(p, zoom));
  if (!all.length)
    return {
      lines: [] as { x: number; y: number }[][],
      scale: 1,
      minX: 0,
      minY: 0,
      ox: 0,
      oy: 0,
    };
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const scale = Math.min(
    box.w / Math.max(1, maxX - minX),
    box.h / Math.max(1, maxY - minY),
  );
  const ox = box.x + (box.w - (maxX - minX) * scale) / 2;
  const oy = box.y + (box.h - (maxY - minY) * scale) / 2;
  const lines = segments.map((s) =>
    s.map((p) => {
      const m = mercator(p, zoom);
      return { x: ox + (m.x - minX) * scale, y: oy + (m.y - minY) * scale };
    }),
  );
  return { lines, scale, minX, minY, ox, oy };
}

function strokeRoute(
  ctx: CanvasRenderingContext2D,
  lines: { x: number; y: number }[][],
  style: string | CanvasGradient,
  width: number,
  glow?: string,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 24;
  }
  for (const line of lines) {
    if (line.length < 2) continue;
    ctx.beginPath();
    line.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.restore();
}

function spaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  const chars = [...text];
  const width =
    chars.reduce((w, c) => w + ctx.measureText(c).width, 0) +
    spacing * (chars.length - 1);
  let cx = x - width / 2;
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
}

function statsBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  top: number,
  ink: string,
  soft: string,
  shadow?: string,
) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 34px Manrope, sans-serif";
  spaced(ctx, data.label.toUpperCase(), W / 2, top, 10);
  ctx.strokeStyle = soft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(240, top + 44);
  ctx.lineTo(840, top + 44);
  ctx.stroke();
  const col = W / data.stats.length;
  data.stats.forEach((s, i) => {
    const cx = col * i + col / 2;
    ctx.font = "800 92px Manrope, sans-serif";
    const vw = ctx.measureText(s.value).width;
    ctx.font = "700 36px Manrope, sans-serif";
    const uw = s.unit ? ctx.measureText(` ${s.unit}`).width : 0;
    const start = cx - (vw + uw) / 2;
    ctx.font = "800 92px Manrope, sans-serif";
    ctx.fillStyle = ink;
    ctx.fillText(s.value, start, top + 160);
    if (s.unit) {
      ctx.font = "700 36px Manrope, sans-serif";
      ctx.fillText(` ${s.unit}`, start + vw, top + 160);
    }
    ctx.font = "600 30px Manrope, sans-serif";
    ctx.fillStyle = soft;
    ctx.textAlign = "center";
    ctx.fillText(s.label, cx, top + 210);
    ctx.textAlign = "left";
  });
  ctx.strokeStyle = soft;
  ctx.beginPath();
  ctx.moveTo(240, top + 262);
  ctx.lineTo(840, top + 262);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "500 44px Manrope, sans-serif";
  const nutri = "nutri";
  ctx.font = "500 44px Manrope, sans-serif";
  const nw = ctx.measureText(nutri).width;
  ctx.font = "800 44px Manrope, sans-serif";
  const dw = ctx.measureText("duo").width;
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = "500 44px Manrope, sans-serif";
  ctx.fillText(nutri, W / 2 - (nw + dw) / 2, top + 350);
  ctx.font = "800 44px Manrope, sans-serif";
  ctx.fillText("duo", W / 2 - (nw + dw) / 2 + nw, top + 350);
  ctx.font = "600 26px Manrope, sans-serif";
  ctx.fillStyle = soft;
  ctx.textAlign = "center";
  ctx.fillText(data.date, W / 2, top + 400);
  ctx.restore();
}

function loadImage(src: string, timeout = 6000) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(
      () => reject(new Error("timeout")),
      timeout,
    );
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("image"));
    };
    img.src = src;
  });
}

async function drawMap(ctx: CanvasRenderingContext2D, data: ShareCardData) {
  const box = { x: 120, y: 240, w: 840, h: 900 };
  const all = data.segments.flat();
  if (!all.length) return false;
  let zoom = 17;
  for (; zoom > 3; zoom--) {
    const xy = all.map((p) => mercator(p, zoom));
    const w = Math.max(...xy.map((p) => p.x)) - Math.min(...xy.map((p) => p.x));
    const h = Math.max(...xy.map((p) => p.y)) - Math.min(...xy.map((p) => p.y));
    if (w * 2 <= box.w && h * 2 <= box.h) break;
  }
  // Tiles are drawn at 2× so the map stays sharp on a 1080 px image.
  const xy = all.map((p) => mercator(p, zoom));
  const cx =
    (Math.min(...xy.map((p) => p.x)) + Math.max(...xy.map((p) => p.x))) / 2;
  const cy =
    (Math.min(...xy.map((p) => p.y)) + Math.max(...xy.map((p) => p.y))) / 2;
  const left = cx - W / 4;
  const top = cy - (box.y + box.h / 2) / 2;
  const jobs: Promise<void>[] = [];
  const count = 2 ** zoom;
  for (
    let ty = Math.floor(top / TILE);
    ty <= Math.floor((top + H / 2) / TILE);
    ty++
  )
    for (
      let tx = Math.floor(left / TILE);
      tx <= Math.floor((left + W / 2) / TILE);
      tx++
    ) {
      if (ty < 0 || ty >= count) continue;
      const wx = ((tx % count) + count) % count;
      jobs.push(
        loadImage(
          `https://tile.openstreetmap.org/${zoom}/${wx}/${ty}.png`,
        ).then((img) =>
          ctx.drawImage(
            img,
            (tx * TILE - left) * 2,
            (ty * TILE - top) * 2,
            TILE * 2,
            TILE * 2,
          ),
        ),
      );
    }
  const results = await Promise.allSettled(jobs);
  if (!results.some((r) => r.status === "fulfilled")) return false;
  // Recolor the map like the app does.
  ctx.save();
  ctx.globalCompositeOperation = "saturation";
  ctx.fillStyle = "hsl(0 0% 50%)";
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (data.dark) {
    ctx.save();
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "#3a4466";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = data.colors.c1;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const lines = data.segments.map((s) =>
    s.map((p) => {
      const m = mercator(p, zoom);
      return { x: (m.x - left) * 2, y: (m.y - top) * 2 };
    }),
  );
  strokeRoute(ctx, lines, "#ffffff", 22);
  const gradient = ctx.createLinearGradient(0, 1140, W, 240);
  gradient.addColorStop(0, data.colors.c3);
  gradient.addColorStop(1, data.colors.c1);
  strokeRoute(ctx, lines, gradient, 12);
  return true;
}

export async function renderShareCard(
  template: ShareTemplate,
  data: ShareCardData,
) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  try {
    await Promise.all([
      document.fonts.load("800 92px Manrope"),
      document.fonts.load("600 34px Manrope"),
      document.fonts.load("500 44px Manrope"),
    ]);
  } catch {
    // System font fallback is fine.
  }
  const routeBox = { x: 330, y: 190, w: 420, h: 360 };
  const colorBackground = () => {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, data.colors.c1);
    g.addColorStop(1, data.dark ? "#0a0f2a" : data.colors.c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const shade = ctx.createLinearGradient(0, 1000, 0, H);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 1000, W, H - 1000);
    const glow = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 640, 700);
    glow.addColorStop(0, "rgba(255,255,255,0.22)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  };

  if (template === "foto" && data.photo) {
    const p = data.photo;
    const scale = Math.max(W / p.width, H / p.height);
    ctx.drawImage(
      p,
      (W - p.width * scale) / 2,
      (H - p.height * scale) / 2,
      p.width * scale,
      p.height * scale,
    );
    const top = ctx.createLinearGradient(0, 0, 0, 700);
    top.addColorStop(0, "rgba(0,0,0,0.45)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 700);
    const bottom = ctx.createLinearGradient(0, 1100, 0, H);
    bottom.addColorStop(0, "rgba(0,0,0,0)");
    bottom.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 1100, W, H - 1100);
    strokeRoute(
      ctx,
      fit(data.segments, routeBox).lines,
      "#ffffff",
      9,
      "rgba(0,0,0,0.35)",
    );
    statsBlock(
      ctx,
      data,
      1300,
      "#ffffff",
      "rgba(255,255,255,0.75)",
      "rgba(0,0,0,0.35)",
    );
  } else if (template === "mapa") {
    ctx.fillStyle = data.dark ? "#0e1631" : "#e4ebf5";
    ctx.fillRect(0, 0, W, H);
    if (!(await drawMap(ctx, data))) {
      colorBackground();
      strokeRoute(
        ctx,
        fit(data.segments, { x: 140, y: 260, w: 800, h: 820 }).lines,
        "#ffffff",
        14,
        "rgba(255,255,255,0.5)",
      );
    }
    const panel = ctx.createLinearGradient(0, 1120, 0, H);
    panel.addColorStop(
      0,
      data.dark ? "rgba(14,22,49,0)" : "rgba(228,235,245,0)",
    );
    panel.addColorStop(
      0.18,
      data.dark ? "rgba(14,22,49,0.94)" : "rgba(244,247,252,0.95)",
    );
    panel.addColorStop(1, data.dark ? "#0e1631" : "#f4f7fc");
    ctx.fillStyle = panel;
    ctx.fillRect(0, 1120, W, H - 1120);
    statsBlock(
      ctx,
      data,
      1360,
      data.dark ? "#eef1ff" : "#121735",
      data.dark ? "rgba(222,228,255,0.65)" : "rgba(18,23,53,0.55)",
    );
  } else if (template === "sticker") {
    strokeRoute(
      ctx,
      fit(data.segments, routeBox).lines,
      "#ffffff",
      9,
      "rgba(0,0,0,0.35)",
    );
    statsBlock(
      ctx,
      data,
      1300,
      "#ffffff",
      "rgba(255,255,255,0.85)",
      "rgba(0,0,0,0.45)",
    );
  } else {
    colorBackground();
    strokeRoute(
      ctx,
      fit(data.segments, { x: 140, y: 220, w: 800, h: 860 }).lines,
      "#ffffff",
      14,
      "rgba(255,255,255,0.55)",
    );
    statsBlock(ctx, data, 1300, "#ffffff", "rgba(255,255,255,0.78)");
  }
  return canvas;
}

export function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("blob"))),
      "image/png",
    ),
  );
}
