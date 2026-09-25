/**
 * Vue 挂载工具。
 * 模板原先的写法是在 document.body 下挂一个全屏浮层，并且在模块级函数里用 this.name，
 * 这里改成显式传入容器与卸载句柄 —— 挂载和清理必须成对出现，否则顶栏按钮、观察者会残留。
 */
import { createApp, type App as VueApp } from "vue";

export interface MountedApp {
  app: VueApp;
  root: HTMLElement;
  container: HTMLElement;
}

export function mountVue(container: HTMLElement, component: unknown, props: Record<string, unknown> = {}): MountedApp {
  const root = document.createElement("div");
  root.className = "mood-root";
  container.appendChild(root);
  const app = createApp(component as any, props);
  app.mount(root);
  return { app, root, container };
}

export function unmountVue(mounted: MountedApp | null | undefined): void {
  if (!mounted) return;
  try {
    mounted.app.unmount();
  } catch (err) {
    console.error("[mood] unmount failed", err);
  }
  mounted.root.remove();
}
