// Who is connected right now (staff). Kept in this process's memory: one person can have several
// tabs open and counts as online until the last one disconnects.
import type { PresenceProfile } from "../../modules/platform/repositories/platform.repository";

interface Connection {
  connectedAt: Date;
  lastActiveAt: Date;
  device: string;
}

interface Entry {
  profile: PresenceProfile;
  connections: Map<string, Connection>;
}

export interface OnlineUserDTO extends PresenceProfile {
  onlineSince: string;
  lastActiveAt: string;
  device: string;
  connections: number;
}

export function describeDevice(userAgent: string | undefined | null): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

class PresenceStore {
  private readonly users = new Map<string, Entry>();

  /** Returns true when this is the user's first open connection. */
  connect(socketId: string, profile: PresenceProfile, device: string): boolean {
    const now = new Date();
    const existing = this.users.get(profile.userId);
    const entry = existing ?? { profile, connections: new Map<string, Connection>() };
    entry.profile = profile;
    entry.connections.set(socketId, { connectedAt: now, lastActiveAt: now, device });
    this.users.set(profile.userId, entry);
    return !existing;
  }

  /** Returns true when that was the user's last connection. */
  disconnect(userId: string, socketId: string): boolean {
    const entry = this.users.get(userId);
    if (!entry) return false;
    entry.connections.delete(socketId);
    if (entry.connections.size > 0) return false;
    this.users.delete(userId);
    return true;
  }

  activity(userId: string, socketId: string): void {
    const conn = this.users.get(userId)?.connections.get(socketId);
    if (conn) conn.lastActiveAt = new Date();
  }

  get(userId: string): OnlineUserDTO | null {
    const entry = this.users.get(userId);
    return entry ? this.toDTO(entry) : null;
  }

  list(): OnlineUserDTO[] {
    return [...this.users.values()].map((e) => this.toDTO(e)).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  private toDTO(entry: Entry): OnlineUserDTO {
    const conns = [...entry.connections.values()];
    const oldest = conns.reduce((a, b) => (a.connectedAt <= b.connectedAt ? a : b));
    const latest = conns.reduce((a, b) => (a.lastActiveAt >= b.lastActiveAt ? a : b));
    return { ...entry.profile, onlineSince: oldest.connectedAt.toISOString(), lastActiveAt: latest.lastActiveAt.toISOString(), device: latest.device, connections: conns.length };
  }
}

export const presence = new PresenceStore();
