"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

export function RealtimeUpdates() {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let socket: ReturnType<typeof io> | undefined;
    let retryTimer: number | undefined;

    const connect = async () => {
      try {
        const response = await fetch("/api/socket.io", { cache: "no-store" });
        if (disposed) return;
        if (!response.ok) {
          retryTimer = window.setTimeout(connect, 8_000);
          return;
        }
        socket = io({ path: "/api/socket.io", transports: ["websocket"], reconnection: true, reconnectionDelayMax: 5_000 });
        socket.on("feed:changed", () => router.refresh());
        window.addEventListener("ziddu:feed-mutation", invalidateFeed);
      } catch {
        if (!disposed) retryTimer = window.setTimeout(connect, 8_000);
      }
    };

    function invalidateFeed() {
      socket?.emit("feed:invalidate");
    }

    void connect();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.removeEventListener("ziddu:feed-mutation", invalidateFeed);
      socket?.disconnect();
    };
  }, [router]);

  return null;
}
