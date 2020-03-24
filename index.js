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
      language
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

  socket.on('join', ({ nick, color, code }) => {
    const room = getUser(code).room;
    const { error, user } = addUser({id: socket.id, nick, color, room});

    socket.join(room);

    socket.broadcast.to(room).emit("message", {
      user: "admin",
      text: `${user.nick}, has joined!`
    });

    io.to(room).emit("online", getUsersInRoom(room))
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