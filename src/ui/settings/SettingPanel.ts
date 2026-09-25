/** 设置面板：题目与提醒参数、AI 开关与提示词、题库与数据的导入导出 */
import { showMessage, type Plugin, type Setting } from "siyuan";
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
import { downloadText, pickTextFile } from "@/utils/dom";

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

function button(text: string, onClick: () => void, primary = false): HTMLElement {
  const element = document.createElement("button");
  element.className = primary ? "mood-btn mood-btn--primary" : "mood-btn";
  element.textContent = text;
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
    description: `${t("settingBankCount")}：${state.bank.questions.length}｜${t("settingBankActive")}：${activeQuestions().length}`,
    createActionElement: () =>
      row(
        button(t("bankImport"), () => void doImportBank()),
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

// **************************************** 导入导出 ****************************************

async function doImportBank(): Promise<void> {
  const file = await pickTextFile(".json");
  if (!file) return;
  const result = parseBankJson(file.text);
  if (!result.ok || !result.bank) {
    showMessage(`${t("importFailed")}：${result.error}`, 9000, "error");
    return;
  }
  await importBank(result.bank);
  showMessage(t("bankImported").replace("{n}", String(result.bank.questions.length)));
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
