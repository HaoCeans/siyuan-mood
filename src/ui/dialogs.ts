/**
 * 对话框调度：问答流程与记录详情都用思源的 Dialog，内容区挂 Vue 组件。
 *
 * 手机上把容器放开到整屏：思源自带的 .b3-dialog__container 有 max-width: 88vw 上限，
 * 且宽高是写在 style 属性上的内联样式，只能靠带 !important 的类覆盖（见 index.scss）。
 */
import { Dialog, getFrontend, showMessage } from "siyuan";
import { t } from "@/plugin";
import { mountVue, unmountVue, type MountedApp } from "@/main";
import QuizDialog from "@/ui/QuizDialog.vue";
import RecordDetail from "@/ui/RecordDetail.vue";
import { analyzeRecord, fetchCheckinSuggestion } from "@/ai/analyze";
import { addCheckIn, allCheckinWords, findRecord, state } from "@/store";
import { familyOf, wordIconFile, wordFamily, weatherIconFile, WEATHERS, iconUrl, type EmotionFamily } from "@/quiz/emotions";
import { escapeHtml, formatTime } from "@/utils/dom";
import { md2html } from "@/utils/lute";
import type { QuizRecord } from "@/types/mood";

export function isMobile(): boolean {
  const frontend = getFrontend();
  return frontend === "mobile" || frontend === "browser-mobile";
}

/**
 * 自绘的关闭按钮。
 * 不用思源自带的那个，是因为它和 disableClose 绑在同一个开关上：要挡遮罩点击就得把它一起隐藏。
 * 自己画一个，位置、大小、悬停反馈都完全可控，也不受内核版本差异影响。
 */
function createCloseButton(onClick: () => void): HTMLElement {
  const button = document.createElement("div");
  button.className = "mood-close";
  button.setAttribute("title", t("closeDialog"));
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

interface DialogSpec {
  title: string;
  /** 内容较多时由内容自己滚动 */
  scroll?: boolean;
  desktopWidth: string;
  desktopHeight: string;
  /**
   * 只留右上角的 × 关闭：
   * - 点遮罩不关（disableClose；它同时会隐藏原生关闭图标，所以关闭按钮一律自绘）
   * - Esc 不关：思源的全局快捷键不看 disableClose，直接销毁最上层弹窗，只能自己拦
   * 答题中途有进度，误关一次就得重答，所以问答用严格模式。
   */
  strictClose?: boolean;
  /** 弹窗销毁后的额外清理（例如清除「当前开着」的引用） */
  onDestroyed?: () => void;
  component: unknown;
  props: Record<string, unknown>;
}

function mountDialog(spec: DialogSpec): Dialog | null {
  const holder: { mounted: MountedApp | null } = { mounted: null };
  const fullscreen = isMobile();

  let releaseEsc: () => void = () => {};

  const dialog = new Dialog({
    title: spec.title,
    content: `<div class="mood-dialog${spec.scroll ? " mood-dialog--scroll" : ""}" id="mood-dialog-host"></div>`,
    width: fullscreen ? "100vw" : spec.desktopWidth,
    height: fullscreen ? "100vh" : spec.desktopHeight,
    // 挡掉点遮罩关闭（问答用；详情不挡）
    disableClose: spec.strictClose,
    // 原生关闭图标一律换成自绘的：移动端它本来就是隐藏的（SiYuan 3.8 的条件是 mobile || disableClose || hideCloseIcon），
    // 桌面端又和 disableClose 绑在一起，写自己的最省心，位置和触感还能按平台调。
    hideCloseIcon: true,
    destroyCallback: () => {
      releaseEsc();
      unmountVue(holder.mounted);
      holder.mounted = null;
      spec.onDestroyed?.();
    },
  });

  const container = dialog.element.querySelector(".b3-dialog__container");
  if (container) container.appendChild(createCloseButton(() => dialog.destroy()));

  if (spec.strictClose) {
    // 捕获阶段拦截 Esc：思源的 keydown 挂在 window 的冒泡阶段，这里先一步 stopPropagation 就不会走到它。
    // 只在自己是最上层弹窗时拦，免得连上层别的对话框也一起屏蔽掉。
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      const dialogs = window.siyuan?.dialogs;
      const top = dialogs && dialogs.length ? dialogs[dialogs.length - 1] : null;
      if (top && top.element === dialog.element) event.stopPropagation();
    };
    window.addEventListener("keydown", onKeydown, true);
    releaseEsc = () => window.removeEventListener("keydown", onKeydown, true);
  }

  if (fullscreen) {
    dialog.element.querySelector(".b3-dialog__container")?.classList.add("mood-dialog-fullscreen");
  }

  const host = dialog.element.querySelector("#mood-dialog-host") as HTMLElement | null;
  if (!host) {
    console.error("[mood] dialog host not found");
    dialog.destroy();
    return null;
  }

  holder.mounted = mountVue(host, spec.component, spec.props);
  return dialog;
}

