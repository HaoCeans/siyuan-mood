/**
 * 插件实例的载荷点：UI 组件不直接依赖 siyuan 的类型定义，
 * 只通过这个窄接口访问插件能力，避免内核类型升级时的连锁修改。
 */
import zhCN from "@/i18n/zh_CN.json";

export interface PluginHost {
  name: string;
  i18n: Record<string, string>;
  loadData(name: string): Promise<any>;
  saveData(name: string, data: unknown): Promise<void>;
  addIcons(svg: string): void;
  addDock(options: any): any;
  addTopBar(options: any): HTMLElement;
  addCommand(options: any): void;
  /** 打开插件设置面板 */
  openSetting(): void;
  /** 「今天不再提醒」 */
  snoozeReminder(): Promise<void>;
  /** 数据变化后重算提醒状态 */
  refreshReminder(): void;
}

let host: PluginHost | null = null;

export function setPlugin(plugin: PluginHost): void {
  host = plugin;
}

export function getPlugin(): PluginHost | null {
  return host;
}

/** 当前界面语言字典，缺 key 时回落中文，再回落 key 本身 */
export function t(key: string, fallback?: string): string {
  const dict = host?.i18n || {};
  return dict[key] || (zhCN as Record<string, string>)[key] || fallback || key;
}
