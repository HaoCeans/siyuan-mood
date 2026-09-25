/** 用思源全局 Lute 做 Markdown ↔ HTML 互转，拿不到时降级为最简处理 */

interface LuteLike {
  New(): {
    Md2HTML(md: string): string;
    BlockDOM2StdMd(html: string): string;
  };
}

function lute(): LuteLike | null {
  return (window as any).Lute || null;
}

export function md2html(md: string): string {
  if (!md) return "";
  const l = lute();
  if (!l) return md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
  try {
    return l.New().Md2HTML(md);
  } catch (err) {
    console.error("[mood] Md2HTML failed", err);
    return md.replace(/\n/g, "<br>");
  }
}

export function dom2md(html: string): string {
  if (!html) return "";
  const l = lute();
  if (!l) return html.replace(/<[^>]+>/g, "").trim();
  try {
    return l.New().BlockDOM2StdMd(html).trim();
  } catch (err) {
    console.error("[mood] BlockDOM2StdMd failed", err);
    return html.replace(/<[^>]+>/g, "").trim();
  }
}

/** 纯文本预览：去掉 Markdown 标记，供卡片摘要使用 */
export function plainText(md: string, max = 80): string {
  const text = (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_>`~\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
