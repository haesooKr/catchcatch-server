const express = require('express');
const http = require('http');
const socket = require('socket.io');
const cors = require('cors');

const { addUser, removeUser, getUser, getUsersInRoom, showUsers, nextTurn } = require("./users");
const randomWords = require('./words');
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
      start: false
    }

   const { error, user } = addUser({id: socket.id, nick, color, room});

   if(error) return callback({error});

   user.room.turn = user.id;

   showUsers();
   
   socket.emit("message", {
      user: "admin",
      text: `${user.nick}, welcome to Catch Catch!`
    });

    socket.join(user.room);

    io.to(user.room).emit("online", getUsersInRoom(user.room))

    

    return callback({code: `http://localhost:3000/join?code=${rot13(socket.id)}`})
  })

  socket.on('join', ({ nick, color, code }, callback) => {
    let room;
    if(code === "random"){
      return callback(); // 랜덤입장 구현하면 삭제할것
    } else {
      try {
        room = getUser(code).room; 
    let gameStarted = false;
    if(room.start){
      gameStarted = true;
    }
    if(gameStarted){
      return callback();
    }
      } catch (error) {
        return callback('존재하지않거나 부정확한 Code 입니다.');
    }
    }

    


    
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

  socket.on('privateMessage', (message, callback) => {
    const user = getUser(socket.id);

    io.to(user.room).emit('message', {
      user: user.nick,
      text: message,
      private: true
    });

    callback();
  })

  socket.on('start', () => {
    const user = getUser(socket.id);
    user.room.start = true;
    io.to(user.room).emit('message', {
      user: "admin",
      text: "Game Starts!"
    });

    io.to(user.room).emit('start', {
      round: user.room.round,
      timer: user.room.timer,
      turn: user.room.turn,
      words: randomWords()
    })
  })

  socket.on('drawing', ( word ) => {
    const user = getUser(socket.id);
    
    user.point[0] = true;

    io.to(user.room).emit('drawing2', {
      time: Date.now(),
      word
    });
  })

  socket.on('correct', ( callback ) => {
    const user = getUser(socket.id);
    
    user.point[0] = true;
    user.point[1] += 1;

    io.to(user.room).emit('message', {
      user: "admin",
      text: `${user.nick} guessed the word!`
    });

    if( (getUsersInRoom(user.room).filter(user => user.point[0] === false)).length < 1 ){
      callback(); // bug fixed #2020032606

      user.room.turn = nextTurn(user.room);

      io.to(user.room).emit('message', {
        user: "admin",
        text: `${getUser(user.room.turn).nick}'s turn!`
      })

      io.to(user.room).emit('next', { // ***
        timer: user.room.timer,
        turn: user.room.turn,
        points: getUsersInRoom(user.room).map(user => [user.point[1]]),
        words: randomWords(),
        roundTurn: (user.room.turn === getUsersInRoom(user.room)[0].id) // check last player's turn
      })
    } else {
      callback();
    }
  })
  
  socket.on('sendData', ( data ) => {
    console.log('데이터', data);
    const user = getUser(socket.id);

    console.log('유저', user);
    socket.broadcast.to(user.room).emit('backData', data)
  })

  socket.on('timeOver', () => {
    const user = getUser(socket.id);
    io.to(user.room).emit('message', {
      user: "admin",
      text: `Time Over!`
    });
    user.room.turn = nextTurn(user.room);
    io.to(user.room).emit('message', {
      user: "admin",
      text: `${getUser(user.room.turn).nick}'s turn!`
    })

    io.to(user.room).emit('next', { // ***
      timer: user.room.timer,
      turn: user.room.turn,
      points: getUsersInRoom(user.room).map(user => [user.point[1]]),
      words: randomWords(),
      roundTurn: (user.room.turn === getUsersInRoom(user.room)[0].id) // check last player's turn
    })
  })

  socket.on('turnReset', () => {
    const user = getUser(socket.id);
    user.room.turn = user.id;
  })

  socket.on('disconnect', () => {
    const user = getUser(socket.id);
    if(user.room.start === false && user.id === getUsersInRoom(user.room)[0].id){
      socket.broadcast.to(user.room).emit('message', {
        user: "admin",
        text: 'Host has left before the game starts. Please leave the room, and create a new room to play.'
      })
    }
    if(user.room.start === true && user.room.turn === user.id){
      user.room.turn = nextTurn(user.room);
      io.to(user.room).emit('message', {
        user: "admin",
        text: `${getUser(user.room.turn).nick}'s turn!`
      })

      const id = user.id;

      io.to(user.room).emit('next', { // ***
        timer: user.room.timer,
        turn: user.room.turn,
        points: getUsersInRoom(user.room).filter(user => user.id !== id).map(user => [user.point[1]]),
        words: randomWords(),
        roundTurn: (user.room.turn === getUsersInRoom(user.room)[0].id) // check last player's turn
      })
    }

    removeUser(socket.id);

    if(user){
      socket.broadcast.to(user.room).emit('message', {
        user: "admin",
        text: `${user.nick} has left.`
      })
    }
    
    if(getUsersInRoom(user.room).length > 1){
      socket.broadcast.to(user.room).emit("online", getUsersInRoom(user.room))
    } else {
      socket.broadcast.to(user.room).emit("online", getUsersInRoom(user.room), true)
    }
    
  })
})

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})