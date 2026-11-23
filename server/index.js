import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 3001);
const wss = new WebSocketServer({ port: PORT });

/** @type {Map<string, Set<WebSocket>>} */
const rooms = new Map();

console.log(`[PES Online Server] Listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join_room' && typeof msg.roomCode === 'string') {
      const code = msg.roomCode.toUpperCase();
      currentRoom = code;
      if (!rooms.has(code)) rooms.set(code, new Set());
      const peers = rooms.get(code);
      peers.add(ws);

      // Notify existing peers in room
      for (const peer of peers) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(msg));
          ws.send(JSON.stringify({ type: 'peer_connected', roomCode: code }));
        }
      }
      return;
    }

    if (currentRoom && rooms.has(currentRoom)) {
      const peers = rooms.get(currentRoom);
      for (const peer of peers) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(raw.toString());
        }
      }
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const peers = rooms.get(currentRoom);
      peers.delete(ws);
      for (const peer of peers) {
        if (peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify({ type: 'peer_left' }));
        }
      }
      if (peers.size === 0) rooms.delete(currentRoom);
    }
  });
});

