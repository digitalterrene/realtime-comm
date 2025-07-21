const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: ["http://localhost:8080", "http://localhost:3000"]
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:8080", "http://localhost:3000"],
    methods: ['GET', 'POST']
  }
});

// Store connected users
const users = new Map(); // socket.id -> { userId, role }
const adminSockets = new Set();

// Middleware to validate user connections
io.use((socket, next) => {
  const { userId, role } = socket.handshake.auth;
  if (userId && (role === 'admin' || role === 'user')) {
    return next();
  }
  return next(new Error('Authentication error'));
});

io.on('connection', (socket) => {
  console.log("New connection:", socket.id);
  const { userId, role } = socket.handshake.auth;

  // Store user information
  users.set(socket.id, { userId, role });
  
  if (role === 'admin') {
    adminSockets.add(socket.id);
    console.log(`Admin connected: ${userId}`);
    // Send list of connected users to admin
    const userList = Array.from(users.values())
      .filter(user => user.role === 'user')
      .map(user => user.userId);
    socket.emit('user-list', userList);
  } else {
    console.log(`User connected: ${userId}`);
    // Notify all admins about new user
    adminSockets.forEach(adminId => {
      io.to(adminId).emit('user-connected', userId);
    });
  }

  // Handle public messages
  socket.on('send-message', (message) => {
    const userData = users.get(socket.id);
    if (!userData) return;

    const messageData = {
      text: message.text,
      userId: userData.userId,
      timestamp: new Date().toISOString(),
      private: false
    };

    if (userData.role === 'user') {
      // Forward user messages to all admins
      adminSockets.forEach(adminId => {
        io.to(adminId).emit('receive-message', messageData);
      });
    } else {
      // Admin broadcasting to all users
      io.emit('receive-message', {
        ...messageData,
        from: 'admin'
      });
    }
  });

  // Handle private messages
  socket.on('send-private-message', ({ targetUserId, text }) => {
    const senderData = users.get(socket.id);
    if (!senderData || senderData.role !== 'admin') return;

    const messageData = {
      text,
      userId: 'admin',
      targetUserId,
      timestamp: new Date().toISOString(),
      private: true
    };

    // Find the target user's socket
    for (const [socketId, userData] of users) {
      if (userData.userId === targetUserId && userData.role === 'user') {
        io.to(socketId).emit('receive-message', messageData);
        // Also send to admin for their records
        socket.emit('receive-message', messageData);
        break;
      }
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    const userData = users.get(socket.id);
    if (userData) {
      if (userData.role === 'admin') {
        adminSockets.delete(socket.id);
      } else {
        // Notify admins about user disconnection
        adminSockets.forEach(adminId => {
          io.to(adminId).emit('user-disconnected', userData.userId);
        });
      }
      users.delete(socket.id);
      console.log(`User disconnected: ${userData.userId}`);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    users: users.size,
    admins: adminSockets.size
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});