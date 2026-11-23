import { InputState, MatchConfig } from '../types/game';
import { SerializedState } from '../engine/MatchEngine';

export type NetRole = 'host' | 'client';
export type NetTransport = 'websocket' | 'broadcast_channel';

export type NetMessage =
  | { type: 'join_room'; roomCode: string; role: NetRole }
  | { type: 'peer_connected'; roomCode: string }
  | { type: 'start_match'; config: MatchConfig }
  | { type: 'client_input'; input: InputState }
  | { type: 'state_snapshot'; state: SerializedState }
  | { type: 'peer_left' };

export interface MultiplayerCallbacks {
  onStatus: (status: string, connected: boolean, transport: NetTransport) => void;
  onStartMatch: (config: MatchConfig) => void;
  onClientInput: (input: InputState) => void;
  onStateSnapshot: (state: SerializedState) => void;
  onPeerLeft: () => void;
}

/**
 * Dual-transport Online Multiplayer Client:
 * 1. Connects to the real WebSocket Match Server (`ws://localhost:3001` or configured host) for cross-device/LAN online play.
 * 2. Automatically falls back to browser `BroadcastChannel` if the WS server isn't running so two browser tabs can immediately play Online Room PvP with zero setup!
 */
export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private transport: NetTransport = 'broadcast_channel';
  public roomCode = '';
  public role: NetRole = 'host';
  private callbacks: MultiplayerCallbacks;

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(roomCode: string, role: NetRole, wsUrl?: string) {
    this.disconnect();
    this.roomCode = roomCode.trim().toUpperCase();
    this.role = role;

    const targetUrl =
      wsUrl ||
      (window.location.protocol === 'https:'
        ? `wss://${window.location.hostname}:3001`
        : `ws://${window.location.hostname || 'localhost'}:3001`);

    let settled = false;

    try {
      const ws = new WebSocket(targetUrl);
      this.ws = ws;

      const fallbackTimer = window.setTimeout(() => {
        if (!settled) {
          ws.close();
          this.initBroadcastFallback();
        }
      }, 1200);

      ws.onopen = () => {
        settled = true;
        window.clearTimeout(fallbackTimer);
        this.transport = 'websocket';
        this.send({ type: 'join_room', roomCode: this.roomCode, role: this.role });
        this.callbacks.onStatus(
          role === 'host'
            ? `Room ${this.roomCode} live on WebSocket server — waiting for opponent...`
            : `Joined Room ${this.roomCode} via WebSocket server!`,
          role === 'client',
          'websocket'
        );
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as NetMessage;
          this.handleMessage(msg);
        } catch {
          // ignore malformed packet
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(fallbackTimer);
          this.initBroadcastFallback();
        }
      };

      ws.onclose = () => {
        if (settled && this.transport === 'websocket') {
          this.callbacks.onPeerLeft();
        }
      };
    } catch {
      this.initBroadcastFallback();
    }
  }

  private initBroadcastFallback() {
    this.ws = null;
    this.transport = 'broadcast_channel';
    this.bc = new BroadcastChannel(`pes_online_room_${this.roomCode}`);
    this.bc.onmessage = (ev) => {
      this.handleMessage(ev.data as NetMessage);
    };

    if (this.role === 'host') {
      this.callbacks.onStatus(
        `Room ${this.roomCode} ready! Open a 2nd browser tab & join ${this.roomCode} (or run "npm run server" for LAN/Online WS).`,
        false,
        'broadcast_channel'
      );
    } else {
      this.send({ type: 'join_room', roomCode: this.roomCode, role: 'client' });
      this.callbacks.onStatus(
        `Connecting to Room ${this.roomCode}...`,
        false,
        'broadcast_channel'
      );
    }
  }

  private handleMessage(msg: NetMessage) {
    if (msg.type === 'join_room' && this.role === 'host' && msg.role === 'client') {
      this.send({ type: 'peer_connected', roomCode: this.roomCode });
      this.callbacks.onStatus(
        `Opponent joined Room ${this.roomCode}! Ready to Kick Off.`,
        true,
        this.transport
      );
    } else if (msg.type === 'peer_connected') {
      this.callbacks.onStatus(
        `Connected to Room ${this.roomCode}! Waiting for Host to start match...`,
        true,
        this.transport
      );
    } else if (msg.type === 'start_match') {
      this.callbacks.onStartMatch(msg.config);
    } else if (msg.type === 'client_input') {
      this.callbacks.onClientInput(msg.input);
    } else if (msg.type === 'state_snapshot') {
      this.callbacks.onStateSnapshot(msg.state);
    } else if (msg.type === 'peer_left') {
      this.callbacks.onPeerLeft();
    }
  }

  public send(msg: NetMessage) {
    if (this.transport === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (this.transport === 'broadcast_channel' && this.bc) {
      this.bc.postMessage(msg);
    }
  }

  public disconnect() {
    if (this.ws) {
      try {
        this.send({ type: 'peer_left' });
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    if (this.bc) {
      try {
        this.send({ type: 'peer_left' });
        this.bc.close();
      } catch {
        // ignore
      }
      this.bc = null;
    }
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