/** 开始一次问答；完成后自动打开该条记录并（按设置）解读 */
let quizDialogInstance: Dialog | null = null;

export function openQuizDialog(): void {
  // 已经开着就不重复开：问卷答到一半，叠开第二个会丢作答
  if (quizDialogInstance) return;
  let dialog: Dialog | null = null;
  dialog = mountDialog({
    title: t("quizTitle"),
    desktopWidth: "560px",
    desktopHeight: "520px",
    strictClose: true,
    component: QuizDialog,
    props: {
      onDone: (record: QuizRecord) => {
        dialog?.destroy();
        openRecordDialog(record.id, true);
      },
    },
    onDestroyed: () => {
      quizDialogInstance = null;
    },
  });
  quizDialogInstance = dialog;
}

export function openRecordDialog(recordId: string, autoAnalyze = false): void {
  let dialog: Dialog | null = null;
  dialog = mountDialog({
    title: t("detailTitle"),
    scroll: true,
    desktopWidth: "640px",
    desktopHeight: "70vh",
    component: RecordDetail,
    props: {
      recordId,
      embedded: false,
      onBack: () => dialog?.destroy(),
    },
  });

  const record = findRecord(recordId);
  if (!record) return;
  if (autoAnalyze && state.settings.ai.autoRun && record.ai.status !== "done") {
    void analyzeRecord(record).then((outcome) => {
      if (!outcome.ok && outcome.message) {
        showMessage(outcome.message, 7000, outcome.reason === "empty" ? "info" : "error");
      }
    });
  }
}

/**
 * 快速打卡：点一个词就存，几秒完事。
 * 故意做得比答题轻得多——正式测评不该太频繁，但一天里「早上平静、中午累」这种变化值得随手记。
 * 点完不关弹窗：下方根据最近轨迹给一句 AI 小建议（AI 不可用时退回本地一句话），再点别的词可继续记。
 */
const FALLBACK_HINTS: Record<EmotionFamily, string> = {
  steady: "状态好的时候，顺手留意一下是什么在支持你。",
  restless: "紧绷的时候，先做三次慢呼吸，让肩膀沉下来。",
  low: "低落的时候不用急着振作，先给自己倒杯水。",
  drained: "累的时候允许自己停十分钟，什么都不做。",
  unclear: "说不上来也没关系，先照顾身体：喝口水，起来走两步。",
};

let checkinDialogInstance: Dialog | null = null;

