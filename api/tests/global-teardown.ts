export default async function globalTeardown() {
  const server = (globalThis as { dynalite?: { close: (cb: () => void) => void } }).dynalite;
  await new Promise<void>((resolve) => (server ? server.close(resolve) : resolve()));
}
