import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useUser } from '@/contexts/UserContext';

const UserChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useUser();

  const socket = io('http://localhost:4000', {
    auth: {
      userId: user?.id || `temp-${crypto.randomUUID().slice(0, 8)}`,
      role: 'user'
    },
    autoConnect: !!user?.id
  });

  useEffect(() => {
    if (!user?.id) return;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server as user:', user.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('receive-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receive-message');
      socket.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (input.trim()) {
      socket.emit('send-message', { text: input });
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
        <CardTitle>Customer Support</CardTitle>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            {isConnected ? 'Connected to support' : 'Disconnected'}
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
                className={`mb-3 p-3 rounded-lg max-w-xs md:max-w-md ${msg.userId === user?.id
                  ? 'ml-auto bg-blue-100 border-blue-200'
                  : msg.private
                    ? 'bg-purple-100 border-purple-200'
                    : 'bg-gray-100 border-gray-200'
                  }`}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-semibold">
                    {msg.userId === user?.id ? 'You' : 'Support Agent'}
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
            disabled={!isConnected}
          />
          <Button onClick={sendMessage} disabled={!input.trim() || !isConnected}>
            Send
          </Button>
        </div>
      </CardContent>
      
      <CardFooter className="text-xs text-gray-500">
        <p>Your ID: {user?.id || 'Not authenticated'}</p>
      </CardFooter>
    </Card>
  );
};

export default UserChatBox;