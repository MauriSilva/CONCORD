const socket = io(CONFIG.SOCKET_SERVER);

// ===============================
// ELEMENTOS DA INTERFACE
// ===============================

const createRoomButton = document.getElementById("createRoom");
const joinRoomButton = document.getElementById("joinRoom");
const roomCodeInput = document.getElementById("roomCode");
const status = document.getElementById("status");

const createSection = document.getElementById("createSection");
const joinSection = document.getElementById("joinSection");
const roomSection = document.getElementById("roomSection");
const appContainer = document.querySelector(".app");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const copyRoomCodeButton = document.getElementById("copyRoomCode");
const participantsBadge = document.getElementById("participantsBadge");
const streamStatusBadge = document.getElementById("streamStatusBadge");

// Palco e Vídeo
const statsBar = document.getElementById("statsBar");
const resolution = document.getElementById("resolution");
const fps = document.getElementById("fps");
const bitrate = document.getElementById("bitrate");

const videoContainer = document.getElementById("videoContainer");
const remoteVideo = document.getElementById("remoteVideo");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const fullscreenButton = document.getElementById("fullscreenButton");

// Controles de Transmissão
const streamControls = document.getElementById("streamControls");
const streamRoleHint = document.getElementById("streamRoleHint");
const streamQualitySelect = document.getElementById("streamQuality");
const streamModeSelect = document.getElementById("streamMode");
const startStreamBtn = document.getElementById("startStreamBtn");
const stopStreamBtn = document.getElementById("stopStreamBtn");
const streamHelpText = document.getElementById("streamHelpText");

// Chat
const chatSection = document.getElementById("chatSection");
const chatParticipants = document.getElementById("chatParticipants");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

// Sair da sala
const leaveRoomButton = document.getElementById("leaveRoom");

// Perfil do Usuário
const profileSection = document.getElementById("profileSection");
const usernameInput = document.getElementById("usernameInput");
const usernameSavedBadge = document.getElementById("usernameSavedBadge");

// ===============================
// FRASES DE BOAS-VINDAS
// ===============================
const frases = [
    "deixa eu compartilhar minha tela Discord AAA",
    "isso aqui ta funcionando?...",
    "como você encontrou esse site?",
    "devolve meu compartilhamento de tela Discord!",
    "mano eu to ouvindo minha voz...",
    "eu nem sei o que eu to fazendo",
    "Discord caiu? problema de vocês.",
    "funciona na minha máquina.",
    "não encosta que tá funcionando.",
    "1080p de pura gambiarra.",
    "feito com ódio e JavaScript.",
    "se fechar a aba perde tudo.",
    "o importante é que abriu.",
    "WebRTC, minha última esperança.",
    "sem anúncios, sem Nitro, sem vergonha."
];

function mostrarFraseAoCarregar() {
    const container = document.getElementById("container-frase");
    if (container) {
        const indiceAleatorio = Math.floor(Math.random() * frases.length);
        container.innerText = frases[indiceAleatorio];
    }
}
window.onload = mostrarFraseAoCarregar;

// ========================================
// GERENCIAMENTO DO NOME DE USUÁRIO
// ========================================
const USERNAME_STORAGE_KEY = "concord_username";

function getStoredUsername() {
    let stored = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (!stored || !stored.trim()) {
        stored = "Participante";
        localStorage.setItem(USERNAME_STORAGE_KEY, stored);
    }
    return stored.trim();
}

let currentUsername = getStoredUsername();

if (usernameInput) {
    usernameInput.value = currentUsername;

    let saveTimeout = null;
    usernameInput.addEventListener("input", () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const val = usernameInput.value.trim().slice(0, 20);
            if (val) {
                currentUsername = val;
                localStorage.setItem(USERNAME_STORAGE_KEY, val);

                if (usernameSavedBadge) {
                    usernameSavedBadge.classList.remove("hidden");
                    setTimeout(() => {
                        usernameSavedBadge.classList.add("hidden");
                    }, 1500);
                }
            }
        }, 300);
    });
}

// ========================================
// ESTADO DA SALA E DO WEBRTC
// ========================================
let currentRoomCode = null;
let myId = null;
let roomParticipants = []; // [{ id, name }]
let currentStreamerId = null;
let isBroadcasting = false;

