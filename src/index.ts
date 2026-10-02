import { Plugin, Setting, showMessage } from "siyuan";
import "@/index.scss";
import PluginInfoString from "@/../plugin.json";
import { setPlugin, t } from "@/plugin";
import { loadAll, state } from "@/store";
import { Reminder } from "@/stats/reminder";
import { disposeAiObservers } from "@/ai/siyuanAi";
import { mountVue, unmountVue, type MountedApp } from "@/main";
import { isMobile, openQuizDialog, openCheckInDialog } from "@/ui/dialogs";
import { registerSettings } from "@/ui/settings/SettingPanel";
import { MOOD_ICONS } from "@/ui/icons";
import DockPanel from "@/ui/Dock.vue";
import { getMobileDockKey, isNewMobileDockArch, openMobilePluginDock } from "@/utils/mobilePanel";

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
      /** 打开插件设置面板 */
      openSetting: () => this.setting.open(this.name),
      /** 打开「心情」侧栏面板（桌面 dock / 手机抽屉） */
      openMoodPanel: () => this.openMoodPanel(),
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
    this.addCommand({
      langKey: "checkin",
      hotkey: "⌥⌘M",
      callback: () => openCheckInDialog(),
    });
  }

  private setDot(on: boolean): void {
    if (this.dot) this.dot.style.display = on ? "block" : "none";
  }

  /**
   * 打开「心情」侧栏面板。
   * 桌面：程序化点击停靠栏图标——插件的 dock 键 = 插件名 + DOCK_TYPE（见思源 addDock
   * 源码 type2 = this.name + options.type），图标元素的 data-type 就是这个键。
   * 手机：addDock 在移动端同样生效（mobileModel 分支），面板在侧滑抽屉里，按
   * v3.8.2+ 新架构 / ≤3.8.1 旧架构分别拉起。
   */
  private openMoodPanel(): void {
    const dockKey = getMobileDockKey(this.name);

    if (!isMobile()) {
      const item = document.querySelector<HTMLElement>(`.dock__item[data-type="${dockKey}"]`);
      if (item) item.click();
      else showMessage(t("panelNotReady"));
      return;
    }

    // addDock 时思源把 mobileModel 挂在这个键上；面板没就绪说明 dock 还没注册完
    const dock = (this as unknown as {
      docks?: Record<string, { mobileModel?: (element: Element) => unknown; update?: () => void; destroy?: () => void; type?: string }>;
    }).docks?.[dockKey];
    if (!dock?.mobileModel) {
      showMessage(t("panelNotReady"));
      return;
    }

    // v3.8.2+：面板挂载由思源框架自动完成（mobileModel → init），这里只负责把抽屉拉出来
    if (isNewMobileDockArch()) {
      if (!openMobilePluginDock(dockKey)) showMessage(t("panelNotReady"));
      return;
    }

    // 旧版（≤3.8.1）：打开左侧栏 → 切到「插件」页 → 把面板挂进通用容器
    const container = document.querySelector('#sidebar [data-type="sidebar-plugin"]');
    if (!container) {
      showMessage(t("panelNotReady"));
      return;
    }
    document.getElementById("toolbarFile")?.dispatchEvent(new CustomEvent("click"));
    const toolbar = document.querySelector("#sidebar .toolbar--border");
    toolbar?.dispatchEvent(new CustomEvent("click", { detail: "plugin" }));

    const mountDock = () => {
      const w = window as Window & { siyuan?: { mobile?: { docks?: Record<string, unknown> } } };
      const existing = w.siyuan?.mobile?.docks?.[dockKey] as
        | { update?: () => void; destroy?: () => void; type?: string }
        | undefined;
      if (existing?.type === dockKey) {
        existing.update?.();
        return;
      }
      existing?.destroy?.();
      const custom = dock.mobileModel(container);
      if (!w.siyuan) return;
      if (!w.siyuan.mobile) w.siyuan.mobile = {};
      if (!w.siyuan.mobile.docks) w.siyuan.mobile.docks = {};
      w.siyuan.mobile.docks[dockKey] = custom;
    };

    const activeTab = toolbar?.querySelector(".toolbar__icon--active")?.getAttribute("data-type");
    if (activeTab === "sidebar-plugin-tab") {
      mountDock();
      return;
    }
    // 等「插件」页签切过去再挂载
    window.setTimeout(mountDock, 120);
  }
}
