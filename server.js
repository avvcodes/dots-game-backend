import express from "express";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors({ origin: "*" }));
app.get("/", (_req, res) => res.json({ status: "ok", service: "Dots & Boxes Socket.IO server" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const io = new Server(app, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const BOARD_SIZE = 5;
const rooms = new Map();
const key = (row, column) => `${row}-${column}`;
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const freshGame = () => ({ h: [], v: [], boxes: {}, turn: "p1", over: false });

function boxComplete(row, column, game) {
  return (
    game.h.includes(key(row, column)) &&
    game.h.includes(key(row + 1, column)) &&
    game.v.includes(key(row, column)) &&
    game.v.includes(key(row, column + 1))
  );
}

function publicRoom(room) {
  return {
    code: room.code,
    boardSize: BOARD_SIZE,
    players: room.players,
    game: room.game,
    chat: room.chat
  };
}

function broadcast(room) {
  io.to(room.code).emit("room:update", publicRoom(room));
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name }, callback) => {
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();

    const room = {
      code,
      players: {
        p1: { id: socket.id, name: (name || "Player 1").trim().slice(0, 16), connected: true },
        p2: null
      },
      game: freshGame(),
      chat: []
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerId = "p1";
    broadcast(room);
    callback({ ok: true, room: publicRoom(room), playerId: "p1" });
  });

  socket.on("room:join", ({ code, name }, callback) => {
    const room = rooms.get((code || "").trim().toUpperCase());

    if (!room) return callback({ ok: false, error: "Room not found." });
    if (room.players.p2) return callback({ ok: false, error: "Room is full." });

    room.players.p2 = {
      id: socket.id,
      name: (name || "Player 2").trim().slice(0, 16),
      connected: true
    };

    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = "p2";

    room.chat.push({ name: "System", text: `${room.players.p2.name} joined the room.` });
    broadcast(room);
    callback({ ok: true, room: publicRoom(room), playerId: "p2" });
  });

  socket.on("game:move", ({ type, row, column }, callback) => {
    const room = rooms.get(socket.data.roomCode);
    const playerId = socket.data.playerId;

    if (!room || room.game.over || room.game.turn !== playerId) {
      return callback?.({ ok: false, error: "Not your turn." });
    }

    if (!["h", "v"].includes(type)) return callback?.({ ok: false });
    const line = key(row, column);
    if (room.game[type].includes(line)) return callback?.({ ok: false });

    room.game[type].push(line);

    const nearbyBoxes =
      type === "h"
        ? [[row - 1, column], [row, column]]
        : [[row, column - 1], [row, column]];

    let claimedBox = false;

    for (const [boxRow, boxColumn] of nearbyBoxes) {
      const valid =
        boxRow >= 0 &&
        boxRow < BOARD_SIZE &&
        boxColumn >= 0 &&
        boxColumn < BOARD_SIZE;

      const boxId = key(boxRow, boxColumn);

      if (valid && !room.game.boxes[boxId] && boxComplete(boxRow, boxColumn, room.game)) {
        room.game.boxes[boxId] = playerId;
        claimedBox = true;
      }
    }

    if (!claimedBox) room.game.turn = playerId === "p1" ? "p2" : "p1";
    if (Object.keys(room.game.boxes).length === BOARD_SIZE * BOARD_SIZE) room.game.over = true;

    broadcast(room);
    callback?.({ ok: true });
  });

  socket.on("chat:send", ({ text }, callback) => {
    const room = rooms.get(socket.data.roomCode);
    const playerId = socket.data.playerId;
    const message = (text || "").trim().slice(0, 250);

    if (!room || !playerId || !message) return callback?.({ ok: false });

    room.chat.push({ name: room.players[playerId]?.name || "Player", text: message });
    room.chat = room.chat.slice(-50);
    broadcast(room);
    callback?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    const playerId = socket.data.playerId;

    if (room?.players[playerId]) {
      room.players[playerId].connected = false;
      broadcast(room);
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
