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

const PORT = 3000;

// Servir arquivos da pasta public
app.use(express.static(path.join(__dirname, "../public")));

// Armazena as salas em memória
const rooms = new Map();

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "GameShare Server"
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

io.on("connection", (socket) => {

    console.log(`Usuário conectado: ${socket.id}`);

    // Criar sala
    socket.on("create-room", () => {

        let roomCode;

        do {
            roomCode = generateRoomCode();
        } while (rooms.has(roomCode));

        rooms.set(roomCode, {
            host: socket.id,
            viewer: null
        });

        socket.join(roomCode);

        console.log(`Sala criada: ${roomCode}`);

        socket.emit("room-created", roomCode);
    });


    // Entrar em sala
    socket.on("join-room", (roomCode) => {

        roomCode = roomCode.toUpperCase().trim();

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

        socket.join(roomCode);

        console.log(`Usuário ${socket.id} entrou na sala ${roomCode}`);

        socket.emit("room-joined", roomCode);

        // Avisar o host que alguém entrou
        io.to(room.host).emit("viewer-joined");
    });

        // ========================================
    // WEBRTC OFFER
    // ========================================

    socket.on("webrtc-offer", (offer) => {

        console.log("Oferta WebRTC recebida.");

        for (const [roomCode, room] of rooms.entries()) {

            if (room.host === socket.id) {

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

            if (room.host === socket.id) {

                io.to(room.viewer).emit("webrtc-candidate", candidate);

                break;
            }

            if (room.viewer === socket.id) {

                io.to(room.host).emit("webrtc-candidate", candidate);

                break;
            }
        }
    });

    // Desconexão
    socket.on("disconnect", () => {

        console.log(`Usuário desconectado: ${socket.id}`);

        for (const [roomCode, room] of rooms.entries()) {

            if (room.host === socket.id) {

                rooms.delete(roomCode);

                console.log(`Sala ${roomCode} removida.`);

            } else if (room.viewer === socket.id) {

                room.viewer = null;

                io.to(room.host).emit("viewer-left");

            }
        }
    });

});

server.listen(PORT, () => {
    console.log(`Concord rodando em http://localhost:${PORT}`);
});