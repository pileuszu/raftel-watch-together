// WebSocket Server
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Room management
const rooms = new Map(); // roomId -> Set of WebSocket connections

// HTTP server for health checks
const server = http.createServer((req, res) => {
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

// WebSocket server
const wss = new WebSocket.Server({ server });

// Start server
server.listen(PORT, HOST, () => {
  console.log(`WebSocket server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Please stop the process using this port or use a different port.`);
    console.error(`To find the process: netstat -ano | findstr :${PORT}`);
    console.error(`To kill the process: taskkill /PID <PID> /F`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

wss.on('connection', (ws, req) => {
  console.log('New client connected:', req.socket.remoteAddress);
  
  let currentRoomId = null;
  let isHost = false;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'join') {
        const roomId = data.roomId;
        
        if (!roomId) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Room ID is required'
          }));
          return;
        }

        // If already in the same room, ignore duplicate join
        if (currentRoomId === roomId && rooms.has(roomId) && rooms.get(roomId).has(ws)) {
          // Already in this room, just send current room info
          ws.send(JSON.stringify({
            type: 'room_info',
            roomId: roomId,
            isHost: isHost,
            participants: rooms.get(roomId).size
          }));
          return;
        }

        // Remove from existing room (only if joining different room)
        if (currentRoomId && currentRoomId !== roomId && rooms.has(currentRoomId)) {
          rooms.get(currentRoomId).delete(ws);
          if (rooms.get(currentRoomId).size === 0) {
            rooms.delete(currentRoomId);
            console.log(`Room ${currentRoomId} deleted (client moved to different room)`);
          } else {
            // Notify other participants in old room
            broadcastToRoom(currentRoomId, {
              type: 'participant_left',
              participants: rooms.get(currentRoomId).size
            }, ws);
          }
        }

        // Add to new room
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
          isHost = true; // First participant is host
          console.log(`Room ${roomId} created`);
        } else {
          // Check if already in this room (shouldn't happen but safety check)
          if (rooms.get(roomId).has(ws)) {
            isHost = false; // Keep existing status
          } else {
            isHost = false; // New participant
          }
        }

        // Add to room (Set.add is idempotent, but we already checked above)
        rooms.get(roomId).add(ws);
        currentRoomId = roomId;

        // Send room info
        ws.send(JSON.stringify({
          type: 'room_info',
          roomId: roomId,
          isHost: isHost,
          participants: rooms.get(roomId).size
        }));

        // Notify other participants
        broadcastToRoom(roomId, {
          type: 'participant_joined',
          participants: rooms.get(roomId).size
        }, ws);

        console.log(`Client joined room ${roomId} (Host: ${isHost}, Participants: ${rooms.get(roomId).size})`);

        // Request sync if not host
        if (!isHost) {
          const host = Array.from(rooms.get(roomId)).find(client => {
            return client !== ws;
          });
          
          if (host && host.readyState === WebSocket.OPEN) {
            host.send(JSON.stringify({
              type: 'sync_request',
              from: 'new_participant'
            }));
          }
        }
      } else if (data.type === 'sync_response') {
        // Broadcast sync response to all participants except host
        broadcastToRoom(currentRoomId, {
          type: 'sync',
          time: data.time,
          playing: data.playing,
          volume: data.volume
        }, ws);
      } else if (currentRoomId && rooms.has(currentRoomId)) {
        // Broadcast other messages to all participants in room
        broadcastToRoom(currentRoomId, data, ws);
      }
    } catch (error) {
      console.error('Message processing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing message'
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    
    if (currentRoomId && rooms.has(currentRoomId)) {
      rooms.get(currentRoomId).delete(ws);
      
      // Delete room if empty
      if (rooms.get(currentRoomId).size === 0) {
        rooms.delete(currentRoomId);
        console.log(`Room ${currentRoomId} deleted`);
      } else {
        // Notify other participants
        broadcastToRoom(currentRoomId, {
          type: 'participant_left',
          participants: rooms.get(currentRoomId).size
        }, ws);
        
        // Assign new host if host left
        if (isHost && rooms.get(currentRoomId).size > 0) {
          const newHost = Array.from(rooms.get(currentRoomId))[0];
          newHost.send(JSON.stringify({
            type: 'room_info',
            isHost: true
          }));
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast to room (excluding sender)
function broadcastToRoom(roomId, data, excludeWs = null) {
  if (!rooms.has(roomId)) return;

  const message = JSON.stringify(data);
  rooms.get(roomId).forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  wss.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
