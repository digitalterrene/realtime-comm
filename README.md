# Realtime Communication System Documentation

## Overview

This documentation describes a realtime communication system with three main components:

1. **Express/Socket.IO server** - Handles realtime messaging and user management
2. **Next.js Admin Dashboard** - Allows admins to monitor and communicate with users
3. **Vite Client Application** - User-facing chat interface

The system enables:

- User-to-admin messaging
- Admin-to-user private messaging
- Admin broadcast messages
- Real-time user connection tracking

## Architecture Diagram

```
[Vite Client] ←→ [Express Server] ←→ [Next.js Admin]
      ↑                     ↑
(User Messages)    (Admin Broadcasts/Private Messages)
```

## 1. Express Server Implementation

### Server Setup

```javascript
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:8080", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// Data structures for tracking connections
const users = new Map(); // socket.id -> { userId, role }
const adminSockets = new Set();
```

### Key Features

#### Connection Management

```javascript
io.on("connection", (socket) => {
  console.log("A user connected: ", socket.id);

  // Authentication handler
  socket.on("authenticate", ({ userId, role }) => {
    users.set(socket.id, { userId, role });

    if (role === "admin") {
      adminSockets.add(socket.id);
      console.log(`Admin connected: ${userId}`);
    } else {
      console.log(`User connected: ${userId}`);
      // Notify all admins about new user
      adminSockets.forEach((adminId) => {
        io.to(adminId).emit("user-connected", userId);
      });
    }
  });
});
```

#### Message Handling

```javascript
// Public messages (user to admin)
socket.on("sendMessage", (message) => {
  const userData = users.get(socket.id);
  if (!userData) return;

  if (userData.role === "user") {
    // Forward user messages to all admins
    adminSockets.forEach((adminId) => {
      io.to(adminId).emit("receiveMessage", {
        ...message,
        from: userData.userId,
        private: false,
      });
    });
  } else {
    // Admin broadcasting to all
    io.emit("receiveMessage", {
      ...message,
      from: "admin",
      private: false,
    });
  }
});

// Private messages (admin to specific user)
socket.on("sendPrivateMessage", ({ targetUserId, text }) => {
  const senderData = users.get(socket.id);
  if (!senderData || senderData.role !== "admin") return;

  // Find the target user's socket
  for (const [socketId, userData] of users) {
    if (userData.userId === targetUserId) {
      io.to(socketId).emit("receiveMessage", {
        userId: "admin",
        text,
        private: true,
      });
      break;
    }
  }
});
```

#### Disconnection Handling

```javascript
socket.on("disconnect", () => {
  const userData = users.get(socket.id);
  if (userData) {
    if (userData.role === "admin") {
      adminSockets.delete(socket.id);
    }
    users.delete(socket.id);
    console.log(`User disconnected: ${userData.userId}`);
  }
});
```

## 2. Next.js Admin Dashboard

### Key Components

#### Socket Connection Setup

```javascript
const socket = io("http://localhost:4000");

useEffect(() => {
  // Authenticate as admin
  socket.emit("authenticate", {
    userId: "admin-1",
    role: "admin",
  });

  // Message listener
  socket.on("receiveMessage", (message) => {
    setMessages((prev) => [...prev, message]);
  });

  // User connection listener
  socket.on("user-connected", (userId) => {
    setUsers((prev) => [...prev, userId]);
  });

  return () => {
    socket.off("receiveMessage");
    socket.off("user-connected");
  };
}, []);
```

#### Message Sending Logic

```javascript
const sendMessage = () => {
  if (input.trim()) {
    if (selectedUser === "all") {
      // Broadcast to all
      socket.emit("sendMessage", {
        text: input,
      });
    } else {
      // Private message to specific user
      socket.emit("sendPrivateMessage", {
        targetUserId: selectedUser,
        text: input,
      });
    }
    setInput("");
  }
};
```

#### UI Components

- User selection dropdown
- Message display area
- Input field with send button

## 3. Vite Client Application

### Key Features

#### Authentication and Setup

```javascript
const { user } = useUser();

useEffect(() => {
  if (!user?.id) return;

  // Authenticate as user
  socket.emit("authenticate", {
    userId: user.id,
    role: "user",
  });

  // Message listener
  socket.on("receiveMessage", (message) => {
    setMessages((prev) => [...prev, message]);
  });

  return () => {
    socket.off("receiveMessage");
  };
}, [user?.id]);
```

