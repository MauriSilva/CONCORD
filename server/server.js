const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const MAX_PARTICIPANTS = 5;

// Servir arquivos da pasta public
app.use(express.static(path.join(__dirname, "../public")));

// Armazena as salas em memória
// Map<roomCode, { code: string, participants: Map<socketId, { id: string, name: string }>, currentStreamer: string | null }>
const rooms = new Map();

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "Concord Server"
    });
});

function generateRoomCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }
    return code;
}

function findRoomBySocketId(socketId) {
    for (const [roomCode, room] of rooms.entries()) {
        if (room.participants.has(socketId)) {
            return { roomCode, room };
        }
    }
    return null;
}

// Remove um usuário da sala, seja por saída voluntária ou desconexão
function removeUserFromRoom(socket, disconnected = false) {
    const found = findRoomBySocketId(socket.id);
    if (!found) return;

    const { roomCode, room } = found;
    const user = room.participants.get(socket.id);
    const userName = user?.name || "Participante";

    room.participants.delete(socket.id);

    if (!disconnected) {
        socket.leave(roomCode);
    }

    console.log(`Usuário ${userName} (${socket.id}) saiu da sala ${roomCode}. Restam ${room.participants.size}.`);

    // Se o usuário que saiu estava transmitindo, encerra a transmissão
    if (room.currentStreamer === socket.id) {
        room.currentStreamer = null;
        io.to(roomCode).emit("stream-stopped");
        io.to(roomCode).emit("chat-system-message", `${userName} encerrou a transmissão e saiu da sala.`);
    }

    // Se a sala ficou vazia, exclui
    if (room.participants.size === 0) {
        rooms.delete(roomCode);
        console.log(`Sala ${roomCode} encerrada (sem participantes).`);
    } else {
        // Notifica os demais participantes
        const remainingList = Array.from(room.participants.values());
        io.to(roomCode).emit("user-left", {
            id: socket.id,
            name: userName,
            participants: remainingList,
            currentStreamer: room.currentStreamer
        });
        io.to(roomCode).emit("chat-system-message", `${userName} saiu da sala.`);
    }
}