// Estado de Transmissão (quando este usuário está transmitindo)
let localStream = null;
const peerConnections = new Map(); // viewerId -> RTCPeerConnection
const pendingCandidatesMap = new Map(); // viewerId -> Array<candidate>

// Estado de Visualização (quando este usuário está assistindo)
let receiverPc = null;
let pendingReceiverCandidates = [];
let statsInterval = null;
let previousBytesReceived = 0;
let previousTimestamp = 0;

// Configuração de Qualidade e Modo
const STREAM_QUALITIES = {
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 }
};
const TARGET_FRAME_RATE = 30;
const BITRATES = {
    "720p": 3_500_000,
    "1080p": 7_000_000
};
const STREAM_MODES = {
    gaming: {
        contentHint: "motion",
        degradationPreference: "maintain-framerate"
    },
    detail: {
        contentHint: "detail",
        degradationPreference: "maintain-resolution"
    }
};

function getSelectedQuality() {
    return STREAM_QUALITIES[streamQualitySelect.value] || STREAM_QUALITIES["720p"];
}

function getSelectedMode() {
    return STREAM_MODES[streamModeSelect?.value] || STREAM_MODES.gaming;
}

// ========================================
// ATUALIZAÇÃO VISUAL DA INTERFACE DA SALA
// ========================================
function updateRoomUI() {
    if (!currentRoomCode) return;

    // Badges do cabeçalho
    const count = roomParticipants.length;
    if (participantsBadge) {
        participantsBadge.textContent = `👥 ${count}/5`;
    }

    if (chatParticipants) {
        chatParticipants.textContent = `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
    }

    if (isBroadcasting) {
        // Usuário local está transmitindo
        streamStatusBadge.className = "badge badge-live";
        streamStatusBadge.textContent = "🔴 Você está transmitindo";

        startStreamBtn.classList.add("hidden");
        stopStreamBtn.classList.remove("hidden");

        const viewersCount = Math.max(0, count - 1);
        streamRoleHint.textContent = `Transmitindo para ${viewersCount} ${viewersCount === 1 ? "amigo" : "amigos"}`;
        videoPlaceholder.textContent = "Você está transmitindo sua tela para a sala.";
        statsBar.classList.add("hidden");
    } else if (currentStreamerId) {
        // Outro usuário está transmitindo
        const streamer = roomParticipants.find(p => p.id === currentStreamerId);
        const streamerName = streamer ? streamer.name : "Alguém";

        streamStatusBadge.className = "badge badge-live";
        streamStatusBadge.textContent = `🟢 ${streamerName} transmitindo`;

        startStreamBtn.classList.remove("hidden");
        startStreamBtn.disabled = true;
        startStreamBtn.title = "Aguarde a transmissão atual terminar para transmitir.";
        stopStreamBtn.classList.add("hidden");

        streamRoleHint.textContent = `${streamerName} está transmitindo`;
        videoPlaceholder.textContent = `Conectando à transmissão de ${streamerName}...`;
    } else {
        // Ninguém está transmitindo
        streamStatusBadge.className = "badge badge-idle";
        streamStatusBadge.textContent = "⚪ Ninguém transmitindo";

        startStreamBtn.classList.remove("hidden");
        startStreamBtn.disabled = false;
        startStreamBtn.title = "";
        stopStreamBtn.classList.add("hidden");

        streamRoleHint.textContent = "Livre para transmitir";
        videoPlaceholder.textContent = "Aguardando transmissão...";
        statsBar.classList.add("hidden");
    }
}

// ========================================
// CHAT DA SALA
// ========================================
function appendChatMessage({ senderName, isMe, isStreamer = false, text, time, isSystem = false }) {
    if (!chatMessages) return;

    const emptyHint = chatMessages.querySelector(".chat-empty-hint");
    if (emptyHint) {
        emptyHint.remove();
    }

    if (isSystem) {
        const sysDiv = document.createElement("div");
        sysDiv.className = "chat-msg chat-msg-system";
        sysDiv.textContent = `🟡 ${text}`;
        chatMessages.appendChild(sysDiv);
    } else {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${isMe ? "chat-msg-me" : "chat-msg-other"}`;

        const headerDiv = document.createElement("div");
        headerDiv.className = "chat-msg-header";

        const authorSpan = document.createElement("span");
        authorSpan.className = "chat-msg-author";
        authorSpan.textContent = isMe ? "Você" : senderName;
        if (isStreamer) {
            authorSpan.textContent += " 🎥";
        }

        const timeSpan = document.createElement("span");
        timeSpan.className = "chat-msg-time";
        timeSpan.textContent = time;

        headerDiv.appendChild(authorSpan);
        headerDiv.appendChild(timeSpan);

        const textDiv = document.createElement("div");
        textDiv.className = "chat-msg-text";
        textDiv.textContent = text;

        msgDiv.appendChild(headerDiv);
        msgDiv.appendChild(textDiv);

        chatMessages.appendChild(msgDiv);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        socket.emit("send-chat-message", text);
        chatInput.value = "";
        chatInput.focus();
    });
}

