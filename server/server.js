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

// Servir arquivos da pasta public
app.use(express.static(path.join(__dirname, "../public")));

// Armazena as salas em memória
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

// Remove um usuário da sala, seja por saída voluntária
// ou por desconexão.
function removeUserFromRoom(socket, disconnected = false) {

    for (const [roomCode, room] of rooms.entries()) {

        // O anfitrião saiu
        if (room.host === socket.id) {

            rooms.delete(roomCode);

            if (!disconnected) {
                socket.leave(roomCode);
            }

            if (room.viewer) {
                io.to(room.viewer).emit("host-left");
            }

            console.log(`Sala ${roomCode} encerrada pelo anfitrião.`);

            return;
        }

        // O participante saiu
        if (room.viewer === socket.id) {

            const leavingName = room.viewerName || "Seu amigo";
            room.viewer = null;
            room.viewerName = null;

            if (!disconnected) {
                socket.leave(roomCode);
            }

            io.to(room.host).emit("viewer-left");
            io.to(room.host).emit("chat-system-message", `${leavingName} saiu da sala.`);

            console.log(`Viewer ${leavingName} saiu da sala ${roomCode}.`);

            return;
        }
    }
}

io.on("connection", (socket) => {

    console.log(`Usuário conectado: ${socket.id}`);

    // Criar sala
    socket.on("create-room", (data) => {

        let roomCode;

        do {
            roomCode = generateRoomCode();
        } while (rooms.has(roomCode));

        const hostName = (data && typeof data === "object" && data.username)
            ? String(data.username).trim().slice(0, 20)
            : (typeof data === "string" ? data.trim().slice(0, 20) : "Host");

        rooms.set(roomCode, {
            host: socket.id,
            hostName: hostName || "Host",
            viewer: null,
            viewerName: null
        });

        socket.join(roomCode);

        console.log(`${hostName} criou a sala: ${roomCode}`);

        socket.emit("room-created", {
            roomCode,
            hostName: hostName || "Host"
        });
    });


    // Entrar em sala
    socket.on("join-room", (data) => {

        let roomCode = "";
        let viewerName = "Amigo";

        if (typeof data === "string") {
            roomCode = data;
        } else if (data && typeof data === "object") {
            roomCode = data.roomCode || "";
            viewerName = data.username ? String(data.username).trim().slice(0, 20) : "Amigo";
        }

        if (typeof roomCode !== "string") {
            socket.emit("room-error", "Código de sala inválido.");
            return;
        }

        roomCode = roomCode.toUpperCase().trim().slice(0, 8);

        const room = rooms.get(roomCode);

        // Sala não existe
        if (!room) {
            socket.emit("room-error", "Sala não encontrada.");
            return;
        }

        // Sala já possui viewer
        if (room.viewer) {
            socket.emit("room-error", "Essa sala já está cheia.");
            return;
        }

        // Não permitir que o host entre novamente
        if (room.host === socket.id) {
            socket.emit("room-error", "Você já é o host dessa sala.");
            return;
        }

        room.viewer = socket.id;
        room.viewerName = viewerName || "Amigo";

        socket.join(roomCode);

        console.log(`Usuário ${room.viewerName} entrou na sala ${roomCode}`);

        socket.emit("room-joined", {
            roomCode,
            hostName: room.hostName,
            viewerName: room.viewerName
        });

        // Avisar o host que alguém entrou, com o nome do viewer
        io.to(room.host).emit("viewer-joined", {
            viewerName: room.viewerName
        });

        // Notificar a sala no chat
        io.to(roomCode).emit("chat-system-message", `${room.viewerName} entrou na sala.`);
    });


    // Sair voluntariamente da sala
socket.on("leave-room", () => {

    console.log(`Usuário ${socket.id} solicitou sair da sala.`);

    removeUserFromRoom(socket);
});


    // ========================================
    // WEBRTC OFFER
    // ========================================

    socket.on("webrtc-offer", (offer) => {

        console.log("Oferta WebRTC recebida.");

        for (const [roomCode, room] of rooms.entries()) {

            if (room.host === socket.id && room.viewer) {

                io.to(room.viewer).emit("webrtc-offer", offer);

                break;
            }
        }
    });


    // ========================================
    // WEBRTC ANSWER
    // ========================================

    socket.on("webrtc-answer", (answer) => {

        console.log("Resposta WebRTC recebida.");

        for (const [roomCode, room] of rooms.entries()) {

            if (room.viewer === socket.id) {

                io.to(room.host).emit("webrtc-answer", answer);

                break;
            }
        }
    });


    // ========================================
    // WEBRTC ICE CANDIDATE
    // ========================================

    socket.on("webrtc-candidate", (candidate) => {

        console.log("Candidate WebRTC recebida.");

        for (const [roomCode, room] of rooms.entries()) {

            if (room.host === socket.id && room.viewer) {

                io.to(room.viewer).emit("webrtc-candidate", candidate);

                break;
            }

            if (room.viewer === socket.id) {

                io.to(room.host).emit("webrtc-candidate", candidate);

                break;
            }
        }
    });


    // ========================================
    // COMPARTILHAMENTO DE TELA ENCERRADO
    // ========================================

    socket.on("screen-share-stopped", () => {

        console.log("Compartilhamento de tela interrompido pelo host.");

        for (const [roomCode, room] of rooms.entries()) {

            if (room.host === socket.id && room.viewer) {

                io.to(room.viewer).emit("screen-share-stopped");

                break;
            }
        }
    });


    // ========================================
    // CHAT DE TEXTO DA SALA
    // ========================================

    socket.on("send-chat-message", (messageText) => {

        if (typeof messageText !== "string") {
            return;
        }

        const cleanText = messageText.trim().slice(0, 300);

        if (!cleanText) {
            return;
        }

        // Localiza a sala à qual o socket pertence
        for (const [roomCode, room] of rooms.entries()) {

            if (room.host === socket.id || room.viewer === socket.id) {

                const isHost = room.host === socket.id;
                const senderName = isHost ? room.hostName : room.viewerName;

                const time = new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                });

                io.to(roomCode).emit("chat-message", {
                    senderId: socket.id,
                    senderName: senderName || (isHost ? "Host" : "Amigo"),
                    isHost,
                    text: cleanText,
                    time
                });

                break;
            }
        }
    });


    // Desconexão
    socket.on("disconnect", () => {

        console.log(`Usuário desconectado: ${socket.id}`);

        removeUserFromRoom(socket, true);
    });

});

server.listen(PORT, () => {
    console.log(`Concord rodando em http://localhost:${PORT}`);
});