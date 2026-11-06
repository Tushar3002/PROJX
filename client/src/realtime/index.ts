import { SocketIoRealtimeClient } from "./socketIoRealtimeClient";

import type { RealtimeClient } from "./realtimeClient";

export function getRealtimeClient(): RealtimeClient {
  return new SocketIoRealtimeClient();
}

export type { Announcement, ChatMessage, RealtimeClient } from "./realtimeClient";