socket.on("chat-message", (data) => {
    appendChatMessage({
        senderName: data.senderName,
        isMe: data.senderId === myId,
        isStreamer: data.isStreamer,
        text: data.text,
        time: data.time
    });
});

socket.on("chat-system-message", (text) => {
    appendChatMessage({
        text,
        isSystem: true
    });
});

// ========================================
// TELA CHEIA DO PLAYER
// ========================================
fullscreenButton.addEventListener("click", async () => {
    try {
        if (!document.fullscreenElement) {
            await videoContainer.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (error) {
        console.error("Não foi possível alterar a tela cheia:", error);
    }
});

document.addEventListener("fullscreenchange", () => {
    const isFullscreen = document.fullscreenElement === videoContainer;
    fullscreenButton.setAttribute(
        "aria-label",
        isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"
    );
    fullscreenButton.title = isFullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia";
});

// ========================================
// PREFERÊNCIA DE CODEC E PARÂMETROS WEBRTC
// ========================================
function preferCodec(pc, mimeType) {
    if (!pc) return;

    const transceiver = pc.getTransceivers()
        .find(t => t.sender.track?.kind === "video" || t.receiver.track?.kind === "video");

    if (!transceiver || typeof transceiver.setCodecPreferences !== "function") {
        return;
    }

    const capabilities =
        (RTCRtpSender.getCapabilities || RTCRtpReceiver.getCapabilities)?.call(
            RTCRtpSender.getCapabilities ? RTCRtpSender : RTCRtpReceiver,
            "video"
        );

    if (!capabilities?.codecs) return;

    const target = mimeType.toLowerCase();
    const preferred = capabilities.codecs.filter(c => c.mimeType.toLowerCase() === target);
    const rest = capabilities.codecs.filter(c => c.mimeType.toLowerCase() !== target);

    if (preferred.length > 0) {
        try {
            transceiver.setCodecPreferences([...preferred, ...rest]);
            console.log(`Preferência de codec configurada para: ${mimeType}`);
        } catch (error) {
            console.warn("Não foi possível aplicar preferências de codec:", error);
        }
    }
}

async function updateSenderBitrate(pc, bitrateValue) {
    if (!pc) return;
    const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
    if (!videoSender) return;

    try {
        const parameters = videoSender.getParameters();
        if (parameters.encodings && parameters.encodings.length > 0) {
            parameters.encodings[0].maxBitrate = bitrateValue;
            await videoSender.setParameters(parameters);
            console.log(`Bitrate atualizado para ${(bitrateValue / 1_000_000).toFixed(1)} Mbps`);
        }
    } catch (err) {
        console.warn("Não foi possível atualizar o bitrate dinamicamente:", err);
    }
}

async function updateSenderMode(pc, mode) {
    if (!pc) return;
    const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
    if (!videoSender) return;

    try {
        const parameters = videoSender.getParameters();
        parameters.degradationPreference = mode.degradationPreference;
        await videoSender.setParameters(parameters);
        console.log(`Modo de degradação atualizado para: ${mode.degradationPreference}`);
    } catch (err) {
        console.warn("Não foi possível atualizar o modo de degradação dinamicamente:", err);
    }
}

async function applyStreamQuality(videoTrack) {
    const quality = getSelectedQuality();
    await videoTrack.applyConstraints({
        width: { ideal: quality.width, max: quality.width },
        height: { ideal: quality.height, max: quality.height },
        frameRate: { ideal: TARGET_FRAME_RATE, max: TARGET_FRAME_RATE }
    });
}

// Mudança dinâmica de qualidade durante a transmissão
streamQualitySelect.addEventListener("change", async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        try {
            await applyStreamQuality(videoTrack);
        } catch (err) {
            console.warn("Erro ao mudar resolução ao vivo:", err);
        }
    }

    const bitValue = BITRATES[streamQualitySelect.value] || BITRATES["720p"];
    for (const pc of peerConnections.values()) {
        await updateSenderBitrate(pc, bitValue);
    }
});

