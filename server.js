import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static('public'));
app.use(express.static('.'));

const rooms = new Map();

const winningCombos = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

function checkWinner(board) {
  for (let combo of winningCombos) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(cell => cell !== '')) return 'draw';
  return null;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', (roomCode) => {
    const room = rooms.get(roomCode);
    
    if (!room) {
      rooms.set(roomCode, {
        players: [socket.id],
        board: Array(9).fill(''),
        turn: 0
      });
      socket.join(roomCode);
      socket.emit('roomJoined', { role: 'X', roomCode });
    } else if (room.players.length < 2 && !room.players.includes(socket.id)) {
      room.players.push(socket.id);
      socket.join(roomCode);
      socket.emit('roomJoined', { role: 'O', roomCode });
      io.to(roomCode).emit('gameStart', { board: room.board });
    } else {
      socket.emit('error', 'Room full or invalid');
    }
  });

  socket.on('makeMove', ({ roomCode, index, symbol }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    room.board[index] = symbol;
    room.turn++;
    
    io.to(roomCode).emit('updateBoard', { 
      board: room.board, 
      currentTurn: room.turn % 2 === 0 ? 'X' : 'O'
    });
    
    const winner = checkWinner(room.board);
    if (winner) {
      io.to(roomCode).emit('gameOver', { winner });
      room.board = Array(9).fill('');
      room.turn = 0;
    }
  });

  socket.on('resetGame', (roomCode) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.board = Array(9).fill('');
      room.turn = 0;
      io.to(roomCode).emit('gameReset');
    }
  });

  socket.on('disconnect', () => {
    for (const [code, room] of rooms) {
      if (room.players.includes(socket.id)) {
        io.to(code).emit('playerLeft');
        rooms.delete(code);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));