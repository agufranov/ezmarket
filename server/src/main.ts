import "reflect-metadata";
import { createApp } from "./app.factory";
import { loadConfig } from "./config";

async function main() {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.PORT, "0.0.0.0");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
