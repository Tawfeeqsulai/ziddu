import type { Server as HttpServer } from "node:http";
import type { Socket } from "node:net";
import type { NextApiRequest, NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";

type RealtimeHttpServer = HttpServer & {
  io?: SocketIOServer;
  feedPoller?: ReturnType<typeof setInterval>;
  feedSignature?: string;
  feedPollInProgress?: boolean;
};
type RealtimeApiResponse = NextApiResponse & {
  socket: Socket & { server: RealtimeHttpServer };
};

const POSTS_URL = "https://zoggy-backend-api.vercel.app/api/vendorposts";

async function checkVendorPosts(server: RealtimeHttpServer) {
  if (!server.io || server.feedPollInProgress) return;
  server.feedPollInProgress = true;
  try {
    const response = await fetch(POSTS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) return;
    const signature = payload.data.map((post: { id?: unknown; updated_at?: unknown }) => `${String(post.id)}:${String(post.updated_at ?? "")}`).join("|");
    if (server.feedSignature !== undefined && server.feedSignature !== signature) {
      server.io.emit("feed:changed", { updatedAt: Date.now() });
    }
    server.feedSignature = signature;
  } catch {
    // Reconnect clients will keep the current feed if the source API is offline.
  } finally {
    server.feedPollInProgress = false;
  }
}

export default function socketHandler(_request: NextApiRequest, response: RealtimeApiResponse) {
  const httpServer = response.socket.server;
  if (!httpServer.io) {
    const io = new SocketIOServer(httpServer, {
      path: "/api/socket.io",
      transports: ["websocket"],
      serveClient: false,
      addTrailingSlash: false,
    });
    httpServer.io = io;
    io.on("connection", (socket) => {
      socket.on("feed:invalidate", () => {
        io.emit("feed:changed", { updatedAt: Date.now() });
      });
      if (!httpServer.feedPoller) {
        void checkVendorPosts(httpServer);
        httpServer.feedPoller = setInterval(() => void checkVendorPosts(httpServer), 15_000);
        httpServer.feedPoller.unref?.();
      }
      socket.on("disconnect", () => {
        if (io.engine.clientsCount === 0 && httpServer.feedPoller) {
          clearInterval(httpServer.feedPoller);
          httpServer.feedPoller = undefined;
        }
      });
    });
  }

  response.status(200).json({ ready: true });
}

export const config = { api: { bodyParser: false } };
