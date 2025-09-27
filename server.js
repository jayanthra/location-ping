const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS settings
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from public directory
app.use(express.static('public'));

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Store active users and their data
const activeUsers = new Map();

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);
    
    // Initialize user data
    let userData = {
        userId: socket.id,
        nickname: 'Anonymous',
        lat: null,
        lng: null,
        accuracy: null,
        timestamp: Date.now()
    };
    
    // Handle nickname setting on connection
    socket.on('set-nickname', (nickname) => {
        userData.nickname = nickname || 'Anonymous';
        activeUsers.set(socket.id, userData);
        
        // Send current active users to the new connection
        const otherUsers = Array.from(activeUsers.values()).filter(user => user.userId !== socket.id);
        socket.emit('active-users', otherUsers);
        
        // Notify others about new user
        socket.broadcast.emit('user-joined', { 
            userId: socket.id,
            nickname: userData.nickname,
            timestamp: Date.now() 
        });
        
        console.log(`User ${socket.id} set nickname: ${userData.nickname}`);
    });
    
    // Handle nickname updates
    socket.on('update-nickname', (data) => {
        const oldNickname = userData.nickname;
        userData.nickname = data.newNickname;
        activeUsers.set(socket.id, userData);
        
        // Broadcast nickname change to all other users
        socket.broadcast.emit('nickname-updated', {
            userId: socket.id,
            oldNickname: oldNickname,
            nickname: data.newNickname
        });
        
        console.log(`User ${socket.id} changed nickname: ${oldNickname} -> ${data.newNickname}`);
    });

    // Handle location updates
    socket.on('location-update', (data) => {
        userData = {
            ...userData,
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            nickname: data.nickname || userData.nickname,
            timestamp: Date.now()
        };
        
        // Store updated user data
        activeUsers.set(socket.id, userData);
        
        // Broadcast to all other users
        socket.broadcast.emit('user-location', {
            userId: socket.id,
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            nickname: userData.nickname,
            timestamp: Date.now()
        });
        
        // Log for monitoring
        console.log(`Location update from ${userData.nickname} (${socket.id}):`, {
            lat: data.lat.toFixed(6),
            lng: data.lng.toFixed(6),
            activeUsers: activeUsers.size
        });
    });

    // Handle manual disconnect
    socket.on('stop-sharing', () => {
        const user = activeUsers.get(socket.id);
        const nickname = user ? user.nickname : 'Anonymous';
        
        activeUsers.delete(socket.id);
        socket.broadcast.emit('user-left', { 
            userId: socket.id,
            nickname: nickname
        });
        
        console.log(`User ${nickname} (${socket.id}) stopped sharing`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        const nickname = user ? user.nickname : 'Anonymous';
        
        activeUsers.delete(socket.id);
        socket.broadcast.emit('user-left', { 
            userId: socket.id,
            nickname: nickname
        });
        
        console.log(`User ${nickname} (${socket.id}) disconnected, Active users: ${activeUsers.size}`);
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
});

// API endpoint to get current active users (optional monitoring endpoint)
app.get('/api/users', (req, res) => {
    const users = Array.from(activeUsers.values()).map(user => ({
        nickname: user.nickname,
        hasLocation: !!(user.lat && user.lng),
        lastUpdate: user.timestamp
    }));
    
    res.json({
        totalUsers: users.length,
        users: users
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Location broadcasting service is active`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`👥 Nickname support enabled`);
});