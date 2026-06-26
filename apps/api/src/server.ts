import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const app = await createApp(config);

app.listen(config.port, () => {
  console.log(`Legal RAG API listening on http://localhost:${config.port}`);
});
