const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const supabase = createClient(process.env.SUPABASE_URL || 'https://csdhvyzojrmgiusijtho.supabase.co', process.env.SUPABASE_KEY ||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZGh2eXpvanJtZ2l1c2lqdGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkzNjMwMTQsImV4cCI6MjA0NDkzOTAxNH0.eqhsppvuis93PjufOxn5w4Qhn6RK_zDYRSFIMTV-Wvo');

app.use(express.static('client/build'));

io.on('connection', (socket) => {
  console.log('Nový hráč se připojil');

  socket.on('disconnect', () => {
    console.log('Hráč se odpojil');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
});
