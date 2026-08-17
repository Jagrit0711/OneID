/**
 * Fully on-device face utilities.
 * No network calls, no model downloads, no data leaves the browser.
 *
 * Detection: native FaceDetector when available, otherwise a skin-tone +
 * variance heuristic over the centre region of the frame.
 * Embedding: normalised grayscale gradient descriptor of the face crop.
 * Comparison: cosine similarity of the two descriptors.
 *
 * This is deliberately an ASSISTIVE check, never conclusive proof of identity.
 */

export type FaceBox = { x: number; y: number; width: number; height: number };

const GRID = 24;

function toCanvas(source: CanvasImageSource, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return { canvas, ctx };
}

/** Detects a single face box in the frame, or null. */
export async function detectFace(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<FaceBox | null> {
  const AnyWindow = window as unknown as { FaceDetector?: new (o?: unknown) => {
    detect: (s: CanvasImageSource) => Promise<Array<{ boundingBox: FaceBox }>>;
  } };
  if (AnyWindow.FaceDetector) {
    try {
      const detector = new AnyWindow.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(source);
      if (faces.length > 0) return faces[0]!.boundingBox;
      return null;
    } catch {
      /* fall through to heuristic */
    }
  }
  return heuristicFace(source, width, height);
}

/** Skin-tone coverage heuristic over the central portion of the frame. */
function heuristicFace(source: CanvasImageSource, width: number, height: number): FaceBox | null {
  const w = 96;
  const h = Math.max(1, Math.round((height / width) * w));
  const { ctx } = toCanvas(source, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isSkin =
        r > 70 && g > 40 && b > 20 && r > g && r > b && r - min > 12 && max - min > 12;
      if (isSkin) {
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const coverage = count / (w * h);
  if (coverage < 0.04 || maxX <= minX || maxY <= minY) return null;

  const sx = width / w;
  const sy = height / h;
  return {
    x: minX * sx,
    y: minY * sy,
    width: (maxX - minX) * sx,
    height: (maxY - minY) * sy,
  };
}

/** Produces a normalised descriptor for a face crop. */
export function embedFace(
  source: CanvasImageSource,
  box: FaceBox,
  frameWidth: number,
  frameHeight: number,
): Float32Array {
  const pad = 0.12;
  const x = Math.max(0, box.x - box.width * pad);
  const y = Math.max(0, box.y - box.height * pad);
  const cw = Math.min(frameWidth - x, box.width * (1 + pad * 2));
  const ch = Math.min(frameHeight - y, box.height * (1 + pad * 2));

  const { ctx } = toCanvas(source, GRID, GRID);
  ctx.drawImage(source, x, y, cw, ch, 0, 0, GRID, GRID);
  const { data } = ctx.getImageData(0, 0, GRID, GRID);

  const gray = new Float32Array(GRID * GRID);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = (0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!) / 255;
  }

  // Local contrast normalisation removes lighting differences.
  let mean = 0;
  for (const v of gray) mean += v;
  mean /= gray.length;
  let variance = 0;
  for (const v of gray) variance += (v - mean) ** 2;
  const std = Math.sqrt(variance / gray.length) || 1e-6;

  const features: number[] = [];
  for (let yy = 1; yy < GRID - 1; yy++) {
    for (let xx = 1; xx < GRID - 1; xx++) {
      const i = yy * GRID + xx;
      const n = (gray[i]! - mean) / std;
      const gx = (gray[i + 1]! - gray[i - 1]!) / std;
      const gy = (gray[i + GRID]! - gray[i - GRID]!) / std;
      features.push(n, gx, gy);
    }
  }

  const vec = new Float32Array(features);
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1e-6;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i]! / norm;
  return vec;
}

export function similarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i]! * b[i]!;
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}

/** Loads a base64 photo into an image element (no network). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_decode_failed"));
    img.src = src;
  });
}

/** Whole-frame fallback box when no face is isolated. */
export function centreBox(width: number, height: number): FaceBox {
  const size = Math.min(width, height) * 0.7;
  return { x: (width - size) / 2, y: (height - size) / 2, width: size, height: size };
}
