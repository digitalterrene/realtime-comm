"use client";
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

const AdminChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  const socket = io('http://localhost:4000', {
    auth: {
      userId: `admin-${crypto.randomUUID().slice(0, 8)}`,
      role: 'admin'
    },
    autoConnect: true
  });

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('receive-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('user-connected', (userId) => {
      setUsers(prev => [...prev, userId]);
    });

    socket.on('user-disconnected', (userId) => {
      setUsers(prev => prev.filter(id => id !== userId));
    });

    socket.on('user-list', (userList) => {
      setUsers(userList);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receive-message');
      socket.off('user-connected');
      socket.off('user-disconnected');
      socket.off('user-list');
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (input.trim()) {
      if (selectedUser === 'all') {
        socket.emit('send-message', { text: input });
      } else {
        socket.emit('send-private-message', {
          targetUserId: selectedUser,
          text: input
        });
      }
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Admin Chat Dashboard</CardTitle>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            {isConnected ? 'Connected' : 'Disconnected'} | Users online: {users.length}
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
              {users.map(userId => (
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
                className={`mb-3 p-3 rounded-lg max-w-xs md:max-w-md ${msg.userId === 'admin'
                  ? 'ml-auto bg-blue-100 border-blue-200'
                  : msg.private
                    ? 'bg-purple-100 border-purple-200'
                    : 'bg-gray-100 border-gray-200'
                  }`}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-semibold">
                    {msg.userId === 'admin' ? 'You' : `User ${msg.userId}`}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{msg.text}</p>
                {msg.private && (
                  <div className="text-xs text-purple-600 mt-1">Private message</div>
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