require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const GameManager = require('./GameManager');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Inicializace Supabase klienta
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://csdhvyzojrmgiusijtho.supabase.co',
    process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZGh2eXpvanJtZ2l1c2lqdGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkzNjMwMTQsImV4cCI6MjA0NDkzOTAxNH0.eqhsppvuis93PjufOxn5w4Qhn6RK_zDYRSFIMTV-Wvo'
);

// Middleware pro logování
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Statické soubory
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });
} else {
    app.use(express.static('public'));
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const gameManager = new GameManager(io); // Předáme io instanci do GameManageru

// Socket.IO error handling
io.engine.on("connection_error", (err) => {
    console.log(err.req);      // the request object
    console.log(err.code);     // the error code, for example 1
    console.log(err.message);  // the error message, for example "Session ID unknown"
    console.log(err.context);  // some additional error context
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Nový hráč se připojil (ID: ${socket.id})`);
    console.log('Aktuální počet připojených klientů:', io.engine.clientsCount);

    socket.on('joinGame', () => {
        try {
            gameManager.handlePlayerJoin(socket);
        } catch (error) {
            console.error('Chyba při připojování do hry:', error);
            socket.emit('error', 'Nepodařilo se připojit do hry');
        }
    });

    socket.on('cancelSearch', () => {
        try {
            gameManager.cancelSearch(socket);
            socket.emit('searchCancelled');
        } catch (error) {
            console.error('Chyba při rušení hledání:', error);
        }
    });

    socket.on('disconnect', () => {
        try {
            const gameId = gameManager.playerGameMap.get(socket.id);
            if (gameId) {
                const playerIndex = gameManager.getPlayerIndex(gameId, socket.id);
                gameManager.handleDisconnect(gameId, playerIndex);
            } else {
                gameManager.cancelSearch(socket);
            }
            console.log(`Hráč se odpojil (ID: ${socket.id})`);
        } catch (error) {
            console.error('Chyba při odpojování hráče:', error);
        }
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3001;
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
}));

server.listen(PORT, () => {
    console.log(`Server běží na portu ${PORT}`);
});
