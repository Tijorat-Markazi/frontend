import { cabinetPost } from "../../shell/cabinet";
import { text } from "../../shell/market/narrow";

const MAX_SIDE_PX = 1600;
const JPEG_QUALITY = 0.85;
/* The server refuses a larger body; saying so first spares the upload. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const TOO_LARGE = "File too large (8 MiB max)";
const PAYLOAD_TOO_LARGE = 413;

/** Downscales any image, keeping its aspect ratio, to a JPEG data URL. */
function scaleToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, MAX_SIDE_PX / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      URL.revokeObjectURL(source);
      try {
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("image could not be scaled"));
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("image could not be read"));
    };
    image.src = source;
  });
}

/** Uploads a showroom photo; resolves to its address, rejects when too large or refused. */
export async function uploadPhoto(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error(TOO_LARGE);
  const dataUrl = await scaleToDataUrl(file);
  const answer = await cabinetPost("/api/upload", { data: dataUrl.split(",")[1], mime: "image/jpeg" });
  if (!answer.isOk) throw new Error(answer.status === PAYLOAD_TOO_LARGE ? TOO_LARGE : "Upload failed");
  return text(answer.body.url);
}
