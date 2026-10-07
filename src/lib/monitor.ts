import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
export function publicAddress(ip: string) {
  if (net.isIP(ip) === 4) {
    const a = ip.split(".").map(Number);
    return !(
      a[0] === 0 ||
      a[0] === 10 ||
      a[0] === 127 ||
      a[0] >= 224 ||
      (a[0] === 169 && a[1] === 254) ||
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
      (a[0] === 192 && (a[1] === 168 || a[1] === 0)) ||
      (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
      (a[0] === 198 && (a[1] === 18 || a[1] === 19)) ||
      (a[0] === 192 && a[1] === 0 && a[2] === 2) ||
      (a[0] === 198 && a[1] === 51 && a[2] === 100) ||
      (a[0] === 203 && a[1] === 0 && a[2] === 113)
    );
  }
  if (net.isIP(ip) === 6)
    return (
      /^2[0-9a-f]{3}:/i.test(ip) &&
      !/^2001:(?:db8|0|10|20):/i.test(ip) &&
      !/^2002:/i.test(ip)
    );
  return false;
}
export async function probe(
  raw: string,
  expected: number,
  shutdown?: AbortSignal,
): Promise<{ ok: boolean; error: string }> {
  const deadline = AbortSignal.timeout(12000);
  const signal = shutdown ? AbortSignal.any([shutdown, deadline]) : deadline;
  try {
    signal.throwIfAborted();
    const url = new URL(raw);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && !["80", "443"].includes(url.port))
    )
      throw new Error(
        "Faqat ommaviy HTTP/HTTPS manzillari (80/443) tekshiriladi",
      );
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = net.isIP(host)
      ? [{ address: host, family: net.isIP(host) }]
      : await abortable(dns.lookup(host, { all: true }), signal);
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new Error("Ichki yoki maxsus IP manzilga so‘rov taqiqlangan");
    const selected = addresses[0];
    return await new Promise((resolve) => {
      const transport = url.protocol === "https:" ? https : http;
      const request = transport.request(
        url,
        {
          method: "GET",
          signal,
          family: selected.family,
          timeout: 12000,
          headers: { "User-Agent": "MyProjects-Monitor/1.0" },
          lookup: ((_host: any, _opts: any, callback: any) =>
            callback(null, selected.address, selected.family)) as any,
        },
        (res) => {
          res.destroy();
          resolve({
            ok: res.statusCode === expected,
            error:
              res.statusCode === expected
                ? ""
                : `HTTP ${res.statusCode}; kutilgan ${expected}`,
          });
        },
      );
      request.on("timeout", () =>
        request.destroy(new Error("12 soniyada javob kelmadi")),
      );
      request.on("error", (e) => resolve({ ok: false, error: e.message }));
      request.end();
    });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
export function shouldNotify(
  previous: string | undefined,
  next: "up" | "down",
) {
  return (
    (next === "down" && previous !== "down") ||
    (next === "up" && previous === "down")
  );
}

async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
