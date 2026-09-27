/**
 * 轻量 Markdown 渲染器。
 *
 * 为什么不用思源全局的 Lute：实测 3.8.5 的 Lute 没有 Md2HTML（思源自己走
 * Md2BlockDOM + 块渲染器，那套依赖 protyle 的样式上下文），AI 返回的
 * **加粗**、# 标题会原样露出来。AI 解读的内容就是标题/加粗/列表这几样，
 * 自己渲染 60 行，行为完全可控、可测试。
 *
 * 安全：先整体 HTML 转义再做转换，AI 返回的 <script> 之类只会以文字出现。
 */
import { escapeHtml } from "@/utils/dom";

/** 行内：`code`、**粗**、*斜*、~~删除~~、==高亮==、++下划线++，以及白名单内的 <u>/<mark> 原样还原 */
function renderInline(text: string): string {
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
  out = out.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  out = out.replace(/\+\+([^+\n]+)\+\+/g, "<u>$1</u>");
  // AI 有时会直接输出 <u>/<mark>/<br> 这类无属性标签；转义后只还原这几个白名单标签，其余 HTML 保持转义
  out = out.replace(/&lt;(\/?)(u|mark|del|br)\s*&gt;/g, "<$1$2>");
  out = out.replace(/\u0000(\d+)\u0000/g, (_m, index: string) => `<code>${codes[Number(index)]}</code>`);
  return out;
}

export function md2html(markdown: string): string {
  const source = (markdown || "").replace(/\r\n?/g, "\n");
  if (!source.trim()) return "";

  const lines = escapeHtml(source).split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length) {
      html.push(`<p>${paragraph.join("<br>")}</p>`);
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };
  const flushQuote = (): void => {
    if (quote.length) {
      html.push(`<blockquote>${quote.join("<br>")}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = (): void => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (code) {
      if (/^```/.test(line.trim())) {
        html.push(`<pre><code>${code.join("\n")}</code></pre>`);
        code = null;
      } else {
        code.push(raw);
      }
      continue;
    }
    if (/^```/.test(line.trim())) {
      flushAll();
      code = [];
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)/.exec(line);
    if (heading) {
      flushAll();
      // 对话框里 # 就够大了，一级映射到 h3，避免占半个屏
      const level = Math.min(4, heading[1].length + 2);
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushAll();
      html.push("<hr>");
      continue;
    }
    const blockquote = /^&gt;\s?(.*)$/.exec(line);
    if (blockquote) {
      flushParagraph();
      flushList();
      quote.push(renderInline(blockquote[1]));
      continue;
    }
    const unordered = /^[-*+]\s+(.+)/.exec(line);
    if (unordered) {
      flushParagraph();
      flushQuote();
      if (list !== "ul") {
        flushList();
        html.push("<ul>");
        list = "ul";
      }
      html.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }
    const ordered = /^\d+[.、)）]\s+(.+)/.exec(line);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (list !== "ol") {
        flushList();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(renderInline(line.trim()));
  }

  if (code) html.push(`<pre><code>${code.join("\n")}</code></pre>`);
  flushAll();
  return html.join("");
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