/** 打卡弹窗是开关语义：再执行一次（快捷键或按钮）就关闭，而不是叠一层 */
export function openCheckInDialog(): void {
  if (checkinDialogInstance) {
    const open = checkinDialogInstance;
    checkinDialogInstance = null;
    open.destroy();
    return;
  }

  const dialog = new Dialog({
    title: t("checkinTitle"),
    content: `<div class="mood-dialog">
  <div class="mood-setting-note">${escapeHtml(t("checkinHint"))}</div>
  <div class="mood-chips mood-checkin-grid" id="mood-checkin-grid"></div>
  <input class="mood-input" id="mood-checkin-custom" type="text" placeholder="${escapeHtml(t("checkinCustomPlaceholder"))}">
  <div class="mood-setting-note" style="margin-top:10px">${escapeHtml(t("checkinWeatherTitle"))}</div>
  <div class="mood-chips mood-checkin-grid" id="mood-checkin-weather"></div>
  <div class="mood-checkin-actions"><button class="mood-btn mood-btn--primary" id="mood-checkin-save" disabled>${escapeHtml(t("checkinSaveButton"))}</button></div>
  <div class="mood-suggest" id="mood-checkin-suggest" style="display:none"></div>
</div>`,
    width: isMobile() ? "92vw" : "380px",
    height: "auto",
    destroyCallback: () => {
      checkinDialogInstance = null;
    },
  });
  checkinDialogInstance = dialog;

  const grid = dialog.element.querySelector("#mood-checkin-grid") as HTMLElement | null;
  const weatherGrid = dialog.element.querySelector("#mood-checkin-weather") as HTMLElement | null;
  const panel = dialog.element.querySelector("#mood-checkin-suggest") as HTMLElement | null;
  const input = dialog.element.querySelector("#mood-checkin-custom") as HTMLInputElement | null;
  const saveButton = dialog.element.querySelector("#mood-checkin-save") as HTMLButtonElement | null;
  if (!grid || !panel || !input || !saveButton || !weatherGrid) {
    dialog.destroy();
    return;
  }

  // 连续保存时，只有最后一次请求的结果允许上屏
  let requestToken = 0;
  const picked = new Set<string>();
  const weather = { value: "" };
  const chips = new Map<string, HTMLElement>();

  const renderSuggestion = (markdown: string): void => {
    panel.style.display = "";
    panel.innerHTML = `<div class="mood-suggest__title">${escapeHtml(t("checkinSuggestTitle"))}</div><div class="mood-md mood-md--compact">${md2html(markdown)}</div>`;
  };

  const renderLoading = (): void => {
    panel.style.display = "";
    panel.innerHTML = `<div class="mood-suggest__title">${escapeHtml(t("checkinSuggestTitle"))}</div><div class="mood-thinking__line"><span class="mood-dots"><i /><i /><i /></span><span class="mood-setting-note">${escapeHtml(t("checkinSuggestLoading"))}</span></div>`;
  };

  const suggest = (word: string, token: number): void => {
    const family = wordFamily(word);
    const entries = state.checkins.slice(0, 10);
    if (!state.settings.ai.enabled) {
      renderSuggestion(FALLBACK_HINTS[family]);
      return;
    }
    renderLoading();
    void fetchCheckinSuggestion(entries).then((text) => {
      if (token !== requestToken) return;
      renderSuggestion(text || FALLBACK_HINTS[family]);
    });
  };

  const refreshSave = (): void => {
    saveButton.disabled = picked.size === 0 && !input.value.trim();
  };

  /** chip 内容：Blob 图标 + 词；设置关闭表情或自定义词没有图标时，只显示文字 */
  const setChipContent = (chip: HTMLElement, word: string): void => {
    const file = state.settings.checkinIcons ? wordIconFile(word) : "";
    const icon = file ? `<img class="mood-emoji-img" src="${iconUrl(file)}" alt="">` : "";
    chip.innerHTML = `${icon}<span>${escapeHtml(word)}</span>`;
  };

  const refreshChip = (word: string): void => {
    const chip = chips.get(word);
    if (!chip) return;
    const family = familyOf(word);
    setChipContent(chip, word);
    if (picked.has(word)) {
      chip.style.background = family.background;
      chip.style.color = family.color;
      chip.style.borderColor = family.color;
    } else {
      chip.style.background = "";
      chip.style.color = "";
      chip.style.borderColor = "var(--b3-border-color)";
    }
  };

  // 情绪词：内置 + 用户自定义
  for (const word of allCheckinWords()) {
    const chip = document.createElement("span");
    chip.className = "mood-chip mood-closing__chip";
    setChipContent(chip, word);
    chip.addEventListener("click", () => {
      if (picked.has(word)) picked.delete(word);
      else picked.add(word);
      refreshChip(word);
      refreshSave();
    });
    chips.set(word, chip);
    grid.appendChild(chip);
  }

  // 天气：单选，可再点一次取消（同样受「显示表情」开关影响）
  for (const item of WEATHERS) {
    const chip = document.createElement("span");
    chip.className = "mood-chip mood-closing__chip mood-weather-chip";
    const weatherFile = state.settings.checkinIcons ? weatherIconFile(item.value) : "";
    chip.innerHTML = `${weatherFile ? `<img class="mood-emoji-img" src="${iconUrl(weatherFile)}" alt="">` : ""}<span>${escapeHtml(item.label)}</span>`;
    chip.title = item.label;
    chip.addEventListener("click", () => {
      weather.value = weather.value === item.value ? "" : item.value;
      Array.from(weatherGrid.children).forEach((element) => {
        (element as HTMLElement).style.borderColor = "var(--b3-border-color)";
        (element as HTMLElement).style.background = "";
      });
      if (weather.value) {
        chip.style.borderColor = "var(--b3-theme-primary)";
        chip.style.background = "var(--b3-theme-primary-lightest)";
      }
    });
    weatherGrid.appendChild(chip);
  }

  input.addEventListener("input", refreshSave);

  saveButton.addEventListener("click", () => {
    void (async () => {
      const words = Array.from(picked);
      const custom = input.value.trim();
      if (!words.length && !custom) return;

      const saved = [];
      for (const word of words) saved.push(await addCheckIn(word, weather.value || undefined));
      if (custom) saved.push(await addCheckIn(custom, weather.value || undefined));

      const label = saved.map((entry) => entry.word).join("、");
      const weatherFile = weather.value ? weatherIconFile(weather.value) : "";
      const weatherIcon = weatherFile ? `<img class="mood-emoji-img" src="${iconUrl(weatherFile)}" alt="">` : "";
      renderSuggestion(`${escapeHtml(t("checkinSaved"))}：${escapeHtml(label)} ${weatherIcon}· ${formatTime(saved[0].at)}`);

      picked.clear();
      for (const word of chips.keys()) refreshChip(word);
      input.value = "";
      refreshSave();

      requestToken++;
      suggest(saved[0].word, requestToken);
    })();
  });
}
