/**
 * face-engine.ts — High-Precision Hybrid Face Engine + InsightFace (ArcFace) Support
 *
 * Primary Model:
 *   - InsightFace (ArcFace 512-dim) via local Python FastAPI server (http://localhost:8000)
 *   - 99.86% LFW accuracy gold standard for face verification
 *
 * Fallback Engine:
 *   - MediaPipe FaceLandmarker + face-api.js ResNet-34 (128-dim) on-device WebGL
 */

import * as faceapi from "face-api.js";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// ─── Singletons ───────────────────────────────────────────────────────────────

let landmarker: FaceLandmarker | null = null;
let modelsLoaded = false;
let initPromise: Promise<void> | null = null;
let _ts = 100;
const nextTs = () => ++_ts;

const MODEL_URL = "/models";
const INSIGHTFACE_SERVER_URL = "http://localhost:8000";

// ─── InsightFace API Client ───────────────────────────────────────────────────

export type InsightFaceVerifyResult = {
  verified: boolean;
  match: number;
  cosine_similarity: number;
  confidence: string;
  engine: string;
  reason?: string;
};

/**
 * Checks if the local Python InsightFace (ArcFace) service is running on http://localhost:8000
 */
export async function checkInsightFaceHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${INSIGHTFACE_SERVER_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function resizeBase64Image(src: string, maxDim = 320): Promise<string> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });

    const w = img.naturalWidth || 320;
    const h = img.naturalHeight || 320;
    if (w <= maxDim && h <= maxDim) return src;

    const scale = Math.min(maxDim / w, maxDim / h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return src;
  }
}

/**
 * Calls local Python InsightFace FastAPI service for 99.86% ArcFace 512-dim verification
 */
export async function verifyWithInsightFace(
  referenceImage: string,
  liveImages: string[],
): Promise<InsightFaceVerifyResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Limit live images to last 2 high-quality frames and downscale for ultra-fast ONNX inference
    const rawSamples = liveImages.length > 2 ? liveImages.slice(-2) : liveImages;

    const [resizedRef, ...resizedLive] = await Promise.all([
      resizeBase64Image(referenceImage, 320),
      ...rawSamples.map((img) => resizeBase64Image(img, 320)),
    ]);

    const res = await fetch(`${INSIGHTFACE_SERVER_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        reference_image: resizedRef,
        live_images: resizedLive,
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return data as InsightFaceVerifyResult;
  } catch {
    return null;
  }
}

// ─── Local Engine Initialisation ──────────────────────────────────────────────

export async function ensureModels(): Promise<void> {
  if (modelsLoaded) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const [fileset] = await Promise.all([
      FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      ),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${MODEL_URL}/face_landmarker.task`,
        delegate: "GPU" as const,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.3,
      minTrackingConfidence: 0.3,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });

    modelsLoaded = true;
  })();

  return initPromise;
}

// ─── Contrast & Luminance Equalizer ───────────────────────────────────────────

function normalizeCropContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const imgData = ctx.getImageData(0, 0, 150, 150);
  const data = imgData.data;

  let minL = 255, maxL = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
  }

  const range = maxL - minL || 1;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, (((data[i] ?? 0) - minL) / range) * 255));
    data[i + 1] = Math.min(255, Math.max(0, (((data[i + 1] ?? 0) - minL) / range) * 255));
    data[i + 2] = Math.min(255, Math.max(0, (((data[i + 2] ?? 0) - minL) / range) * 255));
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// ─── Eye-Rotated & Aligned 1:1 Square Crop Helper ─────────────────────────────

function cropRotatedAlignedFace(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  landmarks: Array<{ x: number; y: number }>,
): HTMLCanvasElement | null {
  const lEye = landmarks[33] || landmarks[133];
  const rEye = landmarks[362] || landmarks[263];
  if (!lEye || !rEye) return null;

  const lx = lEye.x * srcW, ly = lEye.y * srcH;
  const rx = rEye.x * srcW, ry = rEye.y * srcH;

  const eyeCx = (lx + rx) / 2;
  const eyeCy = (ly + ry) / 2;
  const angle = Math.atan2(ry - ly, rx - lx);

  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }

  const lmW = (maxX - minX) * srcW;
  const lmH = (maxY - minY) * srcH;
  if (lmW < 10 || lmH < 10) return null;

  const size = Math.max(lmW, lmH) * 1.5;

  const canvas = document.createElement("canvas");
  canvas.width  = 150;
  canvas.height = 150;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 150, 150);

  ctx.save();
  ctx.translate(75, 75);
  ctx.rotate(-angle);
  const scale = 150 / size;
  ctx.scale(scale, scale);
  ctx.drawImage(source, -eyeCx, -eyeCy);
  ctx.restore();

  return normalizeCropContrast(canvas);
}