// Mudança dinâmica de modo durante a transmissão
if (streamModeSelect) {
    streamModeSelect.addEventListener("change", async () => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        const mode = getSelectedMode();
        if (videoTrack) {
            videoTrack.contentHint = mode.contentHint;
        }
        for (const pc of peerConnections.values()) {
            await updateSenderMode(pc, mode);
        }
    });
}

// ========================================
// TRANSMISSÃO: CRIAÇÃO DE PEER CONNECTION PARA UM VIEWER
// ========================================
async function createPeerConnectionForViewer(viewerId) {
    console.log(`Criando conexão WebRTC com o espectador: ${viewerId}`);

    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peerConnections.set(viewerId, pc);
    pendingCandidatesMap.set(viewerId, []);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("webrtc-candidate", {
                targetId: viewerId,
                candidate: event.candidate
            });
        }
    };

    pc.onconnectionstatechange = () => {
        console.log(`Conexão com ${viewerId}: ${pc.connectionState}`);
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            // Tentativa de reconexão se necessário
        }
    };

    // Adiciona as faixas da captura de tela
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // Configura parâmetros de codificação de vídeo
    const mode = getSelectedMode();
    const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
    if (videoSender) {
        try {
            const parameters = videoSender.getParameters();
            if (parameters.encodings && parameters.encodings.length > 0) {
                parameters.encodings[0].maxFramerate = TARGET_FRAME_RATE;
                parameters.encodings[0].maxBitrate =
                    BITRATES[streamQualitySelect.value] || BITRATES["720p"];
                parameters.encodings[0].networkPriority = "high";
                parameters.encodings[0].priority = "high";
            }
            parameters.degradationPreference = mode.degradationPreference;
            await videoSender.setParameters(parameters);
        } catch (err) {
            console.warn("Aviso ao configurar parâmetros de vídeo:", err);
        }
    }

    // Configura áudio (128 kbps estável)
    const audioSender = pc.getSenders().find(s => s.track?.kind === "audio");
    if (audioSender) {
        try {
            const audioParams = audioSender.getParameters();
            if (audioParams.encodings && audioParams.encodings.length > 0) {
                audioParams.encodings[0].maxBitrate = 128_000;
                audioParams.encodings[0].networkPriority = "high";
                audioParams.encodings[0].priority = "high";
            }
            await audioSender.setParameters(audioParams);
        } catch (err) {
            console.warn("Aviso ao configurar parâmetros de áudio:", err);
        }
    }

    preferCodec(pc, "video/H264");

    // Cria a oferta WebRTC e envia ao espectador
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await updateSenderBitrate(
            pc,
            BITRATES[streamQualitySelect.value] || BITRATES["720p"]
        );

        socket.emit("webrtc-offer", {
            targetId: viewerId,
            offer
        });
        console.log(`Oferta WebRTC enviada para ${viewerId}`);
    } catch (err) {
        console.error(`Erro ao criar oferta para ${viewerId}:`, err);
    }

    return pc;
}

