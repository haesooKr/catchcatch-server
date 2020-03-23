const express = require('express');
const http = require('http');
const socket = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const router = require('./router');

const PORT = process.env.PORT || 4000

app.use(cors());
app.use(router);

io.on('connection', socket => {
  console.log('user connected');


  socket.on('disconnect', () => {
    console.log('user disconnected');
  })
})

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})