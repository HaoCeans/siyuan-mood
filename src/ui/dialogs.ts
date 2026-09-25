/** 对话框调度：问答流程与记录详情都用思源的 Dialog，内容区挂 Vue 组件 */
import { Dialog, getFrontend, showMessage } from "siyuan";
import { t } from "@/plugin";
import { mountVue, unmountVue, type MountedApp } from "@/main";
import QuizDialog from "@/ui/QuizDialog.vue";
import RecordDetail from "@/ui/RecordDetail.vue";
import { analyzeRecord } from "@/ai/analyze";
import { findRecord, state } from "@/store";
import type { QuizRecord } from "@/types/mood";

export function isMobile(): boolean {
  const frontend = getFrontend();
  return frontend === "mobile" || frontend === "browser-mobile";
}

/** 开始一次问答；完成后自动打开该条记录并（按设置）解读 */
export function openQuizDialog(): void {
  let mounted: MountedApp | null = null;
  const dialog = new Dialog({
    title: t("quizTitle"),
    content: '<div class="mood-dialog" id="mood-quiz-host"></div>',
    width: isMobile() ? "92vw" : "560px",
    height: isMobile() ? "70vh" : "520px",
    destroyCallback: () => {
      unmountVue(mounted);
      mounted = null;
    },
  });

  const host = dialog.element.querySelector("#mood-quiz-host") as HTMLElement | null;
  if (!host) {
    console.error("[mood] quiz host not found");
    dialog.destroy();
    return;
  }

  mounted = mountVue(host, QuizDialog, {
    onDone: (record: QuizRecord) => {
      dialog.destroy();
      openRecordDialog(record.id, true);
    },
    onCancel: () => dialog.destroy(),
  });
}

export function openRecordDialog(recordId: string, autoAnalyze = false): void {
  let mounted: MountedApp | null = null;
  const dialog = new Dialog({
    title: t("detailTitle"),
    content: '<div class="mood-dialog mood-dialog--scroll" id="mood-detail-host"></div>',
    width: isMobile() ? "92vw" : "640px",
    height: isMobile() ? "80vh" : "70vh",
    destroyCallback: () => {
      unmountVue(mounted);
      mounted = null;
    },
  });

  const host = dialog.element.querySelector("#mood-detail-host") as HTMLElement | null;
  if (!host) {
    console.error("[mood] detail host not found");
    dialog.destroy();
    return;
  }

  mounted = mountVue(host, RecordDetail, {
    recordId,
    embedded: false,
    onBack: () => dialog.destroy(),
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