// ========================================
// INICIAR E PARAR TRANSMISSÃO (BROADCASTER)
// ========================================
startStreamBtn.addEventListener("click", async () => {
    if (currentStreamerId && currentStreamerId !== myId) {
        alert("Já existe uma transmissão ativa nesta sala.");
        return;
    }

    try {
        const quality = getSelectedQuality();
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: quality.width },
                height: { ideal: quality.height },
                frameRate: { ideal: TARGET_FRAME_RATE, max: TARGET_FRAME_RATE }
            },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) {
            throw new Error("Nenhuma faixa de vídeo encontrada.");
        }

        const mode = getSelectedMode();
        videoTrack.contentHint = mode.contentHint;

        try {
            await applyStreamQuality(videoTrack);
        } catch (err) {
            console.warn("Aviso ao aplicar qualidade:", err);
        }

        videoTrack.addEventListener("ended", () => {
            stopBroadcasting();
        });

        isBroadcasting = true;
        currentStreamerId = myId;

        // Notifica o servidor para atualizar o estado da sala
        socket.emit("start-stream");

        // Cria conexões para todos os outros participantes da sala
        const viewers = roomParticipants.filter(p => p.id !== myId);
        for (const viewer of viewers) {
            await createPeerConnectionForViewer(viewer.id);
        }

        updateRoomUI();
    } catch (error) {
        console.error("Erro ao iniciar transmissão:", error);
        stopBroadcasting();
    }
});

stopStreamBtn.addEventListener("click", () => {
    stopBroadcasting();
});

function stopBroadcasting() {
    if (!isBroadcasting && !localStream) return;

    console.log("Encerrando transmissão...");
    isBroadcasting = false;

    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }

    for (const pc of peerConnections.values()) {
        try {
            pc.close();
        } catch (e) {}
    }
    peerConnections.clear();
    pendingCandidatesMap.clear();

    if (currentStreamerId === myId) {
        currentStreamerId = null;
        socket.emit("stop-stream");
    }

    updateRoomUI();
}

// ========================================
// VISUALIZADOR: RECONHECIMENTO DE OFERTA E RECEPÇÃO DO STREAM
// ========================================
function createReceiverPeerConnection(streamerId) {
    if (receiverPc) {
        try {
            receiverPc.close();
        } catch (e) {}
    }

    pendingReceiverCandidates = [];

    receiverPc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    receiverPc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("webrtc-candidate", {
                targetId: streamerId,
                candidate: event.candidate
            });
        }
    };

    receiverPc.ontrack = (event) => {
        console.log("Faixa recebida do transmissor:", event.track.kind);
        const stream = event.streams[0];

        if (remoteVideo.srcObject !== stream) {
            remoteVideo.srcObject = stream;
            remoteVideo.muted = false;
            remoteVideo.volume = 1;

            remoteVideo.play().catch(err => {
                if (err.name !== "AbortError") {
                    console.error("Erro ao dar play no vídeo:", err);
                }
            });
        }

        videoPlaceholder.classList.add("hidden");
        statsBar.classList.remove("hidden");

        previousBytesReceived = 0;
        previousTimestamp = 0;

        if (!statsInterval) {
            statsInterval = setInterval(updateStats, 1000);
        }
    };

    receiverPc.onconnectionstatechange = () => {
        console.log("Receiver connection state:", receiverPc.connectionState);
    };

    return receiverPc;
}

async function processPendingReceiverCandidates() {
    if (!receiverPc || !receiverPc.remoteDescription || !receiverPc.remoteDescription.type) {
        return;
    }
    while (pendingReceiverCandidates.length > 0) {
        const candidate = pendingReceiverCandidates.shift();
        try {
            await receiverPc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.warn("Erro ao aplicar ICE candidate pendente no receiver:", err);
        }
    }
}

// ========================================
// ESTATÍSTICAS DA TRANSMISSÃO (RECEIVER)
// ========================================
async function updateStats() {
    if (!receiverPc) return;

    try {
        const stats = await receiverPc.getStats();
        let videoStats = null;

        stats.forEach(report => {
            if (report.type === "inbound-rtp" && report.kind === "video") {
                videoStats = report;
            }
        });

        if (!videoStats) return;

        const currentFPS = videoStats.framesPerSecond || 0;
        const width = videoStats.frameWidth || 0;
        const height = videoStats.frameHeight || 0;
        const bytesReceived = videoStats.bytesReceived || 0;
        const timestamp = videoStats.timestamp;

        let currentBitrate = 0;
        if (previousTimestamp !== 0) {
            const bytesDiff = bytesReceived - previousBytesReceived;
            const timeDiff = timestamp - previousTimestamp;
            if (timeDiff > 0) {
                currentBitrate = (bytesDiff * 8) / (timeDiff / 1000);
            }
        }

        previousBytesReceived = bytesReceived;
        previousTimestamp = timestamp;

        resolution.textContent = width && height ? `${width} × ${height}` : "--";
        fps.textContent = currentFPS ? Math.round(currentFPS) : "--";
        bitrate.textContent = currentBitrate
            ? `${(currentBitrate / 1_000_000).toFixed(2)} Mbps`
            : "--";
    } catch (err) {
        console.warn("Erro ao ler estatísticas:", err);
    }
}

