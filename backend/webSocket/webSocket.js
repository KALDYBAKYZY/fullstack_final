const { WebSocketServer, WebSocket } = require('ws');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const Message = require('../models/Message');
const StudyRoom = require('../models/StudyRoom');

const roomClients = new Map();
const connectedUsers = new Map();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {

    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'No token provided');
      return;
    }

    let user;
    try {
      const decoded = verifyToken(token);
      user = await User.findById(decoded.id).select('username avatar _id');
      if (!user) {
        ws.close(1008, 'User not found');
        return;
      }
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    const userId = user._id.toString();
    connectedUsers.set(userId, {
      ws,
      username: user.username,
      avatar: user.avatar,
      rooms: new Set(),
    });
    await User.findByIdAndUpdate(userId, { isOnline: true });
    broadcastOnlineUsers();

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleMessage(ws, userId, user, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', async () => {
      const userConn = connectedUsers.get(userId);
      if (userConn) {
        for (const roomId of userConn.rooms) {
          const clients = roomClients.get(roomId);
          if (clients) {
            clients.delete(userId);
            if (clients.size === 0) roomClients.delete(roomId);
            else {
              broadcastToRoom(roomId, {
                type: 'user_left_room',
                roomId,
                userId,
                username: user.username,
                onlineInRoom: Array.from(clients.values()).map((c) => ({
                  userId: c.userId,
                  username: c.username,
                  avatar: c.avatar,
                })),
              });
            }
          }
        }
        connectedUsers.delete(userId);
      }

      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
      broadcastOnlineUsers();
    });

    ws.send(
      JSON.stringify({
        type: 'connected',
        message: 'Connected to StudySpace',
        userId,
      })
    );
  });

  async function handleMessage(ws, userId, user, msg) {
    const { type } = msg;

    switch (type) {
      case 'join_room': {
        const { roomId } = msg;

        // Verify user is a member
        const room = await StudyRoom.findById(roomId);
        if (!room) return;

        const isMember =
          room.owner.toString() === userId ||
          room.members.some((m) => m.toString() === userId);
        if (!isMember) return;

        if (!roomClients.has(roomId)) roomClients.set(roomId, new Map());

        roomClients.get(roomId).set(userId, {
          ws,
          userId,
          username: user.username,
          avatar: user.avatar,
        });

        connectedUsers.get(userId)?.rooms.add(roomId);

        const onlineInRoom = Array.from(roomClients.get(roomId).values()).map((c) => ({
          userId: c.userId,
          username: c.username,
          avatar: c.avatar,
        }));

        broadcastToRoom(roomId, {
          type: 'user_joined_room',
          roomId,
          userId,
          username: user.username,
          avatar: user.avatar,
          onlineInRoom,
        });

        ws.send(JSON.stringify({ type: 'room_joined', roomId, onlineInRoom }));
        break;
      }

      case 'leave_room': {
        const { roomId } = msg;
        const clients = roomClients.get(roomId);
        if (clients) {
          clients.delete(userId);
          if (clients.size === 0) roomClients.delete(roomId);
          connectedUsers.get(userId)?.rooms.delete(roomId);

          broadcastToRoom(roomId, {
            type: 'user_left_room',
            roomId,
            userId,
            username: user.username,
          });
        }
        break;
      }

      case 'send_message': {
        const { roomId, content, replyTo } = msg;

        if (!content || !content.trim()) return;

        const room = await StudyRoom.findById(roomId);
        if (!room) return;
        const isMember =
          room.owner.toString() === userId ||
          room.members.some((m) => m.toString() === userId);
        if (!isMember) return;

        const message = await Message.create({
          content: content.trim(),
          type: 'text',
          studyRoom: roomId,
          sender: userId,
          replyTo: replyTo || null,
        });

        await message.populate('sender', 'username avatar');

        // Broadcast to room
        broadcastToRoom(roomId, {
          type: 'new_message',
          roomId,
          message: {
            _id: message._id,
            content: message.content,
            type: message.type,
            sender: message.sender,
            studyRoom: roomId,
            createdAt: message.createdAt,
            replyTo: message.replyTo,
          },
        });
        break;
      }

      case 'typing': {
        const { roomId, isTyping } = msg;
        broadcastToRoom(
          roomId,
          {
            type: 'user_typing',
            roomId,
            userId,
            username: user.username,
            isTyping,
          },
          userId // exclude sender
        );
        break;
      }

      case 'note_update': {
        // Live note updates - broadcast to room
        const { roomId, noteId, content, title } = msg;
        broadcastToRoom(
          roomId,
          {
            type: 'note_updated',
            roomId,
            noteId,
            content,
            title,
            editedBy: { userId, username: user.username },
          },
          userId
        );
        break;
      }

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
    }
  }

  function broadcastToRoom(roomId, data, excludeUserId = null) {
    const clients = roomClients.get(roomId);
    if (!clients) return;

    const payload = JSON.stringify(data);
    for (const [uid, client] of clients.entries()) {
      if (excludeUserId && uid === excludeUserId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  function broadcastOnlineUsers() {
    const onlineUsers = Array.from(connectedUsers.entries()).map(([uid, u]) => ({
      userId: uid,
      username: u.username,
      avatar: u.avatar,
    }));

    const payload = JSON.stringify({ type: 'online_users', users: onlineUsers });

    for (const { ws } of connectedUsers.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  return wss;
}

module.exports = { setupWebSocket };