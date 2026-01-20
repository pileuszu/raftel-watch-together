// WebSocket Server for Laftel Watch Together
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Room structure: { participants: Map<ws, { isHost, joinedAt }>, hostWs: ws }
const rooms = new Map();

// Client to room mapping for quick lookup
const clientRooms = new Map(); // ws -> roomId

// HTTP server for health checks
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'raftel-watch-together',
      rooms: rooms.size,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

// Start server
server.listen(PORT, HOST, () => {
  console.log(`[Server] Running on ${HOST}:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Error] Port ${PORT} is already in use.`);
    console.error(`[Error] Run: netstat -ano | findstr :${PORT}`);
    console.error(`[Error] Then: taskkill /PID <PID> /F`);
  } else {
    console.error('[Error] Server error:', err);
  }
  process.exit(1);
});

// Client ID tracking
const wsClientIds = new Map(); // ws -> clientId

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  // Client ID will be set when client sends first message with clientId
  let clientId = null;

  console.log(`[Connect] New connection from ${req.socket.remoteAddress}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Extract clientId from message if provided
      if (data.clientId && !clientId) {
        clientId = data.clientId;
        wsClientIds.set(ws, clientId);
        console.log(`[Identify] Client identified as ${clientId}`);
      } else if (!clientId) {
        // Generate one if client didn't provide
        clientId = generateClientId();
        wsClientIds.set(ws, clientId);
        console.log(`[Identify] Generated ID for client: ${clientId}`);
      }

      handleMessage(ws, clientId, data);
    } catch (error) {
      console.error(`[Error] Message parse error:`, error.message);
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    const id = wsClientIds.get(ws) || 'unknown';
    wsClientIds.delete(ws);
    handleDisconnect(ws, id);
  });

  ws.on('error', (error) => {
    const id = wsClientIds.get(ws) || 'unknown';
    console.error(`[Error] WebSocket error for ${id}:`, error.message);
  });
});

// Message handler
function handleMessage(ws, clientId, data) {
  const { type, roomId } = data;

  switch (type) {
    case 'create_room':
      handleCreateRoom(ws, clientId, data);
      break;

    case 'join_room':
      handleJoinRoom(ws, clientId, data);
      break;

    case 'leave_room':
      handleLeaveRoom(ws, clientId);
      break;

    case 'sync_request':
      handleSyncRequest(ws, clientId);
      break;

    case 'sync_response':
      handleSyncResponse(ws, data);
      break;

    case 'ping':
      send(ws, { type: 'pong' });
      break;

    default:
      // Broadcast other messages to room participants
      broadcastToRoom(ws, data);
      break;
  }
}

// Broadcast member list to room
function broadcastRoomMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const members = Array.from(room.participants.values()).map(p => ({
    clientId: p.clientId,
    isHost: p.isHost
  }));

  broadcastToRoomById(roomId, {
    type: 'room_members',
    members
  });
}

// Create a new room (host only)
function handleCreateRoom(ws, clientId, data) {
  const { roomId } = data;

  if (!roomId) {
    sendError(ws, 'Room ID is required');
    return;
  }

  // Leave current room if in one
  leaveCurrentRoom(ws, clientId);

  // Check if room already exists
  if (rooms.has(roomId)) {
    sendError(ws, 'Room already exists');
    return;
  }

  // Create new room with this client as host
  const room = {
    participants: new Map(),
    hostWs: ws,
    createdAt: Date.now()
  };
  room.participants.set(ws, { isHost: true, joinedAt: Date.now(), clientId });

  rooms.set(roomId, room);
  clientRooms.set(ws, roomId);

  console.log(`[Room] Created: ${roomId} by ${clientId}`);

  // Send confirmation
  send(ws, {
    type: 'room_created',
    roomId,
    isHost: true,
    participants: 1
  });

  // Broadcast initial member list (just host)
  broadcastRoomMembers(roomId);
}

// Join an existing room
function handleJoinRoom(ws, clientId, data) {
  const { roomId } = data;

  if (!roomId) {
    sendError(ws, 'Room ID is required');
    return;
  }

  // Check if already in this room with THIS socket
  const currentRoomId = clientRooms.get(ws);
  if (currentRoomId === roomId) {
    const room = rooms.get(roomId);
    if (room) {
      const participant = room.participants.get(ws);
      send(ws, {
        type: 'room_joined',
        roomId,
        isHost: participant?.isHost || false,
        participants: room.participants.size
      });
      broadcastRoomMembers(roomId);
    }
    return;
  }

  // Leave current room if in a different one
  leaveCurrentRoom(ws, clientId);

  // Check if room exists
  if (!rooms.has(roomId)) {
    sendError(ws, 'Room not found. Ask the host to create the room first.');
    return;
  }

  const room = rooms.get(roomId);

  // Deduplicate: If this clientId is already in the room with a different socket, remove the old one
  const wasHost = deduplicateParticipant(roomId, clientId, ws);

  // Add to room as participant (inherit host status if it was a takeover)
  room.participants.set(ws, { isHost: wasHost, joinedAt: Date.now(), clientId });
  clientRooms.set(ws, roomId);

  if (wasHost) {
    room.hostWs = ws;
    console.log(`[Room] ${clientId} took over host session in ${roomId}`);
  } else {
    console.log(`[Room] ${clientId} joined ${roomId} (${room.participants.size} participants)`);
  }

  // Send confirmation to new participant
  send(ws, {
    type: 'room_joined',
    roomId,
    isHost: wasHost,
    participants: room.participants.size
  });

  // Notify others
  broadcastToRoom(ws, {
    type: 'participant_joined',
    participants: room.participants.size
  });

  // Broadcast updated member list
  broadcastRoomMembers(roomId);

  // Request sync from host
  if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
    send(room.hostWs, {
      type: 'sync_request',
      from: clientId
    });
  }
}

// Handle sync request from participant
function handleSyncRequest(ws, clientId) {
  const roomId = clientRooms.get(ws);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room || !room.hostWs) return;

  // Forward sync request to host
  send(room.hostWs, {
    type: 'sync_request',
    from: clientId
  });
}

// Leave current room
function handleLeaveRoom(ws, clientId) {
  leaveCurrentRoom(ws, clientId);
  send(ws, { type: 'room_left' });
}

// Handle sync response from host
function handleSyncResponse(ws, data) {
  const roomId = clientRooms.get(ws);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  // Only host can send sync response
  const participant = room.participants.get(ws);
  if (!participant?.isHost) return;

  // Broadcast sync to all non-host participants
  if (data.isPeriodic) {
    console.log(`[Sync] Periodic sync broadcast in room ${roomId}`);
  }

  room.participants.forEach((info, client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      send(client, {
        type: 'sync',
        time: data.time,
        playing: data.playing,
        volume: data.volume,
        url: data.url
      });
    }
  });
}

// Broadcast message to room (excluding sender)
function broadcastToRoom(ws, data) {
  const roomId = clientRooms.get(ws);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const message = JSON.stringify(data);
  room.participants.forEach((info, client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Leave current room helper
function leaveCurrentRoom(ws, clientId) {
  const roomId = clientRooms.get(ws);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) {
    clientRooms.delete(ws);
    return;
  }

  const wasHost = room.participants.get(ws)?.isHost || false;
  room.participants.delete(ws);
  clientRooms.delete(ws);

  console.log(`[Room] ${clientId} left ${roomId} (${room.participants.size} remaining)`);

  // Delete room if empty
  if (room.participants.size === 0) {
    rooms.delete(roomId);
    console.log(`[Room] Deleted: ${roomId} (empty)`);
    return;
  }

  // Notify remaining participants
  broadcastToRoomById(roomId, {
    type: 'participant_left',
    participants: room.participants.size
  });

  // Broadcast updated member list
  broadcastRoomMembers(roomId);

  // Assign new host if host left
  if (wasHost) {
    const [newHostWs, newHostInfo] = room.participants.entries().next().value;
    newHostInfo.isHost = true;
    room.hostWs = newHostWs;

    console.log(`[Room] New host assigned in ${roomId}: ${newHostInfo.clientId}`);

    send(newHostWs, {
      type: 'host_assigned',
      isHost: true
    });

    // Broadcast updated member list (host changed)
    broadcastRoomMembers(roomId);
  }
}

// Handle client disconnect
function handleDisconnect(ws, clientId) {
  console.log(`[Disconnect] Client ${clientId}`);
  leaveCurrentRoom(ws, clientId);
}

// Broadcast to room by ID
function broadcastToRoomById(roomId, data) {
  const room = rooms.get(roomId);
  if (!room) return;

  const message = JSON.stringify(data);
  room.participants.forEach((info, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Send message to client
function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Send error to client
function sendError(ws, message) {
  send(ws, { type: 'error', message });
}

// Generate unique client ID
function generateClientId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Remove any existing participant with the same clientId from the room.
 * This handles background reconnections/refreshes where the old socket hasn't closed yet.
 * Returns true if the session being replaced was the host.
 */
function deduplicateParticipant(roomId, clientId, newWs) {
  const room = rooms.get(roomId);
  if (!room || !clientId) return false;

  let wasHost = false;
  let oldWs = null;

  for (const [ws, info] of room.participants.entries()) {
    if (info.clientId === clientId && ws !== newWs) {
      oldWs = ws;
      wasHost = info.isHost;
      break;
    }
  }

  if (oldWs) {
    console.log(`[Deduplicate] Removing stale session for ${clientId} in ${roomId} (wasHost: ${wasHost})`);
    room.participants.delete(oldWs);
    clientRooms.delete(oldWs);

    // Close the old socket if it's still open to prevent confusion
    if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
      try {
        // Remove close listener to prevent handleDisconnect from firing
        oldWs.removeAllListeners('close');
        oldWs.close(1000, 'Replaced by new session');
      } catch (e) {
        // Ignore errors during close
      }
    }
  }

  return wasHost;
}

// Graceful shutdown
function shutdown() {
  console.log('\n[Server] Shutting down...');

  // Notify all clients
  wss.clients.forEach((ws) => {
    send(ws, { type: 'server_shutdown' });
    ws.close(1001, 'Server shutting down');
  });

  // Close WebSocket server
  wss.close(() => {
    console.log('[Server] WebSocket server closed');

    // Close HTTP server
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });

  // Force exit after 3 seconds
  setTimeout(() => {
    console.error('[Server] Forcing exit...');
    process.exit(1);
  }, 3000);
}

// Signal handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// For Windows: handle Ctrl+C properly
if (process.platform === 'win32') {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.on('SIGINT', () => process.emit('SIGINT'));
  rl.on('close', () => process.emit('SIGINT'));
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[Error] Uncaught Exception:', err);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('[Error] Unhandled Rejection:', reason);
});
