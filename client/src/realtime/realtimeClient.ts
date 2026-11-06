export interface ChatMessage {
  id: string;
  text: string;
  userName: string;
  senderId: string;
  sentAt: string;
}

export interface Announcement {
  text: string;
  fromName: string;
  sentAt: string;
}

export interface RealtimeClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  joinRoom(groupName: string, password?: string): void;
  leaveRoom(): void;
  sendMessage(text: string): void;

  onConnect(handler: () => void): () => void;
  onDisconnect(handler: () => void): () => void;
  onSessionRevoked(handler: (message: string) => void): () => void;
  onRoomJoined(handler: (groupName: string) => void): () => void;
  onRoomUsers(handler: (users: string[]) => void): () => void;
  onRoomError(handler: (message: string) => void): () => void;
  onChatMessage(handler: (payload: ChatMessage) => void): () => void;
  onAnnouncement(handler: (payload: Announcement) => void): () => void;
}
