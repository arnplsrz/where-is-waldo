import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync(".build", { recursive: true, force: true });

for (const [name, entry] of [["api", "lambda"], ["worker", "worker"]]) {
  const dir = `.build/${name}`;
  mkdirSync(dir, { recursive: true });
  await build({
    entryPoints: [`src/${entry}.ts`],
    outfile: `${dir}/index.js`,
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    sourcemap: true,
    minify: true,
    external: ["@aws-sdk/*"],
  });
  execFileSync("zip", ["-qr", `../${name}.zip`, "."], { cwd: dir });
}
