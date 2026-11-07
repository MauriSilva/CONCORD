const socket = io(
    CONFIG.SOCKET_SERVER
);


// ===============================
// ELEMENTOS DA INTERFACE
// ===============================

const createRoomButton =
    document.getElementById("createRoom");

const joinRoomButton =
    document.getElementById("joinRoom");

const roomCodeInput =
    document.getElementById("roomCode");

const status =
    document.getElementById("status");

const createSection =
    document.getElementById("createSection");

const hostSection =
    document.getElementById("hostSection");

const hostLayout =
    document.getElementById("hostLayout");

const joinSection =
    document.getElementById("joinSection");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const copyRoomCodeButton =
    document.getElementById("copyRoomCode");

const hostStatus =
    document.getElementById("hostStatus");

const shareScreenButton =
    document.getElementById("shareScreen");

const stopSharingButton =
    document.getElementById("stopSharing");

const streamQualitySelect =
    document.getElementById("streamQuality");

const streamModeSelect =
    document.getElementById("streamMode");

const viewerSection =
    document.getElementById("viewerSection");

const connectionStatus =
    document.getElementById("connectionStatus");

const remoteVideo =
    document.getElementById("remoteVideo");

const videoContainer =
    document.getElementById("videoContainer");

const fullscreenButton =
    document.getElementById("fullscreenButton");

const videoPlaceholder =
    document.getElementById("videoPlaceholder");

const resolution =
    document.getElementById("resolution");

const fps =
    document.getElementById("fps");

const bitrate =
    document.getElementById("bitrate");

const leaveRoomButton =
    document.getElementById("leaveRoom");

// Perfil de Usuário
const profileSection =
    document.getElementById("profileSection");

const usernameInput =
    document.getElementById("usernameInput");

const usernameSavedBadge =
    document.getElementById("usernameSavedBadge");

// Chat da Sala
const chatSection =
    document.getElementById("chatSection");

const chatMessages =
    document.getElementById("chatMessages");

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const chatParticipants =
    document.getElementById("chatParticipants");

const streamLayout =
    document.getElementById("streamLayout");

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
    const indiceAleatorio = Math.floor(Math.random() * frases.length);

    // Seleciona a div pelo ID e injeta o texto da frase sorteada
    document.getElementById("container-frase").innerText = frases[indiceAleatorio];
}

window.onload = mostrarFraseAoCarregar;

// ========================================
// GERENCIAMENTO DO NOME DE USUÁRIO
// ========================================

const USERNAME_STORAGE_KEY = "concord_username";

function getStoredUsername() {
    let stored = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (!stored || !stored.trim()) {
        stored = `*Digite seu nome aqui*`;
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
// CHAT DA SALA (SOCKET.IO)
// ========================================

function appendChatMessage({ senderName, isMe, text, time, isSystem = false }) {
    if (!chatMessages) return;

    // Remover dica vazia se houver
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

    // Rola automaticamente para a última mensagem
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
    const isMe = data.senderId === socket.id;
    appendChatMessage({
        senderName: data.senderName,
        isMe,
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

        console.error(
            "Não foi possível alterar a tela cheia:",
            error
        );

    }

});


document.addEventListener("fullscreenchange", () => {

    const isFullscreen =
        document.fullscreenElement === videoContainer;

    fullscreenButton.setAttribute(
        "aria-label",
        isFullscreen
            ? "Sair da tela cheia"
            : "Entrar em tela cheia"
    );

    fullscreenButton.title =
        isFullscreen
            ? "Sair da tela cheia (Esc)"
            : "Tela cheia";

});


// ========================================
// CONFIGURAÇÃO WEBRTC
// ========================================

let peerConnection = null;

function createPeerConnection() {

    const pc = new RTCPeerConnection({

        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]

    });


    pc.onicecandidate = (event) => {

        if (event.candidate) {

            socket.emit(
                "webrtc-candidate",
                event.candidate
            );

        }

    };


    pc.onconnectionstatechange = () => {

        console.log(
            "Connection state:",
            pc.connectionState
        );

    };


    pc.ontrack = (event) => {

        const stream = event.streams[0];

        // ontrack dispara uma vez por track (áudio e vídeo);
        // só configura o player na primeira vez para esse stream.
        if (remoteVideo.srcObject !== stream) {

            remoteVideo.srcObject = stream;
            remoteVideo.muted = false;
            remoteVideo.volume = 1;

            remoteVideo.play().catch((error) => {

                if (error.name === "AbortError") {
                    return;
                }

                console.error(
                    "Erro ao iniciar vídeo:",
                    error
                );

            });

        }

        videoPlaceholder.classList.add("hidden");

        connectionStatus.textContent =
            "🟢 Conectado";


        previousBytesReceived = 0;
        previousTimestamp = 0;

        if (!statsInterval) {

            statsInterval = setInterval(
                updateStats,
                1000
            );

        }
        startViewerDiagnostics();
    };


    return pc;

}


if (!peerConnection) {

    peerConnection = createPeerConnection();

}


let localStream = null;

let isHost = false;

let currentRoomCode = null;

let statsInterval = null;

let previousBytesReceived = 0;

let previousTimestamp = 0;

let pendingIceCandidates = [];

async function processPendingIceCandidates() {

    if (!peerConnection || !peerConnection.remoteDescription || !peerConnection.remoteDescription.type) {
        return;
    }

    while (pendingIceCandidates.length > 0) {
        const candidate = pendingIceCandidates.shift();
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("ICE candidate pendente aplicado com sucesso.");
        } catch (error) {
            console.warn("Erro ao aplicar ICE candidate pendente:", error);
        }
    }

}


// ========================================
// QUALIDADE DA TRANSMISSÃO
// ========================================

const STREAM_QUALITIES = {

    "720p": {
        width: 1280,
        height: 720
    },

    "1080p": {
        width: 1920,
        height: 1080
    }

};

const TARGET_FRAME_RATE = 30;

const BITRATES = {
    "720p": 3_500_000,
    "1080p": 7_000_000
};

function getSelectedQuality() {

    return STREAM_QUALITIES[
        streamQualitySelect.value
    ] || STREAM_QUALITIES["720p"];

}

// ========================================
// PROPÓSITO / MODO DA TRANSMISSÃO
// ========================================

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

function getSelectedMode() {
    return STREAM_MODES[streamModeSelect?.value] || STREAM_MODES.gaming;
}

// ========================================
// ATUALIZAR BITRATE E PARÂMETROS AO VIVO
// ========================================

async function updateSenderBitrate(pc, bitrateValue) {
    if (!pc) return;
    const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
    if (!videoSender) return;

    try {
        const parameters = videoSender.getParameters();
        if (parameters.encodings && parameters.encodings.length > 0) {
            parameters.encodings[0].maxBitrate = bitrateValue;
            await videoSender.setParameters(parameters);
            console.log(`Bitrate atualizado dinamicamente para ${(bitrateValue / 1_000_000).toFixed(1)} Mbps`);
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

        width: {
            ideal: quality.width,
            max: quality.width
        },

        height: {
            ideal: quality.height,
            max: quality.height
        },

        frameRate: {
            ideal: TARGET_FRAME_RATE,
            max: TARGET_FRAME_RATE
        }

    });

    console.log(
        `Qualidade solicitada: ${quality.width} × ${quality.height}`,
        videoTrack.getSettings()
    );

}


// Alterar qualidade durante a transmissão

streamQualitySelect.addEventListener("change", async () => {

    if (!localStream) {
        return;
    }

    const videoTrack =
        localStream.getVideoTracks()[0];

    if (!videoTrack) {
        return;
    }

    try {

        await applyStreamQuality(videoTrack);
        await updateSenderBitrate(
            peerConnection,
            BITRATES[streamQualitySelect.value] || BITRATES["720p"]
        );

        hostStatus.textContent =
            "🟢 Qualidade da transmissão atualizada!";

    } catch (error) {

        console.warn(
            "Não foi possível alterar a qualidade durante a transmissão:",
            error
        );

        hostStatus.textContent =
            "🟡 O navegador não permitiu alterar a resolução ao vivo. A transmissão continua normalmente.";

    }

});


// Alterar propósito da transmissão durante a transmissão

if (streamModeSelect) {

    streamModeSelect.addEventListener("change", async () => {

        if (!localStream) {
            return;
        }

        const videoTrack =
            localStream.getVideoTracks()[0];

        const mode = getSelectedMode();

        if (videoTrack) {
            videoTrack.contentHint = mode.contentHint;
        }

        await updateSenderMode(peerConnection, mode);

        hostStatus.textContent =
            "🟢 Modo de transmissão atualizado!";

    });

}


// ========================================
// CRIAR SALA
// ========================================

createRoomButton.addEventListener("click", () => {

    socket.emit("create-room", {
        username: getStoredUsername()
    });

});


// ========================================
// SALA CRIADA
// ========================================

socket.on("room-created", (data) => {

    isHost = true;

    const roomCode = (typeof data === "object" && data.roomCode)
        ? data.roomCode
        : data;

    currentRoomCode = roomCode;

    roomCodeDisplay.textContent = roomCode;

    leaveRoomButton.classList.remove("hidden");

    createSection.classList.add("hidden");

    joinSection.classList.add("hidden");

    if (profileSection) {
        profileSection.classList.add("hidden");
    }

    if (hostLayout) {
        hostLayout.classList.remove("hidden");
        if (chatSection) {
            hostLayout.appendChild(chatSection);
        }
    }

    hostSection.classList.remove("hidden");

    if (chatSection) {
        chatSection.classList.remove("hidden");
        chatMessages.innerHTML = '<div class="chat-empty-hint">Nenhuma mensagem ainda. Diga oi!</div>';
        if (chatParticipants) {
            chatParticipants.textContent = "Aguardando amigo...";
        }
    }

    hostStatus.textContent =
        "🟡 Aguardando seu amigo...";

});


copyRoomCodeButton.addEventListener("click", async () => {

    if (!currentRoomCode) {

        return;

    }


    await navigator.clipboard.writeText(
        currentRoomCode
    );


    copyRoomCodeButton.textContent =
        "Copiado!";


    setTimeout(() => {

        copyRoomCodeButton.textContent =
            "Copiar";

    }, 1500);

});


// ========================================
// ENTRAR NA SALA
// ========================================

joinRoomButton.addEventListener("click", () => {

    const roomCode = roomCodeInput.value.trim();


    if (!roomCode) {

        status.textContent =
            "Digite um código de sala.";

        return;

    }


    status.textContent =
        "";


    socket.emit("join-room", {
        roomCode,
        username: getStoredUsername()
    });

});


// ========================================
// ENTROU NA SALA
// ========================================

socket.on("room-joined", (data) => {

    const roomCode = (typeof data === "object" && data.roomCode)
        ? data.roomCode
        : data;

    currentRoomCode = roomCode;

    leaveRoomButton.classList.remove("hidden");

    joinSection.classList.add("hidden");

    createSection.classList.add("hidden");

    if (profileSection) {
        profileSection.classList.add("hidden");
    }

    viewerSection.classList.remove("hidden");

    // No viewer, coloca o chat ao lado do player na divisão 70/30
    if (streamLayout && chatSection) {
        streamLayout.appendChild(chatSection);
    }

    if (chatSection) {
        chatSection.classList.remove("hidden");
        chatMessages.innerHTML = '<div class="chat-empty-hint">Nenhuma mensagem ainda. Diga oi!</div>';
        if (chatParticipants) {
            const hostName = (typeof data === "object" && data.hostName) ? data.hostName : "Host";
            chatParticipants.textContent = `Você & ${hostName}`;
        }
    }

    connectionStatus.textContent =
        "🟡 Conectando...";

});

// ========================================
// EVENTO SAIR DA SALA
// ========================================

leaveRoomButton.addEventListener("click", () => {

    if (!currentRoomCode) {
        return;
    }
    socket.emit("leave-room");

    resetRoomInterface("Você saiu da sala.");

});


// ========================================
// ANFITRIÃO ENCERROU A SALA
// ========================================

socket.on("host-left", () => {

    resetRoomInterface("O host encerrou a sala.");

});


// ========================================
// VIEWER ENTROU
// ========================================

socket.on("viewer-joined", (data) => {

    console.log("Viewer conectado!");

    const viewerName = (data && data.viewerName) ? data.viewerName : "Seu amigo";

    hostStatus.textContent =
        `🟢 ${viewerName} está conectado!`;

    if (chatParticipants) {
        chatParticipants.textContent = `Você & ${viewerName}`;
    }

    shareScreenButton.classList.remove(
        "hidden"
    );

});


// ========================================
// COMPARTILHAR A TELA
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

    if (!capabilities?.codecs) {
        return;
    }

    const target = mimeType.toLowerCase();
    const preferred = capabilities.codecs.filter(c => c.mimeType.toLowerCase() === target);
    const rest = capabilities.codecs.filter(c => c.mimeType.toLowerCase() !== target);

    if (preferred.length > 0) {
        try {
            transceiver.setCodecPreferences([...preferred, ...rest]);
            console.log(`Preferencia de codec configurada para: ${mimeType}`);
        } catch (error) {
            console.warn("Não foi possível aplicar preferências de codec:", error);
        }
    }

}

shareScreenButton.addEventListener(
    "click",
    async () => {

        try {

            const captureQuality = getSelectedQuality();

            localStream =
                await navigator.mediaDevices.getDisplayMedia({

                    video: {

                        width: { ideal: captureQuality.width },

                        height: { ideal: captureQuality.height },

                        frameRate: {
                            ideal: TARGET_FRAME_RATE,
                            max: TARGET_FRAME_RATE
                        }

                    },

                    // Evita que o navegador processe o áudio do sistema
                    // como se fosse voz (o que deixa o som abafado).
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }

                });


            console.log(
                "Tela capturada!"
            );


            const videoTrack =
                localStream.getVideoTracks()[0];

            if (!videoTrack) {
                throw new Error("A captura não retornou uma faixa de vídeo.");
            }

            const mode = getSelectedMode();
            videoTrack.contentHint = mode.contentHint;


            // Tenta aplicar a qualidade selecionada.
            // Se falhar, mantém a captura padrão.

            try {

                await applyStreamQuality(videoTrack);

            } catch (qualityError) {

                console.warn(
                    "O navegador não conseguiu aplicar a resolução selecionada. A transmissão continuará com a configuração padrão:",
                    qualityError
                );

            }


            console.log(
                "Configuração atual da captura:",
                videoTrack.getSettings()
            );


            // Garante uma conexão estável antes de adicionar as tracks.

            if (peerConnection.signalingState !== "stable") {

                peerConnection.close();

                peerConnection =
                    createPeerConnection();

            }


            localStream
                .getTracks()
                .forEach(track => {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                });


            const videoSender =
                peerConnection
                    .getSenders()
                    .find(
                        sender =>
                            sender.track?.kind === "video"
                    );


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
                    console.log("Parâmetros de encoding configurados com sucesso:", parameters);

                } catch (paramError) {

                    console.warn(
                        "Não foi possível aplicar parâmetros avançados de encoding:",
                        paramError
                    );

                }

            }


            const audioSender =
                peerConnection
                    .getSenders()
                    .find(
                        sender =>
                            sender.track?.kind === "audio"
                    );

            if (audioSender) {

                try {

                    const audioParameters = audioSender.getParameters();

                    if (audioParameters.encodings && audioParameters.encodings.length > 0) {
                        // Limitar áudio em 128 kbps para não competir com vídeo e priorizar estabilidade
                        audioParameters.encodings[0].maxBitrate = 128_000;
                        audioParameters.encodings[0].networkPriority = "high";
                        audioParameters.encodings[0].priority = "high";
                    }

                    await audioSender.setParameters(audioParameters);
                    console.log("Parâmetros de áudio configurados com sucesso:", audioParameters);

                } catch (audioError) {

                    console.warn(
                        "Não foi possível aplicar parâmetros avançados de áudio:",
                        audioError
                    );

                }

            }


            preferCodec(peerConnection, "video/H264");

            const offer =
                await peerConnection.createOffer();


            await peerConnection.setLocalDescription(
                offer
            );


            // Reaplica o bitrate depois do setLocalDescription para
            // garantir que o limite não foi descartado pelo navegador.
            await updateSenderBitrate(
                peerConnection,
                BITRATES[streamQualitySelect.value] || BITRATES["720p"]
            );


            socket.emit(
                "webrtc-offer",
                offer
            );


            startHostStats();


            shareScreenButton.classList.add(
                "hidden"
            );


            stopSharingButton.classList.remove(
                "hidden"
            );


            hostStatus.textContent =
                "🟢 Transmitindo sua tela!";


            videoTrack.addEventListener(
                "ended",
                stopScreenSharing
            );


        } catch (error) {

            console.error(
                "Erro ao compartilhar:",
                error
            );

            // Não deixa a captura de tela ligada se algo falhou.
            if (localStream) {

                localStream
                    .getTracks()
                    .forEach(track => track.stop());

                localStream = null;

            }

            stopHostStats();

        }

    }

);


// ========================================
// ESTATÍSTICAS DO HOST (DIAGNÓSTICO)
// ========================================

let hostStatsInterval = null;

function startHostStats() {

    stopHostStats();

    hostStatsInterval = setInterval(async () => {

        if (!peerConnection) return;

        try {

            const stats = await peerConnection.getStats();

            stats.forEach(report => {

                if (
                    report.type === "outbound-rtp" &&
                    report.kind === "video"
                ) {

                    console.log("[host-stats]", {

                        fps: report.framesPerSecond,

                        tamanho: `${report.frameWidth}x${report.frameHeight}`,

                        limitadoPor: report.qualityLimitationReason,

                        alvoMbps: report.targetBitrate
                            ? (report.targetBitrate / 1e6).toFixed(2)
                            : "--",

                        bitrateRealMbps: report.bytesSent
                            ? (report.bytesSent / 1e6).toFixed(2)
                            : "--",

                        pacotesPerdidos: report.packetsLost,

                        pacotesEnviados: report.packetsSent,

                        encoder: report.encoderImplementation,

                        codec: stats.get(report.codecId)?.mimeType

                    });

                }

            });

        } catch (error) {

            console.warn("Falha ao ler estatísticas do host:", error);

        }

    }, 2000);

}

function stopHostStats() {

    if (hostStatsInterval) {

        clearInterval(hostStatsInterval);

        hostStatsInterval = null;

    }

}

// ========================================
// DIAGNÓSTICO DO VIEWER (console)
// ========================================

let viewerDiagInterval = null;
let viewerDiagPrev = null;
let viewerRenderedFrames = 0;
let viewerFrameCallbackId = null;

function startViewerDiagnostics() {

    stopViewerDiagnostics();

    viewerRenderedFrames = 0;
    viewerDiagPrev = null;

    // Conta quadros realmente apresentados na tela
    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {

        const onFrame = () => {
            viewerRenderedFrames++;
            viewerFrameCallbackId =
                remoteVideo.requestVideoFrameCallback(onFrame);
        };

        viewerFrameCallbackId =
            remoteVideo.requestVideoFrameCallback(onFrame);

    }

    viewerDiagInterval = setInterval(async () => {

        if (!peerConnection) return;

        try {

            const stats = await peerConnection.getStats();

            let v = null;

            stats.forEach(report => {
                if (report.type === "inbound-rtp" && report.kind === "video") {
                    v = report;
                }
            });

            if (!v) return;

            const cur = {
                t: performance.now(),
                received: v.framesReceived || 0,
                decoded: v.framesDecoded || 0,
                dropped: v.framesDropped || 0,
                rendered: viewerRenderedFrames,
                decodeTime: v.totalDecodeTime || 0,
                lost: v.packetsLost || 0,
                nack: v.nackCount || 0,
                pli: v.pliCount || 0,
                jbDelay: v.jitterBufferDelay || 0,
                jbCount: v.jitterBufferEmittedCount || 0
            };

            const prev = viewerDiagPrev;
            viewerDiagPrev = cur;

            if (!prev) return;

            const dt = (cur.t - prev.t) / 1000;
            const dDecoded = cur.decoded - prev.decoded;
            const dJb = cur.jbCount - prev.jbCount;

            const playback = remoteVideo.getVideoPlaybackQuality?.();

            console.log("[viewer-diag]", {
                recebidoFps: ((cur.received - prev.received) / dt).toFixed(1),
                decodificadoFps: (dDecoded / dt).toFixed(1),
                exibidoFps: ((cur.rendered - prev.rendered) / dt).toFixed(1),
                descartadosNoPeriodo: cur.dropped - prev.dropped,
                decodeMsPorQuadro: dDecoded > 0
                    ? (((cur.decodeTime - prev.decodeTime) / dDecoded) * 1000).toFixed(1)
                    : "--",
                jitterBufferMs: dJb > 0
                    ? (((cur.jbDelay - prev.jbDelay) / dJb) * 1000).toFixed(0)
                    : "--",
                pacotesPerdidos: cur.lost - prev.lost,
                nack: cur.nack - prev.nack,
                pli: cur.pli - prev.pli,
                freezes: v.freezeCount,
                droppedPlayback: playback?.droppedVideoFrames,
                decoder: v.decoderImplementation,
                hwDecoder: v.powerEfficientDecoder,
                codec: stats.get(v.codecId)?.mimeType,
                stream: `${v.frameWidth}x${v.frameHeight}`,
                player: `${remoteVideo.clientWidth}x${remoteVideo.clientHeight}`,
                dpr: window.devicePixelRatio
            });

        } catch (error) {

            console.warn("Falha no diagnóstico do viewer:", error);

        }

    }, 1000);

}

function stopViewerDiagnostics() {

    if (viewerDiagInterval) {
        clearInterval(viewerDiagInterval);
        viewerDiagInterval = null;
    }

    if (
        viewerFrameCallbackId !== null &&
        "cancelVideoFrameCallback" in HTMLVideoElement.prototype
    ) {
        remoteVideo.cancelVideoFrameCallback(viewerFrameCallbackId);
    }

    viewerFrameCallbackId = null;
    viewerDiagPrev = null;

}


// ========================================
// PARAR DE COMPARTILHAR A TELA
// ========================================

stopSharingButton.addEventListener(
    "click",
    stopScreenSharing
);


function stopScreenSharing() {

    console.log(
        "Encerrando compartilhamento..."
    );

    stopHostStats();


    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                track.stop();

            });


        localStream = null;

    }


    if (peerConnection) {

        peerConnection
            .getSenders()
            .forEach(sender => {

                if (sender.track) {

                    peerConnection.removeTrack(
                        sender
                    );

                }

            });


        peerConnection.close();

        peerConnection =
            createPeerConnection();

    }

    pendingIceCandidates = [];

    // Notificar o viewer de que o compartilhamento foi encerrado
    socket.emit("screen-share-stopped");


    stopSharingButton.classList.add(
        "hidden"
    );


    shareScreenButton.classList.remove(
        "hidden"
    );


    hostStatus.textContent =
        "🟡 Compartilhamento encerrado.";

}

// ========================================
// SAIR DA SALA E VOLTAR AO MENU
// ========================================

function resetRoomInterface(message = "") {

    console.log("Limpando sessão da sala...");

    stopViewerDiagnostics();
    stopHostStats();

    // Encerrar captura de tela e áudio
    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => track.stop());

        localStream = null;

    }

    // Encerrar conexão WebRTC
    if (peerConnection) {

        peerConnection.close();

        peerConnection = createPeerConnection();

    }

    // Encerrar atualização das estatísticas
    if (statsInterval) {

        clearInterval(statsInterval);

        statsInterval = null;

    }

    // Limpar player
    remoteVideo.pause();
    remoteVideo.srcObject = null;
    remoteVideo.load();

    videoPlaceholder.classList.remove("hidden");

    // Limpar estatísticas
    resolution.textContent = "--";
    fps.textContent = "--";
    bitrate.textContent = "--";

    previousBytesReceived = 0;
    previousTimestamp = 0;
    pendingIceCandidates = [];

    // Limpar informações da sala
    currentRoomCode = null;
    isHost = false;

    roomCodeDisplay.textContent = "--------";
    roomCodeInput.value = "";

    // Restaurar botões
    shareScreenButton.classList.add("hidden");
    stopSharingButton.classList.add("hidden");
    leaveRoomButton.classList.add("hidden");

    // Restaurar mensagens
    hostStatus.textContent = "🟡 Aguardando seu amigo...";
    connectionStatus.textContent = "🔴 Desconectado";

    // Esconder as telas da sala
    if (hostLayout) {
        hostLayout.classList.add("hidden");
    }
    hostSection.classList.add("hidden");
    viewerSection.classList.add("hidden");

    // Limpar e esconder o chat da sala
    if (leaveRoomButton && chatSection && chatSection.parentNode !== leaveRoomButton.parentNode) {
        leaveRoomButton.parentNode.insertBefore(chatSection, leaveRoomButton);
    }
    if (chatSection) {
        chatSection.classList.add("hidden");
    }
    if (chatMessages) {
        chatMessages.innerHTML = "";
    }
    if (chatInput) {
        chatInput.value = "";
    }

    // Mostrar menu inicial
    createSection.classList.remove("hidden");
    joinSection.classList.remove("hidden");

    if (profileSection) {
        profileSection.classList.remove("hidden");
    }

    // Limpar status
    status.textContent = message;

    // Sair da tela cheia, caso esteja ativa
    if (document.fullscreenElement === videoContainer) {

        document.exitFullscreen().catch(error => {
            console.error("Erro ao sair da tela cheia:", error);
        });

    }

}

// ========================================
// TRANSMISSÃO ENCERRADA PELO HOST
// ========================================

socket.on("screen-share-stopped", () => {

    stopViewerDiagnostics();
    console.log("O host encerrou a transmissão.");

    // Limpar player e voltar placeholder
    remoteVideo.pause();
    remoteVideo.srcObject = null;
    remoteVideo.load();
    videoPlaceholder.classList.remove("hidden");

    // Limpar estatísticas e contadores
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }

    resolution.textContent = "--";
    fps.textContent = "--";
    bitrate.textContent = "--";

    previousBytesReceived = 0;
    previousTimestamp = 0;
    pendingIceCandidates = [];

    // Recriar peer connection para que esteja limpa para o próximo compartilhamento
    if (peerConnection) {
        peerConnection.close();
        peerConnection = createPeerConnection();
    }

    connectionStatus.textContent = "🟡 Aguardando transmissão...";

});


// ========================================
// RECEBER OFERTA
// ========================================

socket.on("webrtc-offer", async (offer) => {

    console.log("Oferta WebRTC recebida.");

    if (!peerConnection) {
        peerConnection = createPeerConnection();
    }

    try {

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );

        // Processar candidatos ICE que chegaram antes da descrição remota
        await processPendingIceCandidates();

        const answer =
            await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(
            answer
        );

        socket.emit(
            "webrtc-answer",
            answer
        );

    } catch (error) {

        console.error("Erro ao processar oferta WebRTC:", error);

    }

});


// ========================================
// RECEBER ANSWER
// ========================================

socket.on("webrtc-answer", async (answer) => {

    console.log("Resposta WebRTC recebida.");

    try {

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
        );

        // Processar candidatos ICE que chegaram antes da resposta remota
        await processPendingIceCandidates();

    } catch (error) {

        console.error("Erro ao aplicar resposta WebRTC:", error);

    }

});


// ========================================
// RECEBER ICE CANDIDATE
// ========================================

socket.on("webrtc-candidate", async (candidate) => {

    if (!peerConnection) {
        peerConnection = createPeerConnection();
    }

    // Se a descrição remota ainda não foi configurada, enfileira o candidato
    if (!peerConnection.remoteDescription || !peerConnection.remoteDescription.type) {
        console.log("ICE candidate recebido antes do remoteDescription. Enfileirando...");
        pendingIceCandidates.push(candidate);
        return;
    }

    try {

        await peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
        );

    } catch (error) {

        console.error(
            "Erro ao adicionar ICE candidate:",
            error
        );

    }

});


// ========================================
// ERRO
// ========================================

socket.on("room-error", (message) => {

    status.textContent = message;

});


// ========================================
// VIEWER SAIU
// ========================================

socket.on("viewer-left", () => {

    // Se o host estava transmitindo, encerra a transmissão e recria a
    // conexão para que o próximo viewer comece com uma conexão limpa.
    if (localStream) {

        stopScreenSharing();

    }

    shareScreenButton.classList.add("hidden");

    if (chatParticipants) {
        chatParticipants.textContent = "Aguardando amigo...";
    }

    hostStatus.textContent =
        "🟡 Seu amigo saiu da sala.";

});


// ========================================
// CONEXÃO
// ========================================

socket.on("connect", () => {

    if (!peerConnection) {

        peerConnection =
            createPeerConnection();

    }


    console.log("Conectado ao servidor!");

});


// ========================================
// ESTATÍSTICAS DA TRANSMISSÃO
// ========================================

async function updateStats() {

    const stats =
        await peerConnection.getStats();


    let videoStats = null;


    stats.forEach(report => {

        if (
            report.type === "inbound-rtp" &&
            report.kind === "video"
        ) {

            videoStats = report;

        }

    });


    if (!videoStats) {

        return;

    }


    const currentFPS =
        videoStats.framesPerSecond || 0;


    const width =
        videoStats.frameWidth || 0;


    const height =
        videoStats.frameHeight || 0;


    const bytesReceived =
        videoStats.bytesReceived || 0;


    const timestamp =
        videoStats.timestamp;


    let currentBitrate = 0;


    if (previousTimestamp !== 0) {

        const bytesDiff =
            bytesReceived -
            previousBytesReceived;


        const timeDiff =
            timestamp -
            previousTimestamp;


        if (timeDiff > 0) {

            currentBitrate =
                (bytesDiff * 8) /
                (timeDiff / 1000);

        }

    }


    previousBytesReceived =
        bytesReceived;


    previousTimestamp =
        timestamp;


    resolution.textContent =
        width && height
            ? `${width} × ${height}`
            : "--";


    fps.textContent =
        currentFPS
            ? Math.round(currentFPS)
            : "--";


    bitrate.textContent =
        currentBitrate
            ? `${(
                currentBitrate / 1000000
            ).toFixed(2)} Mbps`
            : "--";

}