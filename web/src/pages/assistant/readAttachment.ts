import { MAX_ATTACH_BYTES, blobToBase64 } from "../../shell/chat";

/** A document or picture waiting to go out with the next question. */
export type PendingAttachment =
  | { kind: "image"; mime: string; data: string; name: string }
  | { kind: "text"; name: string; content: string }
  | { kind: "binary"; mime: string; data: string; name: string };

const MAX_TEXT_LENGTH = 20000;
const TEXT_NAME = /\.(txt|md|csv|json|log)$/i;
const DOCUMENT_NAME = /\.(pdf|docx|xlsx|pptx|doc|xls|ppt)$/i;

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

/**
 * Resolves to null for a file type the assistant cannot take. Rejects with
 * "too-large" over 8 MiB, before the file is read: the server would refuse it.
 */
export async function readAttachment(file: File): Promise<PendingAttachment | null> {
  if (file.size > MAX_ATTACH_BYTES) throw new Error("too-large");
  const { name, type } = file;
  if (type.startsWith("image/")) {
    return { kind: "image", mime: type, data: await blobToBase64(file), name };
  }
  if (type.startsWith("text/") || TEXT_NAME.test(name)) {
    return { kind: "text", name, content: (await readText(file)).slice(0, MAX_TEXT_LENGTH) };
  }
  if (DOCUMENT_NAME.test(name)) {
    return { kind: "binary", mime: type || "application/octet-stream", data: await blobToBase64(file), name };
  }
  return null;
}