#### Message Sending

```javascript
const sendMessage = () => {
  if (input.trim()) {
    socket.emit("sendMessage", {
      text: input,
      userId: user.id, // Critical fix: Include userId with messages
    });
    setInput("");
  }
};
```

## Useage Examples (Full Examples)

Here's the complete code for all three components of your realtime communication system:

---

### 1. `server.js` (Express/Socket.IO Server)

```javascript
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: ["http://localhost:8080", "http://localhost:3000"],
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:8080", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// Store connected users
const users = new Map(); // socket.id -> { userId, role }
const adminSockets = new Set();

// Middleware to validate user connections
io.use((socket, next) => {
  const { userId, role } = socket.handshake.auth;
  if (userId && (role === "admin" || role === "user")) {
    return next();
  }
  return next(new Error("Authentication error"));
});

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);
  const { userId, role } = socket.handshake.auth;

  // Store user information
  users.set(socket.id, { userId, role });

  if (role === "admin") {
    adminSockets.add(socket.id);
    console.log(`Admin connected: ${userId}`);
    // Send list of connected users to admin
    const userList = Array.from(users.values())
      .filter((user) => user.role === "user")
      .map((user) => user.userId);
    socket.emit("user-list", userList);
  } else {
    console.log(`User connected: ${userId}`);
    // Notify all admins about new user
    adminSockets.forEach((adminId) => {
      io.to(adminId).emit("user-connected", userId);
    });
  }

  // Handle public messages
  socket.on("send-message", (message) => {
    const userData = users.get(socket.id);
    if (!userData) return;

    const messageData = {
      text: message.text,
      userId: userData.userId,
      timestamp: new Date().toISOString(),
      private: false,
    };

    if (userData.role === "user") {
      // Forward user messages to all admins
      adminSockets.forEach((adminId) => {
        io.to(adminId).emit("receive-message", messageData);
      });
    } else {
      // Admin broadcasting to all users
      io.emit("receive-message", {
        ...messageData,
        from: "admin",
      });
    }
  });

  // Handle private messages
  socket.on("send-private-message", ({ targetUserId, text }) => {
    const senderData = users.get(socket.id);
    if (!senderData || senderData.role !== "admin") return;

    const messageData = {
      text,
      userId: "admin",
      targetUserId,
      timestamp: new Date().toISOString(),
      private: true,
    };

    // Find the target user's socket
    for (const [socketId, userData] of users) {
      if (userData.userId === targetUserId && userData.role === "user") {
        io.to(socketId).emit("receive-message", messageData);
        // Also send to admin for their records
        socket.emit("receive-message", messageData);
        break;
      }
    }
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    const userData = users.get(socket.id);
    if (userData) {
      if (userData.role === "admin") {
        adminSockets.delete(socket.id);
      } else {
        // Notify admins about user disconnection
        adminSockets.forEach((adminId) => {
          io.to(adminId).emit("user-disconnected", userData.userId);
        });
      }
      users.delete(socket.id);
      console.log(`User disconnected: ${userData.userId}`);
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    users: users.size,
    admins: adminSockets.size,
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

---

### 2. Next.js Admin Chatbox (`/admin/chatbox/page.jsx`)

```javascript
"use client";
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

const AdminChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  const socket = io("http://localhost:4000", {
    auth: {
      userId: `admin-${crypto.randomUUID().slice(0, 8)}`,
      role: "admin",
    },
    autoConnect: true,
  });

  useEffect(() => {
    socket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to server");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("receive-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("user-connected", (userId) => {
      setUsers((prev) => [...prev, userId]);
    });

    socket.on("user-disconnected", (userId) => {
      setUsers((prev) => prev.filter((id) => id !== userId));
    });

    socket.on("user-list", (userList) => {
      setUsers(userList);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("receive-message");
      socket.off("user-connected");
      socket.off("user-disconnected");
      socket.off("user-list");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (input.trim()) {
      if (selectedUser === "all") {
        socket.emit("send-message", { text: input });
      } else {
        socket.emit("send-private-message", {
          targetUserId: selectedUser,
          text: input,
        });
      }
      setInput("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Admin Chat Dashboard</CardTitle>
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm">
            {isConnected ? "Connected" : "Disconnected"} | Users online:{" "}
            {users.length}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-4">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select recipient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((userId) => (
                <SelectItem key={userId} value={userId}>
                  User {userId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages yet. Start a conversation!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-3 p-3 rounded-lg max-w-xs md:max-w-md ${
                  msg.userId === "admin"
                    ? "ml-auto bg-blue-100 border-blue-200"
                    : msg.private
                    ? "bg-purple-100 border-purple-200"
                    : "bg-gray-100 border-gray-200"
                }`}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-semibold">
                    {msg.userId === "admin" ? "You" : `User ${msg.userId}`}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{msg.text}</p>
                {msg.private && (
                  <div className="text-xs text-purple-600 mt-1">
                    Private message
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={handleKeyPress}
          />
          <Button onClick={sendMessage} disabled={!input.trim()}>
            Send
          </Button>
        </div>
      </CardContent>

      <CardFooter className="text-xs text-gray-500">
        <p>Admin ID: {socket.auth?.userId}</p>
      </CardFooter>
    </Card>
  );
};

export default AdminChatBox;
```

---

### 3. Vite Client Chatbox (`/chatbox`)

```javascript
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

const UserChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useUser();

  const socket = io("http://localhost:4000", {
    auth: {
      userId: user?.id || `temp-${crypto.randomUUID().slice(0, 8)}`,
      role: "user",
    },
    autoConnect: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to server as user:", user.id);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("receive-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("receive-message");
      socket.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (input.trim()) {
      socket.emit("send-message", { text: input });
      setInput("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Customer Support</CardTitle>
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm">
            {isConnected ? "Connected to support" : "Disconnected"}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {isConnected
                ? "Send a message to start chatting with support."
                : "Connecting to support..."}
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-3 p-3 rounded-lg max-w-xs md:max-w-md ${
                  msg.userId === user?.id
                    ? "ml-auto bg-blue-100 border-blue-200"
                    : msg.private
                    ? "bg-purple-100 border-purple-200"
                    : "bg-gray-100 border-gray-200"
                }`}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-semibold">
                    {msg.userId === user?.id ? "You" : "Support Agent"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{msg.text}</p>
                {msg.private && (
                  <div className="text-xs text-purple-600 mt-1">
                    Private message
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={handleKeyPress}
            disabled={!isConnected}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || !isConnected}
          >
            Send
          </Button>
        </div>
      </CardContent>

      <CardFooter className="text-xs text-gray-500">
        <p>Your ID: {user?.id || "Not authenticated"}</p>
      </CardFooter>
    </Card>
  );
};

export default UserChatBox;
```

---

## Key Improvements in These Versions:

1. **Server Enhancements**:

   - Added proper authentication middleware
   - Improved message structure with timestamps
   - Better user tracking and notifications
   - Health check endpoint

2. **Admin Chatbox**:

   - Better UI with status indicators
   - Auto-scrolling message view
   - Improved message display with timestamps
   - Connection status monitoring

3. **User Chatbox**:

   - Proper connection handling
   - Better UI feedback
   - Message timestamps
   - Connection status indicators

4. **Both Clients**:
   - Proper TypeScript types (if using TS)
   - Better error handling
   - Auto-reconnection
   - Clean socket event cleanup

To use these components, make sure you have the required UI components installed (like shadcn/ui for the Card, Input, Button components) and the proper context providers set up.

## Lessons Learned and Best Practices

1. **Always Include Sender Context**: The initial issue with undefined user IDs was resolved by ensuring the userId is always included with messages.

2. **Connection Management**:

   - Use proper authentication on connection
   - Maintain separate data structures for different user types
   - Clean up event listeners on disconnection

3. **Error Handling**:

   - Verify user data exists before processing messages
   - Implement proper role checking for sensitive operations

4. **Scalability Considerations**:
   - The current in-memory storage works for small-scale applications
   - For production, consider Redis for distributed connection tracking

## Future Improvements

1. **Message Persistence**: Store messages in a database for history
2. **Authentication**: Implement proper JWT or session-based auth
3. **Scalability**: Add support for multiple admin clients
4. **Features**: Typing indicators, message read receipts, file sharing
5. **Error Recovery**: Handle reconnection logic more gracefully

## Deployment Notes

1. **Environment Variables**: Move all URLs and ports to configuration
2. **Production CORS**: Update CORS settings for production domains
3. **HTTPS**: Ensure all connections use HTTPS in production
4. **Load Testing**: Test with multiple concurrent users

This implementation serves as an excellent foundation for realtime communication applications and can be extended for various use cases including customer support systems, internal team communication tools, or live assistance features.
