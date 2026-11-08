import { buildApp } from "./app.js";
import { seed } from "./seed.js";

if (process.env.SEED !== "0") seed();
const port = Number(process.env.PORT ?? 3000);
buildApp().listen({ port, host: "0.0.0.0" }).then(() => console.log(`api on :${port}`));