io.on("connection", (socket) => {
    console.log(`Usuário conectado: ${socket.id}`);

    // ========================================
    // CRIAR SALA
    // ========================================
    socket.on("create-room", (data) => {
        let roomCode;
        do {
            roomCode = generateRoomCode();
        } while (rooms.has(roomCode));

        const rawName = (data && typeof data === "object" && data.username)
            ? data.username
            : (typeof data === "string" ? data : "Participante");
        const cleanName = String(rawName).trim().slice(0, 20) || "Participante";

        const room = {
            code: roomCode,
            participants: new Map(),
            currentStreamer: null
        };

        room.participants.set(socket.id, {
            id: socket.id,
            name: cleanName
        });

        rooms.set(roomCode, room);
        socket.join(roomCode);

        console.log(`${cleanName} criou a sala: ${roomCode}`);

        socket.emit("room-joined", {
            roomCode,
            participants: Array.from(room.participants.values()),
            currentStreamer: null,
            currentStreamerName: null,
            myId: socket.id
        });
    });

    // ========================================
    // ENTRAR EM SALA
    // ========================================
    socket.on("join-room", (data) => {
        let roomCode = "";
        let username = "Participante";

        if (typeof data === "string") {
            roomCode = data;
        } else if (data && typeof data === "object") {
            roomCode = data.roomCode || "";
            username = data.username ? String(data.username).trim().slice(0, 20) : "Participante";
        }

        if (typeof roomCode !== "string") {
            socket.emit("room-error", "Código de sala inválido.");
            return;
        }

        roomCode = roomCode.toUpperCase().trim().slice(0, 8);
        const room = rooms.get(roomCode);

        if (!room) {
            socket.emit("room-error", "Sala não encontrada.");
            return;
        }

        if (room.participants.size >= MAX_PARTICIPANTS) {
            socket.emit("room-error", `Essa sala já está cheia (máximo de ${MAX_PARTICIPANTS} pessoas).`);
            return;
        }

        if (room.participants.has(socket.id)) {
            socket.emit("room-error", "Você já está nessa sala.");
            return;
        }

        const cleanName = username || "Participante";

        room.participants.set(socket.id, {
            id: socket.id,
            name: cleanName
        });

        socket.join(roomCode);
        console.log(`${cleanName} entrou na sala ${roomCode} (${room.participants.size}/${MAX_PARTICIPANTS})`);

        const participantsList = Array.from(room.participants.values());
        const streamerName = room.currentStreamer
            ? room.participants.get(room.currentStreamer)?.name || "Alguém"
            : null;

        // Responde para quem acabou de entrar
        socket.emit("room-joined", {
            roomCode,
            participants: participantsList,
            currentStreamer: room.currentStreamer,
            currentStreamerName: streamerName,
            myId: socket.id
        });

        // Avisa os outros membros da sala
        socket.to(roomCode).emit("user-joined", {
            id: socket.id,
            name: cleanName,
            participants: participantsList,
            currentStreamer: room.currentStreamer
        });

        // Notifica no chat da sala
        io.to(roomCode).emit("chat-system-message", `${cleanName} entrou na sala.`);
    });

    // ========================================
    // INICIAR TRANSMISSÃO
    // ========================================
    socket.on("start-stream", () => {
        const found = findRoomBySocketId(socket.id);
        if (!found) return;

        const { roomCode, room } = found;

        if (room.currentStreamer && room.currentStreamer !== socket.id) {
            socket.emit("stream-error", "Já existe uma transmissão em andamento nesta sala.");
            return;
        }

        room.currentStreamer = socket.id;
        const streamerName = room.participants.get(socket.id)?.name || "Alguém";

        console.log(`${streamerName} iniciou transmissão na sala ${roomCode}`);

        io.to(roomCode).emit("stream-started", {
            streamerId: socket.id,
            streamerName
        });

        io.to(roomCode).emit("chat-system-message", `${streamerName} iniciou uma transmissão.`);
    });

    // ========================================
    // PARAR TRANSMISSÃO
    // ========================================
    socket.on("stop-stream", () => {
        const found = findRoomBySocketId(socket.id);
        if (!found) return;

        const { roomCode, room } = found;

        if (room.currentStreamer === socket.id) {
            room.currentStreamer = null;
            const streamerName = room.participants.get(socket.id)?.name || "Alguém";

            console.log(`${streamerName} encerrou transmissão na sala ${roomCode}`);

            io.to(roomCode).emit("stream-stopped");
            io.to(roomCode).emit("chat-system-message", `${streamerName} encerrou a transmissão.`);
        }
    });

    // ========================================
    // WEBRTC SIGNALING DIRECIONADO
    // ========================================

    socket.on("webrtc-offer", (data) => {
        // data: { targetId, offer }
        if (!data || !data.targetId || !data.offer) return;
        io.to(data.targetId).emit("webrtc-offer", {
            fromId: socket.id,
            offer: data.offer
        });
    });

    socket.on("webrtc-answer", (data) => {
        // data: { targetId, answer }
        if (!data || !data.targetId || !data.answer) return;
        io.to(data.targetId).emit("webrtc-answer", {
            fromId: socket.id,
            answer: data.answer
        });
    });

    socket.on("webrtc-candidate", (data) => {
        // data: { targetId, candidate }
        if (!data || !data.targetId || !data.candidate) return;
        io.to(data.targetId).emit("webrtc-candidate", {
            fromId: socket.id,
            candidate: data.candidate
        });
    });

    // ========================================
    // CHAT DE TEXTO DA SALA
    // ========================================
    socket.on("send-chat-message", (messageText) => {
        if (typeof messageText !== "string") return;

        const cleanText = messageText.trim().slice(0, 300);
        if (!cleanText) return;

        const found = findRoomBySocketId(socket.id);
        if (!found) return;

        const { roomCode, room } = found;
        const sender = room.participants.get(socket.id);
        const senderName = sender?.name || "Participante";
        const isStreamer = room.currentStreamer === socket.id;

        const time = new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
        });

        io.to(roomCode).emit("chat-message", {
            senderId: socket.id,
            senderName,
            isStreamer,
            text: cleanText,
            time
        });
    });

    // ========================================
    // SAIR DA SALA
    // ========================================
    socket.on("leave-room", () => {
        removeUserFromRoom(socket, false);
    });

    // ========================================
    // DESCONEXÃO
    // ========================================
    socket.on("disconnect", () => {
        removeUserFromRoom(socket, true);
    });
});

server.listen(PORT, () => {
    console.log(`Concord rodando em http://localhost:${PORT}`);
});
