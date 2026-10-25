import { lazy, type ComponentType } from "react";
/** Retry transient module downloads once without reloading unsaved drafts. */
export async function retryImport<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (
      !navigator.onLine ||
      !/fetch dynamically imported|importing a module|loading chunk|error loading dynamically imported|preload/i.test(
        String(error),
      )
    )
      throw error;
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return loader();
  }
}
export function lazyRetry<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
) {
  return lazy(() => retryImport(loader));
}
