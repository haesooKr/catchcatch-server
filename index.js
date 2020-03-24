const express = require('express');
const http = require('http');
const socket = require('socket.io');
const cors = require('cors');

const { addUser, removeUser, getUser, getUsersInRoom, showUsers } = require("./users");
const rot13 = require('./rot13');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const router = require('./router');

const PORT = process.env.PORT || 4000

app.use(cors());
app.use(router);

io.on('connection', socket => {
  console.log('user connected');

  socket.on('create', ({ nick, color, round, timer, language }, callback) => {
    const room = {
      id: `${Math.round(Math.random() * 10)}`,
      round,
      timer,
      language,
      turn: []
    }

   const { error, user } = addUser({id: socket.id, nick, color, room});

   if(error) return callback({error});

   
   socket.emit("message", {
      user: "admin",
      text: `${user.nick}, welcome to Catch Catch!`
    });

    socket.join(user.room);

    io.to(user.room).emit("online", getUsersInRoom(user.room))

    

    return callback({code: `http://localhost:3000/join?code=${rot13(socket.id)}`})
  })

  socket.on('join', ({ nick, color, code }, callback) => {
    if(code === "random"){
      return callback();
    }

    const room = getUser(code).room;
    const { error, user } = addUser({id: socket.id, nick, color, room});

    socket.join(room);

    socket.broadcast.to(room).emit("message", {
      user: "admin",
      text: `${user.nick}, has joined!`
    });

    io.to(room).emit("online", getUsersInRoom(room))
  })


  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    io.to(user.room).emit('message', {
      user: user.nick,
      text: message
    });

    callback();
  })

  socket.on('start', () => {
    const user = getUser(socket.id);
    io.to(user.room).emit('message', {
      user: "admin",
      text: "Game Starts!"
    });

    user.room.turn = getUsersInRoom(user.room).map(user => user.id) 

    io.to(user.room).emit('start', {
      round: user.room.round,
      timer: user.room.timer,
      turn: user.room.turn[0],
      words: ["ex1", "ex2", "ex3"]
    })
  })

  socket.on('drawing', ( word ) => {
    const user = getUser(socket.id);
    
    io.to(user.room).emit('drawing2', {
      time: Date.now(),
      word
    });
  })

  socket.on('next', () => {
    // next turn
  })

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if(user){
      io.to(user.room).emit('message', {
        user: "admin",
        text: `${user.nick} has left.`
      })
    }
    
    console.log('user disconnected');
    showUsers();
  })
})

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})