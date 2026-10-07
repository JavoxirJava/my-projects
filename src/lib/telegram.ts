export async function telegram(
  method: string,
  body: Record<string, unknown> | FormData,
  signal?: AbortSignal,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram token sozlanmagan");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000),
  });
  const out = await res.json();
  if (!out.ok)
    throw new Error(`Telegram ${out.error_code}: ${out.description}`);
  return out.result;
}
export async function sendMessage(text: string, signal?: AbortSignal) {
  return telegram("sendMessage", {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: text.slice(0, 4000),
    link_preview_options: { is_disabled: true },
  }, signal);
}
