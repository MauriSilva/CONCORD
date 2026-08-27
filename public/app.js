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

const viewerSection =
    document.getElementById("viewerSection");

const connectionStatus =
    document.getElementById("connectionStatus");

const remoteVideo =
    document.getElementById("remoteVideo");

const videoPlaceholder =
    document.getElementById("videoPlaceholder");

const resolution =
    document.getElementById("resolution");

const fps =
    document.getElementById("fps");

const bitrate =
    document.getElementById("bitrate");


// ========================================
// CONFIGURAÇÃO WEBRTC
// ========================================

const peerConnection = new RTCPeerConnection({
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
});

let localStream = null;

let isHost = false;

let currentRoomCode = null;

let statsInterval = null;

let previousBytesReceived = 0;

let previousTimestamp = 0;


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

        status.textContent = "Digite um código de sala.";

        return;
    }

    status.textContent = "Entrando na sala...";

    socket.emit("join-room", roomCode);

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


//compartilhar a tela
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


            await videoTrack.applyConstraints({

                width: {
                    ideal: 1280,
                    max: 1280
                },

                height: {
                    ideal: 720,
                    max: 720
                },

                frameRate: {
                    ideal: 30,
                    max: 30
                }

            });


            videoTrack.contentHint =
                "motion";


            console.log(
                "Configuração da captura:",
                videoTrack.getSettings()
            );


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

                    parameters.encodings = [
                        {}
                    ];

                }


                parameters.encodings[0]
                    .maxBitrate = 3_000_000;

                parameters.encodings[0]
                    .maxFramerate = 30;


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
//parar de compartilhar a tela
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


    // Remover tracks antigas do WebRTC

    peerConnection
        .getSenders()
        .forEach(sender => {

            if (sender.track) {

                peerConnection.removeTrack(
                    sender
                );

            }

        });


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

    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    socket.emit("webrtc-answer", answer);

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


// ========================================
// RECEBER VÍDEO
// ========================================

peerConnection.addEventListener(
    "track",
    async (event) => {

        console.log("Vídeo recebido!");

        const stream = event.streams[0];

        remoteVideo.srcObject = stream;
        remoteVideo.load();
        videoPlaceholder.classList.add("hidden");

        connectionStatus.textContent =
            "🟢 Conectado";
        

        try {

            await remoteVideo.play();

            console.log(
                "Vídeo iniciado corretamente!"
            );

        } catch (error) {

            console.error(
                "Erro ao iniciar vídeo:",
                error
            );

        }


        if (!statsInterval) {

            statsInterval = setInterval(
                updateStats,
                1000
            );

        }

    }
);


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

    status.textContent = "Seu amigo saiu da sala.";

});


// ========================================
// CONEXÃO
// ========================================

socket.on("connect", () => {

    console.log("Conectado ao servidor!");

});

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