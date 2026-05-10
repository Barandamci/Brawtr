import { Timestamp } from "firebase/firestore";

export type UserRole = "owner" | "admin" | "user";

export interface BrawUser {
  uid: string;
  email: string;
  username: string;
  fullName: string;
  bio: string;
  photoURL: string;
  role: UserRole;
  isBanned: boolean;
  hasBlueTick: boolean;
  isOnline: boolean;
  lastSeen: Timestamp | null;
  createdAt: Timestamp | null;
  pushToken?: string;
}

export interface Chat {
  id: string;
  members: string[];
  isGroup: boolean;
  name?: string;
  photoURL?: string;
  lastMessage: string;
  lastMessageTime: Timestamp | null;
  admins?: string[];
  restrictedMode?: boolean;
  createdBy?: string;
}

export interface Message {
  id: string;
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  senderId: string;
  timestamp: Timestamp | null;
  deleted?: boolean;
}
