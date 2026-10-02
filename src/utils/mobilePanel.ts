/**
 * 手机端侧栏 / Dock 面板工具（移植自 siyuan-comment 的同名实现，按本插件改键名）。
 *
 * 思源 v3.8.2 重构了移动端插件 Dock：侧栏从旧「通用 sidebar-plugin 容器 + 左侧栏」
 * 改为「按插件 Dock 键（插件名 + Dock type）生成独立 tab/内容容器 + 左右侧栏（新增
 * #sidebarRight）+ 程序化 click（CustomEvent detail 为字符串）」。旧版直接改
 * #sidebar transform 的方式会绕过思源 closePanel() 的状态同步，且漏掉右侧栏，
 * 导致「回不到文档页面」。本工具统一新旧两代契约的手机面板打开操作。
 */

/** 本插件 Dock type（与 index.ts DOCK_TYPE 一致：最终 dock 键 = 插件名 + type） */
export const MOBILE_DOCK_TYPE = "moodDock";

/** 手机端侧栏面板容器集合（打开时清非目标侧栏的 transform，避免两层抽屉叠加） */
const MOBILE_SIDEBAR_IDS = ["#sidebar", "#sidebarRight"] as const;

/** 思源移动端 dock 键：插件名 + Dock type（SDK addDock 的 type2 = this.name + options.type） */
export function getMobileDockKey(pluginName: string): string {
  return pluginName + MOBILE_DOCK_TYPE;
}

/**
 * 是否为思源 v3.8.2+ 新版移动端 Dock 架构。
 * 新架构每个插件 dock 都会渲染带 data-mobile-plugin-dock-tab 的 tab 元素；
 * ≤3.8.1 无该属性，走旧侧栏契约。
 */
export function isNewMobileDockArch(): boolean {
  return !!document.querySelector("[data-mobile-plugin-dock-tab]");
}

/**
 * 打开手机端 Dock：复刻思源 app/src/mobile/dock/util.ts openDock 的完整行为。
 * 找到本插件 tab → 清另一侧 sidebar 的 transform → 本侧写 translateX(0px) →
 * 向侧栏 toolbar（firstElementChild）派发 CustomEvent("click", { detail: dockKey })。
 * 思源 initFramework.ts 中 event.detail 为字符串时按程序化点击处理并挂载面板。
 * @returns 是否成功触发（tab / 侧栏面板未就绪时返回 false）
 */
export function openMobilePluginDock(dockKey: string): boolean {
  try {
    const tab =
      document.querySelector<HTMLElement>(`[data-mobile-plugin-dock-tab="${dockKey}"]`) ??
      document.querySelector<HTMLElement>(`[data-type="sidebar-${dockKey}-tab"]`);
    if (!tab) return false;
    const sidePanel = tab.closest<HTMLElement>(".side-panel");
    if (!sidePanel || tab.classList.contains("fn__none")) return false;

    document.querySelectorAll<HTMLElement>(MOBILE_SIDEBAR_IDS.join(",")).forEach((el) => {
      if (el !== sidePanel) el.style.transform = "";
    });
    sidePanel.style.transform = "translateX(0px)";
    sidePanel.firstElementChild?.dispatchEvent(
      new CustomEvent("click", { detail: dockKey }),
    );
    return true;
  } catch {
    return false;
  }
}
