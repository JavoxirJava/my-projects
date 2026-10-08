export const LOGIN_BODY_LIMIT = 8 * 1024;
export const JSON_BODY_LIMIT = 16 * 1024 * 1024;
export const RESTORE_BODY_LIMIT = 21 * 1024 * 1024;

export function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}
export function checkBodyLength(req: Request, limit: number) {
  const length = req.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
    throw httpError("So‘rov hajmi ruxsat etilgan chegaradan katta", 413);
}
// Count actual bytes too: chunked requests need not declare a length.
export async function readBody(
  req: Request,
  limit: number,
): Promise<Uint8Array> {
  checkBodyLength(req, limit);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0,
    timedOut = false,
    complete = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 15000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw httpError("So‘rov vaqti tugadi", 408);
      if (done) {
        complete = true;
        break;
      }
      size += value.byteLength;
      if (size > limit)
        throw httpError("So‘rov hajmi ruxsat etilgan chegaradan katta", 413);
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  } finally {
    clearTimeout(timeout);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function readJson(
  req: Request,
  limit = JSON_BODY_LIMIT,
): Promise<any> {
  if (
    req.headers.get("content-type")?.split(";")[0].trim() !== "application/json"
  )
    throw httpError("JSON so‘rov talab qilinadi", 415);
  const value = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await readBody(req, limit),
    ),
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw httpError("JSON obyekt talab qilinadi", 400);
  return value;
}
