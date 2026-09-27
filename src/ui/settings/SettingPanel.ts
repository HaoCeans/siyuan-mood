/** 设置面板：题目与提醒参数、AI 开关与提示词、题库与数据的导入导出 */
import { Dialog, showMessage, type Plugin, type Setting } from "siyuan";
import { t } from "@/plugin";
import {
  activeQuestions,
  clearAll,
  exportAll,
  exportBank,
  importAll,
  importBank,
  parseBankJson,
  saveSettings,
  sortedRecords,
  state,
} from "@/store";
import { BUILTIN_QUESTIONS } from "@/quiz/bank";
import { dimensionLabel, parseMarkdownBank } from "@/quiz/markdownBank";
import { refineBankWithAi } from "@/ai/bankImport";
import { isMobile } from "@/ui/dialogs";
import { downloadText, escapeHtml, pickTextFile } from "@/utils/dom";
import type { QuizQuestion } from "@/types/mood";

function numberInput(value: number, min: number, max: number, onChange: (value: number) => void): HTMLElement {
  const input = document.createElement("input");
  input.className = "mood-number";
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.addEventListener("change", () => {
    const parsed = Number(input.value);
    const safe = Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : value;
    input.value = String(safe);
    onChange(safe);
  });
  return input;
}

function checkbox(checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "b3-switch fn__flex-center";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

function select(options: { value: string; label: string }[], value: string, onChange: (value: string) => void): HTMLElement {
  const element = document.createElement("select");
  element.className = "mood-select b3-select";
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    element.appendChild(item);
  }
  element.value = value;
  element.addEventListener("change", () => onChange(element.value));
  return element;
}

function timeInput(value: string, onChange: (value: string) => void): HTMLElement {
  const input = document.createElement("input");
  input.className = "mood-number";
  input.type = "time";
  input.value = value;
  input.addEventListener("change", () => onChange(input.value || value));
  return input;
}

function button(text: string, onClick: () => void, primary = false, title = ""): HTMLElement {
  const element = document.createElement("button");
  element.className = primary ? "mood-btn mood-btn--primary" : "mood-btn";
  element.textContent = text;
  if (title) element.setAttribute("title", title);
  element.addEventListener("click", onClick);
  return element;
}

