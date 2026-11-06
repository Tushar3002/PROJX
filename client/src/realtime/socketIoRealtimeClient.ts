import { io, type Socket } from "socket.io-client";

import { getStoredToken } from "../api";
import type { Announcement, ChatMessage, RealtimeClient } from "./realtimeClient";

// A list of handlers that can be added to and removed from, and called together.
class Listeners<Args extends unknown[]> {
  private readonly handlers = new Set<(...args: Args) => void>();

  add(handler: (...args: Args) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(...args: Args): void {
    for (const handler of this.handlers) {
      handler(...args);
    }
  }
}

export class SocketIoRealtimeClient implements RealtimeClient {
  private socket: Socket | null = null;
  // Set only after the server confirms the join, so a failed join is never rejoined on reconnect.
  private currentGroupName: string | null = null;

  private readonly connectListeners = new Listeners<[]>();
  private readonly disconnectListeners = new Listeners<[]>();
  private readonly sessionRevokedListeners = new Listeners<[string]>();
  private readonly roomJoinedListeners = new Listeners<[string]>();
  private readonly roomUsersListeners = new Listeners<[string[]]>();
  private readonly roomErrorListeners = new Listeners<[string]>();
  private readonly chatMessageListeners = new Listeners<[ChatMessage]>();
  private readonly announcementListeners = new Listeners<[Announcement]>();

  async connect(): Promise<void> {
    if (this.socket) {
      return;
    }

    // The server only accepts connections that carry a valid login token.
    this.socket = io(import.meta.env.VITE_API_URL, {
      auth: { token: getStoredToken() },
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      // After a reconnect the server has forgotten the room. Membership lets the user back in without the password.
      if (this.currentGroupName) {
        this.socket?.emit("join-room", { roomName: this.currentGroupName });
      }

      this.connectListeners.emit();
    });

    this.socket.on("disconnect", () => {
      this.disconnectListeners.emit();
    });

    this.socket.on("session:revoked", ({ message }: { message: string }) => {
      this.sessionRevokedListeners.emit(message);
    });

    this.socket.on("connect_error", (error: Error) => {
      const message = error.message === "Unauthorized"
        ? "Your session has expired. Please log in again."
        : "Could not connect to the chat server.";
      this.roomErrorListeners.emit(message);
    });

    this.socket.on("room:joined", ({ name }: { name: string }) => {
      this.currentGroupName = name;
      this.roomJoinedListeners.emit(name);
    });

    this.socket.on("room:users", (users: string[]) => {
      this.roomUsersListeners.emit(users);
    });

    this.socket.on("room-error", ({ message }: { message: string }) => {
      this.roomErrorListeners.emit(message);
    });

    this.socket.on("chat:message", (payload: ChatMessage) => {
      this.chatMessageListeners.emit(payload);
    });

    this.socket.on("announcement", (payload: Announcement) => {
      this.announcementListeners.emit(payload);
    });
  }

  async disconnect(): Promise<void> {
    this.socket?.disconnect();
    this.socket = null;
    this.currentGroupName = null;
  }

  joinRoom(groupName: string, password?: string): void {
    this.socket?.emit("join-room", { roomName: groupName, password });
  }

  leaveRoom(): void {
    this.currentGroupName = null;
    this.socket?.emit("leave-room");
  }

  sendMessage(text: string): void {
    if (!this.currentGroupName) {
      return;
    }

    this.socket?.emit("chat:message", { text });
  }

  onConnect(handler: () => void): () => void {
    return this.connectListeners.add(handler);
  }

  onDisconnect(handler: () => void): () => void {
    return this.disconnectListeners.add(handler);
  }

  onSessionRevoked(handler: (message: string) => void): () => void {
    return this.sessionRevokedListeners.add(handler);
  }

  onRoomJoined(handler: (groupName: string) => void): () => void {
    return this.roomJoinedListeners.add(handler);
  }

  onRoomUsers(handler: (users: string[]) => void): () => void {
    return this.roomUsersListeners.add(handler);
  }

  onRoomError(handler: (message: string) => void): () => void {
    return this.roomErrorListeners.add(handler);
  }

  onChatMessage(handler: (payload: ChatMessage) => void): () => void {
    return this.chatMessageListeners.add(handler);
  }

  onAnnouncement(handler: (payload: Announcement) => void): () => void {
    return this.announcementListeners.add(handler);
  }
}
