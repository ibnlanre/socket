export function arrayBufferToBlob(buffer: ArrayBuffer) {
  return new Blob([buffer], { type: "application/json" });
}