function stopReceivingStream() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }

    if (receiverPc) {
        try {
            receiverPc.close();
        } catch (e) {}
        receiverPc = null;
    }

    pendingReceiverCandidates = [];
    remoteVideo.pause();
    remoteVideo.srcObject = null;
    remoteVideo.load();

    videoPlaceholder.classList.remove("hidden");
    videoPlaceholder.textContent = "Aguardando transmissão...";
    statsBar.classList.add("hidden");

    resolution.textContent = "--";
    fps.textContent = "--";
    bitrate.textContent = "--";
    previousBytesReceived = 0;
    previousTimestamp = 0;
}

// ========================================
// ROTAS DE SINALIZAÇÃO WEBRTC (OFFER, ANSWER, CANDIDATE)
// ========================================

// Recebimento de Oferta (como Espectador)
socket.on("webrtc-offer", async ({ fromId, offer }) => {
    console.log(`Oferta WebRTC recebida de ${fromId}`);
    if (isBroadcasting) {
        console.warn("Ignorando oferta pois já sou o transmissor.");
        return;
    }

    currentStreamerId = fromId;
    updateRoomUI();

    const pc = createReceiverPeerConnection(fromId);

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await processPendingReceiverCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
            targetId: fromId,
            answer
        });
        console.log(`Resposta WebRTC enviada para ${fromId}`);
    } catch (err) {
        console.error("Erro ao responder oferta WebRTC:", err);
    }
});

// Recebimento de Resposta (como Transmissor)
socket.on("webrtc-answer", async ({ fromId, answer }) => {
    console.log(`Resposta WebRTC recebida de ${fromId}`);
    const pc = peerConnections.get(fromId);
    if (!pc) return;

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Processa candidatos pendentes
        const pending = pendingCandidatesMap.get(fromId) || [];
        while (pending.length > 0) {
            const cand = pending.shift();
            try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
                console.warn(`Erro ao aplicar candidate para ${fromId}:`, err);
            }
        }
    } catch (err) {
        console.error(`Erro ao aplicar resposta de ${fromId}:`, err);
    }
});

// Recebimento de ICE Candidate
socket.on("webrtc-candidate", async ({ fromId, candidate }) => {
    if (isBroadcasting) {
        // Transmissor recebendo do espectador
        const pc = peerConnections.get(fromId);
        if (!pc) return;

        if (!pc.remoteDescription || !pc.remoteDescription.type) {
            const list = pendingCandidatesMap.get(fromId) || [];
            list.push(candidate);
            pendingCandidatesMap.set(fromId, list);
            return;
        }

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.error(`Erro ao adicionar candidate de ${fromId}:`, err);
        }
    } else {
        // Espectador recebendo do transmissor
        if (!receiverPc || !receiverPc.remoteDescription || !receiverPc.remoteDescription.type) {
            pendingReceiverCandidates.push(candidate);
            return;
        }

        try {
            await receiverPc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.error("Erro ao adicionar candidate no receiver:", err);
        }
    }
});

// ========================================
// EVENTOS DE SALA (SOCKET.IO)
// ========================================

// Criar Sala
createRoomButton.addEventListener("click", () => {
    socket.emit("create-room", {
        username: getStoredUsername()
    });
});

// Entrar em Sala
joinRoomButton.addEventListener("click", () => {
    const code = roomCodeInput.value.trim();
    if (!code) {
        status.textContent = "Digite um código de sala.";
        return;
    }
    status.textContent = "";
    socket.emit("join-room", {
        roomCode: code,
        username: getStoredUsername()
    });
});

