import { MAX_ATTACH_BYTES, blobToBase64 } from "../../shell/chat";

/** A picture or a file waiting to go out with the next question. */
export type PendingAttachment =
  | { kind: "image"; mime: string; data: string; name: string }
  | { kind: "binary"; mime: string; data: string; name: string };

/* Claude looks at these picture types directly. */
const CLAUDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
/* Long side of a redrawn picture: Claude scales larger ones down anyway, and
   a full-size iPhone photo would not fit in the request. */
const MAX_IMAGE_SIDE = 2048;
/* The API refuses a picture over 5 MB of base64 (the server checks 3.75 MB of
   bytes); a larger photo is redrawn smaller instead of being turned away. */
const MAX_DIRECT_IMAGE_BYTES = 3.5 * 1024 * 1024;
const JPEG_QUALITY = 0.9;
const DECODE_TIMEOUT_MS = 10_000;

function decodeImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    const finish = (result: HTMLImageElement | null) => {
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      image.src = ""; // stop the load that is taking too long
      finish(null);
    }, DECODE_TIMEOUT_MS);
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

function drawToBlob(image: HTMLImageElement, mime: string): Promise<Blob | null> {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  if (mime === "image/jpeg") {
    context.fillStyle = "#fff"; // JPEG has no transparency; without this it turns black
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, mime, JPEG_QUALITY));
}

/**
 * A picture Claude cannot take as it is (HEIC from an iPhone, AVIF, BMP,
 * TIFF, SVG, or any picture too large to send), redrawn as JPEG — or PNG for
 * vector art, which keeps its transparency. Null when the browser cannot
 * decode it.
 */
async function redrawImage(file: File): Promise<{ mime: string; data: string } | null> {
  if (typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(file);
  try {
    const image = await decodeImage(url);
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const mime = file.type === "image/svg+xml" ? "image/png" : "image/jpeg";
    const blob = await drawToBlob(image, mime);
    return blob ? { mime, data: await blobToBase64(blob) } : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Every file type is accepted: the server reads the bytes and decides how
 * (text, PDF, Office, or its sandbox for anything else), so even a text file
 * goes as bytes and keeps its encoding. Rejects with "too-large" over 8 MiB,
 * before the file is read: the server would refuse it.
 */
export async function readAttachment(file: File): Promise<PendingAttachment> {
  if (file.size > MAX_ATTACH_BYTES) throw new Error("too-large");
  const { name, type } = file;
  if (CLAUDE_IMAGE_TYPES.includes(type) && file.size <= MAX_DIRECT_IMAGE_BYTES) {
    return { kind: "image", mime: type, data: await blobToBase64(file), name };
  }
  if (type.startsWith("image/")) {
    const redrawn = await redrawImage(file).catch(() => null);
    if (redrawn) return { kind: "image", ...redrawn, name };
  }
  return { kind: "binary", mime: type || "application/octet-stream", data: await blobToBase64(file), name };
}