// ─── Local Fallback API ───────────────────────────────────────────────────────

export type FaceDetectResult = {
  descriptor: Float32Array;
  croppedBase64?: string;
};

export async function detectFromImage(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<FaceDetectResult | null> {
  await ensureModels();

  const naturalW = (source instanceof HTMLImageElement ? source.naturalWidth : source.width) || 320;
  const naturalH = (source instanceof HTMLImageElement ? source.naturalHeight : source.height) || 320;

  const targetW = Math.max(naturalW, 480);
  const targetH = Math.round(naturalH * (targetW / naturalW));

  const canvas = document.createElement("canvas");
  canvas.width  = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, targetW, targetH);

  let crop: HTMLCanvasElement | null = null;

  try {
    const result = landmarker!.detectForVideo(canvas, nextTs());
    const landmarks = result.faceLandmarks[0];
    if (landmarks?.length) {
      crop = cropRotatedAlignedFace(canvas, targetW, targetH, landmarks);
    }
  } catch {
    /* fallback below */
  }

  if (!crop) {
    const size = Math.min(targetW, targetH);
    const bx = (targetW - size) / 2;
    const by = (targetH - size) / 2;
    crop = document.createElement("canvas");
    crop.width  = 150;
    crop.height = 150;
    const cropCtx = crop.getContext("2d")!;
    cropCtx.drawImage(canvas, bx, by, size, size, 0, 0, 150, 150);
    crop = normalizeCropContrast(crop);
  }

  const descriptor = (await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(crop)) as Float32Array;
  return { descriptor, croppedBase64: crop.toDataURL("image/jpeg", 0.9) };
}

export async function detectFromVideo(
  video: HTMLVideoElement,
): Promise<FaceDetectResult | null> {
  await ensureModels();

  const result = landmarker!.detectForVideo(video, nextTs());
  const landmarks = result.faceLandmarks[0];
  if (!landmarks?.length) return null;

  const crop = cropRotatedAlignedFace(video, video.videoWidth, video.videoHeight, landmarks);
  if (!crop) return null;

  const descriptor = (await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(crop)) as Float32Array;
  return { descriptor, croppedBase64: crop.toDataURL("image/jpeg", 0.85) };
}

export function averageDescriptors(descriptors: Float32Array[]): Float32Array {
  if (descriptors.length === 0 || !descriptors[0]) return new Float32Array(128);
  const len = descriptors[0].length;
  const mean = new Float32Array(len);

  for (const d of descriptors) {
    for (let i = 0; i < len; i++) {
      const val = d[i] ?? 0;
      mean[i] = (mean[i] ?? 0) + val;
    }
  }

  let norm = 0;
  for (let i = 0; i < len; i++) {
    const avg = (mean[i] ?? 0) / descriptors.length;
    mean[i] = avg;
    norm += avg * avg;
  }

  norm = Math.sqrt(norm) || 1e-8;
  for (let i = 0; i < len; i++) {
    mean[i] = (mean[i] ?? 0) / norm;
  }

  return mean;
}

export function matchScore(a: Float32Array, b: Float32Array): number {
  const distance = faceapi.euclideanDistance(a, b);

  let score: number;
  if (distance <= 0.57) {
    score = Math.round(100 - (distance / 0.57) * 40);
  } else {
    score = Math.round(Math.max(0, 60 - ((distance - 0.57) / 0.18) * 60));
  }

  console.log(`[FaceEngine] Euclidean Distance: ${distance.toFixed(3)} → Match Score: ${score}% (Threshold: <= 0.570, Verified: ${score >= 60})`);
  return score;
}

export function isVerified(score: number): boolean {
  return score >= 60;
}

export { ensureModels as preloadFaceEngine };
