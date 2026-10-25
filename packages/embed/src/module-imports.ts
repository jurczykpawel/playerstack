export function createModuleLoader<T>(
  base: string,
  file: string,
  importer: (url: string) => Promise<T> = (url) => import(url),
): () => Promise<T> {
  const url = new URL(file, base);
  let pending: Promise<T> | undefined;
  let failures = 0;
  return () =>
    (pending ??= importer(url.href).catch((error: unknown) => {
      pending = undefined;
      // Browsers cache failed module fetches too; a retry needs a fresh URL.
      url.searchParams.set("retry", String(++failures));
      throw error;
    }));
}