function row(...children: HTMLElement[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "mood-setting-row";
  for (const child of children) wrapper.appendChild(child);
  return wrapper;
}

async function persist(): Promise<void> {
  await saveSettings();
}

export function registerSettings(plugin: Plugin, setting: Setting): void {
  const refreshReminder = (): void => {
    const withReminder = plugin as unknown as { reminder?: { refreshDot(): void } };
    withReminder.reminder?.refreshDot();
  };

  // **************************************** 问答 ****************************************
  setting.addItem({
    title: t("settingQuizCount"),
    description: t("settingQuizCountTip"),
    createActionElement: () =>
      select(
        [5, 8, 10, 12, 15].map((n) => ({ value: String(n), label: `${n} ${t("unitQuestions")}` })),
        String(state.settings.questionsPerQuiz),
        (value) => {
          state.settings.questionsPerQuiz = Number(value);
          void persist();
        },
      ),
  });

  setting.addItem({
    title: t("settingUseBuiltin"),
    description: `${t("settingUseBuiltinTip")}（${BUILTIN_QUESTIONS.length}）`,
    createActionElement: () =>
      checkbox(state.settings.bank.useBuiltin, (value) => {
        state.settings.bank.useBuiltin = value;
        void persist();
      }),
  });

  setting.addItem({
    title: t("settingUseImported"),
    description: t("settingUseImportedTip"),
    createActionElement: () =>
      checkbox(state.settings.bank.importedEnabled, (value) => {
        state.settings.bank.importedEnabled = value;
        void persist();
      }),
  });

  setting.addItem({
    title: t("settingBank"),
    description: `${t("settingBankCount")}：${state.bank.questions.length}｜${t("settingBankActive")}：${activeQuestions().length}｜${t("bankImportTip")}`,
    createActionElement: () =>
      row(
        button(t("bankImport"), () => void doImportBank(), false, t("bankImportTip")),
        button(t("bankView"), () => void showBankPreview(activeQuestions(), t("bankViewNote").replace("{n}", String(activeQuestions().length)), false)),
        button(t("bankExport"), () => {
          if (!state.bank.questions.length) {
            showMessage(t("bankEmpty"));
            return;
          }
          downloadText(`mood-bank-${new Date().toISOString().slice(0, 10)}.json`, exportBank());
          showMessage(t("exportOk"));
        }),
      ),
  });

  // **************************************** 提醒 ****************************************
  setting.addItem({
    title: t("settingReminder"),
    description: t("settingReminderTip"),
    createActionElement: () =>
      checkbox(state.settings.reminder.enabled, (value) => {
        state.settings.reminder.enabled = value;
        void persist().then(refreshReminder);
      }),
  });

  setting.addItem({
    title: t("settingInterval"),
    description: t("settingIntervalTip"),
    createActionElement: () =>
      row(
        numberInput(state.settings.reminder.baseDays, 1, 60, (value) => {
          state.settings.reminder.baseDays = value;
          void persist().then(refreshReminder);
        }),
        numberInput(state.settings.reminder.minDays, 1, 30, (value) => {
          state.settings.reminder.minDays = value;
          void persist().then(refreshReminder);
        }),
        numberInput(state.settings.reminder.maxDays, 1, 90, (value) => {
          state.settings.reminder.maxDays = value;
          void persist().then(refreshReminder);
        }),
      ),
  });

  setting.addItem({
    title: t("settingQuiet"),
    description: t("settingQuietTip"),
    createActionElement: () =>
      row(
        timeInput(state.settings.reminder.quietFrom, (value) => {
          state.settings.reminder.quietFrom = value;
          void persist();
        }),
        timeInput(state.settings.reminder.quietTo, (value) => {
          state.settings.reminder.quietTo = value;
          void persist();
        }),
      ),
  });

  // **************************************** AI ****************************************
  setting.addItem({
    title: t("settingAi"),
    description: t("settingAiTip"),
    createActionElement: () =>
      checkbox(state.settings.ai.enabled, (value) => {
        state.settings.ai.enabled = value;
        void persist();
      }),
  });

  setting.addItem({
    title: t("settingAiAuto"),
    description: t("settingAiAutoTip"),
    createActionElement: () =>
      checkbox(state.settings.ai.autoRun, (value) => {
        state.settings.ai.autoRun = value;
        void persist();
      }),
  });

  setting.addItem({
    title: t("settingAiHistory"),
    description: t("settingAiHistoryTip"),
    createActionElement: () =>
      numberInput(state.settings.ai.maxContextRecords, 0, 10, (value) => {
        state.settings.ai.maxContextRecords = value;
        void persist();
      }),
  });

  setting.addItem({
    title: t("settingAiPrompt"),
    description: t("settingAiPromptTip"),
    direction: "column",
    createActionElement: () => {
      const textarea = document.createElement("textarea");
      textarea.className = "mood-input";
      textarea.rows = 3;
      textarea.placeholder = t("settingAiPromptPlaceholder");
      textarea.value = state.settings.ai.promptExtra || "";
      textarea.addEventListener("change", () => {
        state.settings.ai.promptExtra = textarea.value.trim() || undefined;
        void persist();
      });
      return textarea;
    },
  });

  // **************************************** 打卡词库 ****************************************
  setting.addItem({
    title: t("settingCheckinWords"),
    description: t("settingCheckinWordsTip"),
    direction: "column",
    createActionElement: () => createWordManager(),
  });

  setting.addItem({
    title: t("settingCheckinIcons"),
    description: t("settingCheckinIconsTip"),
    createActionElement: () =>
      checkbox(state.settings.checkinIcons, (value) => {
        state.settings.checkinIcons = value;
        void persist();
      }),
  });

  // **************************************** 数据 ****************************************
  setting.addItem({
    title: t("settingData"),
    description: `${t("settingDataCount")}：${sortedRecords().length}`,
    createActionElement: () =>
      row(
        button(t("dataExport"), () => {
          if (!sortedRecords().length) {
            showMessage(t("tableEmpty"));
            return;
          }
          downloadText(`mood-data-${new Date().toISOString().slice(0, 10)}.json`, exportAll());
          showMessage(t("exportOk"));
        }),
        button(t("dataImport"), () => void doImportAll()),
        button(t("dataClear"), () => void doClear()),
      ),
  });
}

// **************************************** 打卡词库 ****************************************

/**
 * 用户自定义打卡词的管理器：输入添加、点 × 删除。
 * 词存在 settings.checkinWords 里，与内置 16 个词合并使用。
 */
function createWordManager(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;gap:8px;width:100%";

  const rebuild = (container: HTMLElement, input: HTMLInputElement): void => {
    container.innerHTML = "";
    const words = state.settings.checkinWords || [];
    if (!words.length) {
      const empty = document.createElement("span");
      empty.className = "mood-setting-note";
      empty.textContent = t("wordsEmpty");
      container.appendChild(empty);
      return;
    }
    for (const word of words) {
      const chip = document.createElement("span");
      chip.className = "mood-chip";
      chip.textContent = `${word}  ×`;
      chip.title = t("wordRemove");
      chip.style.cursor = "pointer";
      chip.addEventListener("click", () => {
        state.settings.checkinWords = words.filter((item) => item !== word);
        void saveSettings();
        rebuild(container, input);
      });
      container.appendChild(chip);
    }
  };

  const inputRow = document.createElement("div");
  inputRow.className = "mood-setting-row";
  const input = document.createElement("input");
  input.className = "mood-input";
  input.type = "text";
  input.placeholder = t("wordInputPlaceholder");
  input.style.cssText = "flex:1;min-height:28px";
  const add = button(t("wordAddButton"), () => {
    const word = input.value.trim().slice(0, 12);
    if (!word) return;
    const existing = state.settings.checkinWords || [];
    if (existing.includes(word)) {
      showMessage(t("wordDuplicate"));
      return;
    }
    state.settings.checkinWords = [...existing, word];
    input.value = "";
    void saveSettings();
    rebuild(chips, input);
  }, true);
  inputRow.appendChild(input);
  inputRow.appendChild(add);

  const chips = document.createElement("div");
  chips.className = "mood-chips";
  rebuild(chips, input);

  wrapper.appendChild(inputRow);
  wrapper.appendChild(chips);
  return wrapper;
}

// **************************************** 导入导出 ****************************************

async function doImportBank(): Promise<void> {
  const file = await pickTextFile(".md,.markdown,.txt,.json");
  if (!file) return;
  const text = file.text.trim();
  if (!text) {
    showMessage(`${t("importFailed")}：${t("bankParseEmpty")}`, 8000, "error");
    return;
  }

  const name = file.name.replace(/\.[^.]+$/, "") || t("bankDefaultName");

  // 自己导出的 JSON 也认，导出再导入能对上
  if (text.startsWith("{")) {
    const result = parseBankJson(text);
    if (!result.ok || !result.bank) {
      showMessage(`${t("importFailed")}：${result.error}`, 9000, "error");
      return;
    }
    await saveParsedBank(name, result.bank.questions, t("bankFromJson"));
    return;
  }

  const parsed = parseMarkdownBank(text);
  if (!parsed.questions.length) {
    showMessage(`${t("importFailed")}：${parsed.error || t("bankParseEmpty")}`, 11000, "error");
    return;
  }

  // 先本地解析出结构，配了 AI 的话再让它判分类、分值和关键词
  const refined = await refineBankWithAi(text, parsed.questions);
  const note = parsed.error ? `${refined.note}（${parsed.error}）` : refined.note;
  await saveParsedBank(name, refined.questions, note);
}

/** 预览之后由用户决定要不要存 */
async function saveParsedBank(name: string, questions: QuizQuestion[], note: string): Promise<void> {
  const confirmed = await showBankPreview(questions, note, true);
  if (!confirmed) return;
  await importBank({ name, questions });
  showMessage(t("bankImported").replace("{n}", String(questions.length)));
}

/**
 * 题库预览。ask=true 时是导入前的确认（点保存才生效），ask=false 时只是看看。
 */
function showBankPreview(questions: QuizQuestion[], note: string, ask: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      dialog.destroy();
      resolve(value);
    };

    const items = questions
      .map((question, index) => {
        const detail =
          question.type === "text"
            ? t("bankTypeText")
            : `${question.type === "multiple" ? t("bankTypeMultiple") : t("bankTypeSingle")} · ${question.options.length}${t("bankOptionUnit")}`;
        const body = question.type === "text" ? t("bankTypeTextHint") : question.options.map((option) => escapeHtml(option.label)).join("、");
        return `<div class="mood-answer">
  <div class="mood-answer__q">${index + 1}. [${dimensionLabel(question.dimension)}] ${escapeHtml(question.text)}（${detail}）</div>
  <div class="mood-answer__a">${body}</div>
</div>`;
      })
      .join("");

    const dialog = new Dialog({
      title: ask ? t("bankPreviewTitle") : t("bankViewTitle"),
      content: `<div class="mood-dialog mood-dialog--scroll" style="height:100%">
  <div class="mood-setting-note">${escapeHtml(note)}</div>
  <div class="mood-detail" style="margin-top:8px">${items}</div>
</div>`,
      width: isMobile() ? "92vw" : "620px",
      height: isMobile() ? "80vh" : "70vh",
      // 确认导入时不希望误关，只能点保存或取消
      disableClose: ask,
      destroyCallback: () => finish(false),
    });

    const footer = document.createElement("div");
    footer.className = "mood-btn-group";
    footer.style.cssText = "margin-top:10px;justify-content:flex-end";
    if (ask) footer.appendChild(button(t("bankPreviewCancel"), () => finish(false)));
    const primary = button(ask ? t("bankPreviewSave") : t("bankViewClose"), () => finish(true), true);
    footer.appendChild(primary);
    dialog.element.querySelector(".b3-dialog__body")?.appendChild(footer);
  });
}

async function doImportAll(): Promise<void> {
  const file = await pickTextFile(".json");
  if (!file) return;
  const result = await importAll(file.text);
  if (!result.ok) {
    showMessage(`${t("importFailed")}：${result.error}`, 9000, "error");
    return;
  }
  showMessage(t("dataImported").replace("{n}", String(result.count ?? 0)));
}

async function doClear(): Promise<void> {
  const confirmed = window.confirm(t("dataClearConfirm"));
  if (!confirmed) return;
  await clearAll(true);
  showMessage(t("dataCleared"));
}
