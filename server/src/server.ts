import http from "node:http";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { createApp } from "./app.js";
import { connectDatabase, syncDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { registerChatSocket } from "./sockets/chatSocket.js";

export async function startServer(): Promise<HttpServer> {
  await connectDatabase();
  await syncDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  });

  registerChatSocket(io);

  httpServer.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });

  return httpServer;
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
