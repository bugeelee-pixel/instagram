import { createServer } from "node:http";
import worker from "../worker/index.js";

const port = Number(process.env.PORT || 8787);
createServer(async (incoming, outgoing) => {
  const chunks = [];
  for await (const chunk of incoming) chunks.push(chunk);
  const request = new Request(`http://127.0.0.1:${port}${incoming.url}`, {
    method: incoming.method,
    headers: incoming.headers,
    body: ["GET", "HEAD"].includes(incoming.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await worker.fetch(request, process.env, {});
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, "127.0.0.1", () => console.log(`Medibox planner: http://127.0.0.1:${port}`));
