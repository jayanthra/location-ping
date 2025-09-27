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

// Store active users and their locations
const activeUsers = new Map();

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);
    
    // Send current active users to the new connection
    socket.emit('active-users', Array.from(activeUsers.values()));
    
    // Notify others about new user
    socket.broadcast.emit('user-joined', { 
        userId: socket.id, 
        timestamp: Date.now() 
    });

    // Handle location updates
    socket.on('location-update', (data) => {
        const locationData = {
            userId: socket.id,
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            timestamp: Date.now()
        };
        
        // Store user location
        activeUsers.set(socket.id, locationData);
        
        // Broadcast to all other users
        socket.broadcast.emit('user-location', locationData);
        
        // Log for monitoring
        console.log(`Location update from ${socket.id}:`, {
            lat: data.lat,
            lng: data.lng,
            activeUsers: activeUsers.size
        });
    });

    // Handle manual disconnect
    socket.on('stop-sharing', () => {
        activeUsers.delete(socket.id);
        socket.broadcast.emit('user-left', { userId: socket.id });
        console.log(`User stopped sharing: ${socket.id}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        activeUsers.delete(socket.id);
        socket.broadcast.emit('user-left', { userId: socket.id });
        console.log(`User disconnected: ${socket.id}, Active users: ${activeUsers.size}`);
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
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
});