// Copiar Código da Sala
copyRoomCodeButton.addEventListener("click", async () => {
    if (!currentRoomCode) return;
    await navigator.clipboard.writeText(currentRoomCode);
    copyRoomCodeButton.textContent = "Copiado!";
    setTimeout(() => {
        copyRoomCodeButton.textContent = "Copiar";
    }, 1500);
});

// Resposta: Entrou / Criou Sala com Sucesso
socket.on("room-joined", (data) => {
    currentRoomCode = data.roomCode;
    roomParticipants = data.participants || [];
    currentStreamerId = data.currentStreamer || null;
    myId = data.myId || socket.id;

    roomCodeDisplay.textContent = currentRoomCode;

    // Transição de tela
    createSection.classList.add("hidden");
    joinSection.classList.add("hidden");
    if (profileSection) profileSection.classList.add("hidden");

    roomSection.classList.remove("hidden");
    if (appContainer) appContainer.classList.add("in-room");

    chatMessages.innerHTML = '<div class="chat-empty-hint">Nenhuma mensagem ainda. Diga oi para o grupo!</div>';

    updateRoomUI();
});

// Outro usuário entrou na sala
socket.on("user-joined", async (data) => {
    console.log(`${data.name} entrou na sala.`);
    roomParticipants = data.participants || [];
    currentStreamerId = data.currentStreamer || currentStreamerId;

    updateRoomUI();

    // Se EU estou transmitindo tela, crio dinamicamente uma oferta para quem acabou de entrar!
    if (isBroadcasting && localStream) {
        console.log(`Enviando transmissão automaticamente para o novo membro: ${data.name} (${data.id})`);
        await createPeerConnectionForViewer(data.id);
    }
});

// Outro usuário saiu da sala
socket.on("user-left", (data) => {
    console.log(`${data.name} saiu da sala.`);
    roomParticipants = data.participants || [];

    // Se EU estou transmitindo, limpo a conexão com esse espectador
    if (isBroadcasting && peerConnections.has(data.id)) {
        const pc = peerConnections.get(data.id);
        try { pc.close(); } catch (e) {}
        peerConnections.delete(data.id);
        pendingCandidatesMap.delete(data.id);
    }

    // Se quem saiu era o streamer
    if (currentStreamerId === data.id) {
        currentStreamerId = null;
        stopReceivingStream();
    }

    updateRoomUI();
});

// Alguém começou a transmitir
socket.on("stream-started", (data) => {
    console.log(`${data.streamerName} iniciou uma transmissão.`);
    currentStreamerId = data.streamerId;
    updateRoomUI();
});

// Transmissão foi encerrada
socket.on("stream-stopped", () => {
    console.log("A transmissão foi encerrada.");
    currentStreamerId = null;

    if (isBroadcasting) {
        stopBroadcasting();
    } else {
        stopReceivingStream();
    }

    updateRoomUI();
});

// Erro de sala ou transmissão
socket.on("room-error", (msg) => {
    status.textContent = msg;
});

socket.on("stream-error", (msg) => {
    alert(msg);
});

// ========================================
// SAIR DA SALA
// ========================================
leaveRoomButton.addEventListener("click", () => {
    if (!currentRoomCode) return;
    socket.emit("leave-room");
    resetRoomInterface("Você saiu da sala.");
});

function resetRoomInterface(message = "") {
    console.log("Limpando interface e saindo da sala...");

    if (isBroadcasting) {
        stopBroadcasting();
    }
    stopReceivingStream();

    currentRoomCode = null;
    currentStreamerId = null;
    isBroadcasting = false;
    roomParticipants = [];

    roomCodeDisplay.textContent = "--------";
    roomCodeInput.value = "";
    chatMessages.innerHTML = "";
    chatInput.value = "";

    roomSection.classList.add("hidden");
    createSection.classList.remove("hidden");
    joinSection.classList.remove("hidden");
    if (profileSection) profileSection.classList.remove("hidden");
    if (appContainer) appContainer.classList.remove("in-room");

    status.textContent = message;

    if (document.fullscreenElement === videoContainer) {
        document.exitFullscreen().catch(() => {});
    }
}

// Conexão Socket.IO
socket.on("connect", () => {
    myId = socket.id;
    console.log(`Conectado ao servidor! ID: ${myId}`);
});

socket.on("disconnect", () => {
    console.log("Desconectado do servidor.");
});
