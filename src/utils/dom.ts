/** 通用 DOM / 时间 / 文件工具 */

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 2026-09-25 21:30 */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 09-25 */
export function formatMonthDay(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 21:30 */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 当天 0 点的时间戳 */
export function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 记录 ID：20260925-2130-ab12 */
export function makeRecordId(ts: number): string {
  const d = new Date(ts);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}-${rand}`;
}

/** 「x 分钟前 / x 小时前 / x 天前」 */
export function fromNow(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} 个月前`;
  return `${Math.floor(month / 12)} 年前`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 拼 HTML 片段时用，避免题干里的尖括号把结构冲坏 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function average(list: number[]): number {
  if (!list.length) return 0;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

/** 总体标准差 */
export function stdDev(list: number[]): number {
  if (list.length < 2) return 0;
  const avg = average(list);
  return Math.sqrt(average(list.map((v) => (v - avg) ** 2)));
}

export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function pickTextFile(accept = ".json"): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, text: String(reader.result || "") });
      reader.onerror = () => resolve(null);
      reader.readAsText(file, "utf-8");
    });
    document.body.appendChild(input);
    input.click();
  });
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300): T {
  let timer: number | undefined;
  return function debounced(this: unknown, ...args: any[]) {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(this, args), wait);
  } as unknown as T;
}
