import { start } from "./server.js";

const { port } = await start({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST });
console.log(`api on :${port}`);
