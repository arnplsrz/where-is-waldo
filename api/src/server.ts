import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile();

import("./app").then(({ createApp }) => {
  const port = Number(process.env.PORT ?? 4000);
  createApp().listen(port, () => console.log(`API on http://localhost:${port}`));
});
