import { afterEach, describe, expect, it, vi } from "vitest";
import { readAttachment } from "./readAttachment";

const fileOf = (bytes: string, name: string, type: string) => new File([bytes], name, { type });
const base64Of = (text: string) => btoa(text);
const sized = (file: File, size: number) => Object.defineProperty(file, "size", { value: size });

/* jsdom cannot decode pictures; this stands in for a browser that can. */
function stubImageDecoding(width: number, height: number, output: Blob | null) {
  const drawn: { width: number; height: number }[] = [];
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:photo", revokeObjectURL: () => {} }));
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        if (value) queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const canvas = this;
    return {
      fillStyle: "",
      fillRect: () => {},
      drawImage: () => drawn.push({ width: canvas.width, height: canvas.height }),
    } as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(output));
  return drawn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readAttachment", () => {
  it("sends a picture Claude can see as a picture", async () => {
    const attachment = await readAttachment(fileOf("jpeg-bytes", "photo.jpg", "image/jpeg"));
    expect(attachment).toEqual({ kind: "image", mime: "image/jpeg", data: base64Of("jpeg-bytes"), name: "photo.jpg" });
  });

  it("sends a legacy Word file whole, for the server to read", async () => {
    const attachment = await readAttachment(fileOf("ole-bytes", "talim-al9qyf.doc", "application/msword"));
    expect(attachment).toEqual({
      kind: "binary",
      mime: "application/msword",
      data: base64Of("ole-bytes"),
      name: "talim-al9qyf.doc",
    });
  });

  it("accepts a file of a type it has never heard of", async () => {
    const attachment = await readAttachment(fileOf("??", "chizma.dwg", ""));
    expect(attachment).toMatchObject({ kind: "binary", mime: "application/octet-stream", name: "chizma.dwg" });
  });

  it("sends a text file as bytes, so the server can tell its encoding", async () => {
    const attachment = await readAttachment(fileOf("a,b\n1,2", "jadval.csv", "text/csv"));
    expect(attachment).toMatchObject({ kind: "binary", mime: "text/csv", data: base64Of("a,b\n1,2") });
  });

  it("sends a HEIC photo as a file when this browser cannot redraw it", async () => {
    const attachment = await readAttachment(fileOf("heic-bytes", "IMG_0001.HEIC", "image/heic"));
    expect(attachment).toMatchObject({ kind: "binary", mime: "image/heic", name: "IMG_0001.HEIC" });
  });

  it("redraws a HEIC photo as a JPEG no larger than 2048 px when the browser can decode it", async () => {
    const drawn = stubImageDecoding(4032, 3024, new Blob(["jpeg-out"], { type: "image/jpeg" }));

    const attachment = await readAttachment(fileOf("heic-bytes", "IMG_0001.HEIC", "image/heic"));

    expect(attachment).toEqual({ kind: "image", mime: "image/jpeg", data: base64Of("jpeg-out"), name: "IMG_0001.HEIC" });
    expect(drawn).toEqual([{ width: 2048, height: 1536 }]);
  });

  it("redraws a JPEG too large for the API instead of sending it as it is", async () => {
    stubImageDecoding(6000, 4000, new Blob(["smaller"], { type: "image/jpeg" }));

    const attachment = await readAttachment(sized(fileOf("big-jpeg", "scan.jpg", "image/jpeg"), 6 * 1024 * 1024));

    expect(attachment).toEqual({ kind: "image", mime: "image/jpeg", data: base64Of("smaller"), name: "scan.jpg" });
  });

  it("falls back to sending the file when the redraw produces nothing", async () => {
    stubImageDecoding(800, 600, null);

    const attachment = await readAttachment(fileOf("bmp-bytes", "chizma.bmp", "image/bmp"));

    expect(attachment).toMatchObject({ kind: "binary", mime: "image/bmp", data: base64Of("bmp-bytes") });
  });

  it("refuses a file over 8 MiB before reading it", async () => {
    const big = sized(fileOf("", "big.zip", "application/zip"), 8 * 1024 * 1024 + 1);
    await expect(readAttachment(big)).rejects.toThrow("too-large");
  });
});
