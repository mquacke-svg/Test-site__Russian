// Apache Passenger supplies the listening socket on Beget.
process.env.TOKIO_WORKER_THREADS ||= "2";
process.env.RAYON_NUM_THREADS ||= "2";
process.env.UV_THREADPOOL_SIZE ||= "2";
const { createServer } = require("node:http");
const path = require("node:path");
const next = require("next");

process.chdir(path.resolve(__dirname, "../.."));
process.env.NODE_ENV = "production";
const app = next({ dev: false, dir: process.cwd() });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((request, response) => {
    Promise.resolve(handle(request, response)).catch((error) => {
      console.error("Request failed", error);
      if (!response.headersSent) response.statusCode = 500;
      response.end();
    });
  }).listen(Number(process.env.PORT) || 3000, "127.0.0.1");
}).catch((error) => {
  console.error("Application failed to start", error);
  process.exit(1);
});
