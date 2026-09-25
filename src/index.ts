import { Plugin, Setting } from "siyuan";
import "@/index.scss";
import PluginInfoString from "@/../plugin.json";
import { setPlugin, t } from "@/plugin";
import { loadAll, state } from "@/store";
import { Reminder } from "@/stats/reminder";
import { disposeAiObservers } from "@/ai/siyuanAi";
import { mountVue, unmountVue, type MountedApp } from "@/main";
import { openQuizDialog } from "@/ui/dialogs";
import { registerSettings } from "@/ui/settings/SettingPanel";
import { MOOD_ICONS } from "@/ui/icons";
import DockPanel from "@/ui/Dock.vue";

const DOCK_TYPE = "moodDock";

let PluginInfo = { version: "" };
try {
  PluginInfo = PluginInfoString;
} catch (err) {
  console.log("Mood plugin info parse error: ", err);
}

export default class MoodPlugin extends Plugin {
  private dockApp: MountedApp | null = null;
  private reminder: Reminder | null = null;
  private topBarElement: HTMLElement | null = null;
  private dot: HTMLElement | null = null;

  async onload() {
    setPlugin({
      name: this.name,
      i18n: this.i18n as Record<string, string>,
      loadData: (name: string) => this.loadData(name),
      saveData: (name: string, data: unknown) => this.saveData(name, data),
      addIcons: (svg: string) => this.addIcons(svg),
      addDock: (options: any) => this.addDock(options),
      addTopBar: (options: any) => this.addTopBar(options),
      addCommand: (options: any) => this.addCommand(options),
      openSetting: () => this.setting.open(this.name),
      snoozeReminder: async () => {
        await this.reminder?.snoozeToday();
      },
      refreshReminder: () => {
        void this.reminder?.afterQuiz();
      },
    });

    this.addIcons(MOOD_ICONS);

    // 界面注册必须是同步的：思源的布局就绪后再调用 addDock / addTopBar 会失效
    this.registerTopBar();
    this.registerDock();
    this.registerCommand();

    this.setting = new Setting({
      confirmCallback: () => {
        void this.reminder?.refreshDot();
      },
    });
    registerSettings(this, this.setting);

    // 数据加载放在界面注册之后，Dock 内部用 state.ready 控制加载态
    await loadAll();

    this.reminder = new Reminder({
      onDot: (on: boolean) => this.setDot(on),
    });
    this.reminder.start();

    console.log(`[mood] plugin loaded, version ${PluginInfo.version}`);
  }

  onunload() {
    this.reminder?.stop();
    this.reminder = null;
    disposeAiObservers();
    unmountVue(this.dockApp);
    this.dockApp = null;
    this.dot?.remove();
    this.dot = null;
    state.detailId = "";
    console.log("[mood] plugin unloaded");
  }

  private registerTopBar(): void {
    this.topBarElement = this.addTopBar({
      icon: "iconMood",
      title: t("topBarTitle"),
      position: "right",
      callback: () => openQuizDialog(),
    });

    if (this.topBarElement) {
      this.topBarElement.style.position = "relative";
      this.dot = document.createElement("div");
      this.dot.className = "mood-dot";
      this.dot.style.display = "none";
      this.topBarElement.appendChild(this.dot);
    }
  }

  private registerDock(): void {
    const self = this;
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 320, height: 0 },
        icon: "iconMood",
        title: t("dockTitle"),
      },
      data: null,
      type: DOCK_TYPE,
      init(this: any) {
        unmountVue(self.dockApp);
        self.dockApp = mountVue(this.element as HTMLElement, DockPanel);
      },
      destroy() {
        unmountVue(self.dockApp);
        self.dockApp = null;
      },
    });
  }

  private registerCommand(): void {
    this.addCommand({
      langKey: "startQuiz",
      hotkey: "",
      callback: () => openQuizDialog(),
    });
  }

  private setDot(on: boolean): void {
    if (this.dot) this.dot.style.display = on ? "block" : "none";
  }
}
