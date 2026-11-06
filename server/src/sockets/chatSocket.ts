import type { Server, Socket } from "socket.io";
import type { Model } from "sequelize";

import { verifyToken } from "../services/authService.js";
import { addMember, canJoinGroup, findGroupByName, listRecentMessages, saveMessage } from "../services/groupService.js";
import { findUserById, isAccessChangedSince, toAuthUser, type AuthUser } from "../services/userService.js";

const MAX_MESSAGE_LENGTH = 1000;

// Set when the socket server starts, so the admin routes can reach connected users.
let serverIo: Server | null = null;

// Per-connection state. Set on connect, and groupId is set while the user is in a group.
interface SocketData {
  user: AuthUser;
  groupId?: string;
}

function roomKey(groupId: string): string {
  return `group:${groupId}`;
}

function toChatMessage(message: Model, senderName: string) {
  return {
    id: message.get("id"),
    text: message.get("content"),
    userName: senderName,
    senderId: message.get("senderId"),
    sentAt: new Date(message.get("createdAt") as Date).toISOString(),
  };
}

// History rows come with the sender loaded, so read the name from there.
function historyMessageToChat(message: Model) {
  const sender = message.get("User") as { name: string } | null | undefined;
  return toChatMessage(message, sender?.name ?? "Unknown");
}

// Messages from the server itself, such as "X joined the room".
function systemMessage(text: string) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    userName: "System",
    senderId: "system",
    sentAt: new Date().toISOString(),
  };
}

async function emitRoomUsers(io: Server, groupId: string): Promise<void> {
  const sockets = await io.in(roomKey(groupId)).fetchSockets();
  const names = sockets.map((member) => (member.data as SocketData).user.name).sort();

  io.to(roomKey(groupId)).emit("room:users", names);
}

async function leaveCurrentGroup(io: Server, socket: Socket, notifySelf: boolean): Promise<void> {
  const data = socket.data as SocketData;

  if (!data.groupId) {
    return;
  }

  const groupId = data.groupId;
  delete data.groupId;
  socket.leave(roomKey(groupId));

  io.to(roomKey(groupId)).emit("chat:message", systemMessage(`${data.user.name} left the room`));
  await emitRoomUsers(io, groupId);

  if (notifySelf) {
    socket.emit("room:left");
  }
}

// Runs an async event handler and reports failures to the client instead of crashing the process.
function onEvent<T>(socket: Socket, event: string, handler: (payload: T) => Promise<void>): void {
  socket.on(event, (payload: T) => {
    handler(payload).catch((error) => {
      console.error(`Error handling ${event}:`, error);
      socket.emit("room-error", { message: "Something went wrong. Please try again." });
    });
  });
}

export function registerChatSocket(io: Server): void {
  serverIo = io;

  // Only logged-in users can connect. The client sends its login token in the handshake.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      const payload = verifyToken(token);
      const user = await findUserById(payload.sub);

      if (!user || isAccessChangedSince(user, payload)) {
        next(new Error("Unauthorized"));
        return;
      }

      (socket.data as SocketData).user = toAuthUser(user);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket.data as SocketData).user;

    onEvent<{ roomName?: string; password?: string }>(socket, "join-room", async (payload) => {
      const roomName = payload?.roomName?.trim();

      if (!roomName) {
        socket.emit("room-error", { message: "Group name is required." });
        return;
      }

      const group = await findGroupByName(roomName);

      if (!group) {
        socket.emit("room-error", { message: `Group "${roomName}" does not exist.` });
        return;
      }

      if (!(await canJoinGroup(group, user.id, payload.password))) {
        socket.emit("room-error", { message: payload.password ? "Wrong group password." : "This group needs a password." });
        return;
      }

      await leaveCurrentGroup(io, socket, false);

      const groupId = group.get("id") as string;
      await addMember(groupId, user.id);
      socket.join(roomKey(groupId));
      (socket.data as SocketData).groupId = groupId;
      socket.emit("room:joined", { name: group.get("name") });

      // Send the recent history to the person who joined only.
      for (const message of await listRecentMessages(groupId)) {
        socket.emit("chat:message", historyMessageToChat(message));
      }

      io.to(roomKey(groupId)).emit("chat:message", systemMessage(`${user.name} joined the room`));
      await emitRoomUsers(io, groupId);
    });

    onEvent<unknown>(socket, "leave-room", async () => {
      await leaveCurrentGroup(io, socket, true);
    });

    onEvent<{ text?: string }>(socket, "chat:message", async (payload) => {
      const groupId = (socket.data as SocketData).groupId;
      const text = payload?.text?.trim();

      // Ignore messages from people who are not in a group.
      if (!groupId || !text) {
        return;
      }

      if (!user.canSendMessage) {
        socket.emit("room-error", { message: "You are not allowed to send messages." });
        return;
      }

      if (text.length > MAX_MESSAGE_LENGTH) {
        socket.emit("room-error", { message: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters.` });
        return;
      }

      const saved = await saveMessage(groupId, user.id, text);

      io.to(roomKey(groupId)).emit("chat:message", toChatMessage(saved, user.name));
    });

    socket.on("disconnect", () => {
      leaveCurrentGroup(io, socket, false).catch((error) => {
        console.error("Error leaving group on disconnect:", error);
      });
    });
  });
}

// User ids with at least one open connection.
export async function getOnlineUserIds(): Promise<Set<string>> {
  if (!serverIo) {
    return new Set();
  }

  const sockets = await serverIo.fetchSockets();
  return new Set(sockets.map((member) => (member.data as SocketData).user.id));
}

// Closes every connection that belongs to the user. The client is told why, so it can show a message.
export async function disconnectUser(userId: string, reason = "Your session was closed by an admin."): Promise<void> {
  if (!serverIo) {
    return;
  }

  const sockets = await serverIo.fetchSockets();

  for (const member of sockets) {
    if ((member.data as SocketData).user.id === userId) {
      member.emit("session:revoked", { message: reason });
      member.disconnect(true);
    }
  }
}

export async function disconnectUsersByRoleId(roleId: string, reason = "Your role changed. Please log in again."): Promise<void> {
  if (!serverIo) {
    return;
  }

  const sockets = await serverIo.fetchSockets();

  for (const member of sockets) {
    if ((member.data as SocketData).user.roleId === roleId) {
      member.emit("session:revoked", { message: reason });
      member.disconnect(true);
    }
  }
}

export function broadcastAnnouncement(text: string, fromName: string): void {
  serverIo?.emit("announcement", { text, fromName, sentAt: new Date().toISOString() });
}
