  //server.index.js
  const express = require('express');
  const app = express();
  const server = require('http').createServer(app);
  const io = require('socket.io')(server, {
    cors: {
      origin: ["https://mindguardai.vercel.app","http://localhost:5173"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  const cors = require('cors');

  app.use(cors({
    // origin: "https://mental-health-prediction-frontend.vercel.app"
    origin: ["https://mindguardai.vercel.app","http://localhost:5173"],
  }));
  app.use(express.json());

  const PORT = process.env.PORT || 5000;

  // Store room and user information
  const rooms = new Map();
  const activeUsers = new Map();

  // Utility functions
  const getRoomUsers = (roomId) => {
    return Array.from(activeUsers.entries())
      .filter(([_, user]) => user.roomId === roomId)
      .map(([id, user]) => ({
        userId: id,
        userName: user.userName
      }));
  };

  const leaveRoom = (socket) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      const { roomId } = user;
      // Remove user from room
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
      // Remove from active users
      activeUsers.delete(socket.id);
      // Notify others
      socket.to(roomId).emit('user-left', socket.id);
      return roomId;
    }
    return null;
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle room joining
    socket.on('join-room', ({ userName, roomId }) => {
      try {
        // Leave previous room if any
        leaveRoom(socket);

        // Join new room
        socket.join(roomId);
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);
        
        // Add to active users
        activeUsers.set(socket.id, { 
          userName, 
          roomId,
          joinedAt: Date.now()
        });

        // Notify others in the room
        socket.to(roomId).emit('user-joined', {
          userId: socket.id,
          userName
        });

        // Send current users in room to the joining user
        const usersInRoom = getRoomUsers(roomId);
        socket.emit('room-users', usersInRoom.filter(user => user.userId !== socket.id));

        console.log(`${userName} joined room ${roomId}`);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', 'Failed to join room');
      }
    });

    // Handle call signaling
    socket.on('call-user', ({ userToCall, signalData, from, name }) => {
      try {
        const caller = activeUsers.get(from);
        const target = activeUsers.get(userToCall);
        
        if (!caller || !target || caller.roomId !== target.roomId) {
          return;
        }

        io.to(userToCall).emit('incoming-call', {
          signal: signalData,
          from,
          name
        });
      } catch (error) {
        console.error('Error in call-user:', error);
      }
    });

    socket.on('answer-call', ({ to, signal }) => {
      try {
        const answerer = activeUsers.get(socket.id);
        const caller = activeUsers.get(to);
        
        if (!answerer || !caller || answerer.roomId !== caller.roomId) {
          return;
        }

        io.to(to).emit('call-accepted', {
          signal,
          from: socket.id
        });
      } catch (error) {
        console.error('Error in answer-call:', error);
      }
    });

    // Handle room leaving
    socket.on('leave-room', () => {
      const roomId = leaveRoom(socket);
      if (roomId) {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const roomId = leaveRoom(socket);
      if (roomId) {
        console.log(`User ${socket.id} disconnected from room ${roomId}`);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      activeRooms: rooms.size,
      activeUsers: activeUsers.size
    });
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });




// // server/index.js
// const express = require('express');
// const app = express();
// const server = require('http').createServer(app);
// const io = require('socket.io')(server, {
//   cors: {
//     origin: "http://localhost:5173",
//     methods: ["GET", "POST"],
//     credentials: true
//   }
// });
// const cors = require('cors');

// app.use(cors());
// app.use(express.json());

// const PORT = process.env.PORT || 5000;

// // Store active users
// const activeUsers = new Map();

// io.on('connection', (socket) => {
//   console.log('User connected:', socket.id);

//   // Handle user joining
//   socket.on('join', ({ userName, roomId }) => {
//     activeUsers.set(socket.id, { userName, roomId });
//     socket.join(roomId);
    
//     // Notify others in the room
//     socket.to(roomId).emit('user-joined', {
//       userName,
//       userId: socket.id
//     });

//     // Send list of active users in the room
//     const usersInRoom = Array.from(activeUsers.entries())
//       .filter(([_, user]) => user.roomId === roomId)
//       .map(([id, user]) => ({
//         userId: id,
//         userName: user.userName
//       }));
      
//     socket.emit('active-users', usersInRoom);
//   });

//   // Handle call signaling
//   socket.on('call-user', ({ userToCall, signalData, from, name }) => {
//     io.to(userToCall).emit('incoming-call', {
//       signal: signalData,
//       from,
//       name
//     });
//   });

//   socket.on('answer-call', ({ to, signal }) => {
//     io.to(to).emit('call-accepted', signal);
//   });

//   // Handle ICE candidates
//   socket.on('ice-candidate', ({ target, candidate }) => {
//     io.to(target).emit('ice-candidate', {
//       candidate,
//       from: socket.id
//     });
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     const user = activeUsers.get(socket.id);
//     if (user) {
//       const { roomId } = user;
//       socket.to(roomId).emit('user-left', socket.id);
//       activeUsers.delete(socket.id);
//     }
//     console.log('User disconnected:', socket.id);
//   });
// });

// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });