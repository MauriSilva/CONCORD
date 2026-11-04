
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

        remoteVideo.srcObject = stream;
        remoteVideo.muted = false;
        remoteVideo.volume = 1;
        remoteVideo.load();

        videoPlaceholder.classList.add("hidden");

        connectionStatus.textContent =
            "🟢 Conectado";


        remoteVideo.play().catch((error) => {

            console.error(
                "Erro ao iniciar vídeo:",
                error
            );

        });


        if (!statsInterval) {

            statsInterval = setInterval(
                updateStats,
                1000
            );

        }

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


function getSelectedQuality() {

    return STREAM_QUALITIES[
        streamQualitySelect.value
    ] || STREAM_QUALITIES["1080p"];

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
            ideal: 30,
            max: 60
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


// ========================================
// CRIAR SALA
// ========================================

createRoomButton.addEventListener("click", () => {

    socket.emit("create-room");

});


// ========================================
// SALA CRIADA
// ========================================

socket.on("room-created", (roomCode) => {

    isHost = true;

    currentRoomCode = roomCode;

    roomCodeDisplay.textContent = roomCode;

    createSection.classList.add("hidden");

    joinSection.classList.add("hidden");

    hostSection.classList.remove("hidden");

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


    socket.emit(
        "join-room",
        roomCode
    );

});


// ========================================
// ENTROU NA SALA
// ========================================

socket.on("room-joined", (roomCode) => {

    currentRoomCode = roomCode;

    joinSection.classList.add("hidden");

    createSection.classList.add("hidden");

    viewerSection.classList.remove("hidden");

    connectionStatus.textContent =
        "🟡 Conectando...";

});


// ========================================
// VIEWER ENTROU
// ========================================

socket.on("viewer-joined", () => {

    console.log("Viewer conectado!");


    hostStatus.textContent =
        "🟢 Seu amigo está conectado!";


    shareScreenButton.classList.remove(
        "hidden"
    );

});


// ========================================
// COMPARTILHAR A TELA
// ========================================

shareScreenButton.addEventListener(
    "click",
    async () => {

        try {

            localStream =
                await navigator.mediaDevices.getDisplayMedia({

                    video: true,

                    audio: true

                });


            console.log(
                "Tela capturada!"
            );


            const videoTrack =
                localStream.getVideoTracks()[0];


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

                const parameters =
                    videoSender.getParameters();


                if (!parameters.encodings) {

                    parameters.encodings = [{}];

                }


                parameters.encodings[0].maxFramerate = 60;

                parameters.degradationPreference =
                    "balanced";


                await videoSender.setParameters(
                    parameters
                );

            }


            const offer =
                await peerConnection.createOffer();


            await peerConnection.setLocalDescription(
                offer
            );


            socket.emit(
                "webrtc-offer",
                offer
            );


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

        }

    }

);


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
// RECEBER OFERTA
// ========================================

socket.on("webrtc-offer", async (offer) => {

    console.log("Oferta WebRTC recebida.");


    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
    );


    const answer =
        await peerConnection.createAnswer();


    await peerConnection.setLocalDescription(
        answer
    );


    socket.emit(
        "webrtc-answer",
        answer
    );

});


// ========================================
// RECEBER ANSWER
// ========================================

socket.on("webrtc-answer", async (answer) => {

    console.log("Resposta WebRTC recebida.");


    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
    );

});


socket.on("webrtc-candidate", async (candidate) => {

    if (!peerConnection) {

        peerConnection =
            createPeerConnection();

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

    status.textContent =
        "Seu amigo saiu da sala.";

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
