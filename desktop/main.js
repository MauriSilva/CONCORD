const { dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { app, BrowserWindow, desktopCapturer, session, ipcMain } = require("electron");
const path = require("path");
const { execFile } = require("child_process");
const { LoopbackCapture } = require("loopback-capture");
const resourcesBase = app.isPackaged ? process.resourcesPath : __dirname;
const publicDir = app.isPackaged
    ? path.join(process.resourcesPath, "public")
    : path.join(__dirname, "../public");

let mainWindow = null;
let currentSelectedSourceId = null;
let loopbackInstance = null;

function getPidFromSourceId(sourceId) {
    return new Promise((resolve) => {
        if (!sourceId || !sourceId.startsWith("window:")) {
            return resolve(0);
        }

        const helperPath = path.join(resourcesBase, "get_pid.exe");
        execFile(helperPath, [sourceId], (err, stdout) => {
            if (err) {
                console.warn("Erro ao obter PID da janela:", err);
                return resolve(0);
            }
            const pid = parseInt(stdout.trim(), 10);
            resolve(isNaN(pid) ? 0 : pid);
        });
    });
}

function stopAudioCapture() {
    if (loopbackInstance) {
        try {
            loopbackInstance.stop();
            console.log("[AudioCapture] Captura de áudio encerrada.");
        } catch (e) {
            console.warn("[AudioCapture] Erro ao parar captura de áudio:", e);
        }
        loopbackInstance = null;
    }
}

function setupAutoUpdater() {
    if (!app.isPackaged) return; // só atualiza o app instalado

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("error", (err) => {
        console.warn("[Updater] Erro:", err == null ? "desconhecido" : err.message);
    });

    autoUpdater.on("update-available", (info) => {
        console.log(`[Updater] Nova versão disponível: ${info.version}`);
    });

    autoUpdater.on("update-downloaded", async (info) => {
        const { response } = await dialog.showMessageBox(mainWindow, {
            type: "info",
            buttons: ["Reiniciar agora", "Depois"],
            defaultId: 0,
            cancelId: 1,
            title: "Atualização pronta",
            message: `A versão ${info.version} do Concord foi baixada.`,
            detail: "Reinicie o app para concluir a atualização."
        });
        if (response === 0) {
            stopAudioCapture();
            autoUpdater.quitAndInstall();
        }
    });

    autoUpdater.checkForUpdates().catch(() => {});
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 900,
        minHeight: 650,
        backgroundColor: "#111111",
        title: "Concord Desktop",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js")
        }
    });

    // Remove o menu padrão para ficar limpo como o Discord
    mainWindow.setMenuBarVisibility(false);

    // Carrega a interface web local do Concord
    mainWindow.loadFile(path.join(publicDir, "index.html"));

    mainWindow.webContents.on("preload-error", (event, preloadPath, error) => {
    console.error("PRELOAD ERRO:", preloadPath, error);
});

    // Interceptador de getDisplayMedia caso seja invocado
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ["screen", "window"],
                thumbnailSize: { width: 400, height: 225 },
                fetchWindowIcons: true
            });

            if (currentSelectedSourceId) {
                // Se for uma janela fullscreen nativa que o desktopCapturer não vê,
                // captura a tela principal em vez da janela
                if (currentSelectedSourceId.startsWith("native-fullscreen:")) {
                    console.log("[DisplayMedia] Fonte é fullscreen nativa, usando captura de tela.");
                    const screenSource = sources.find(s => s.id.startsWith("screen:"));
                    if (screenSource) {
                        callback({ video: screenSource });
                        return;
                    }
                }

                const target = sources.find(s => s.id === currentSelectedSourceId);
                if (target) {
                    callback({ video: target });
                    return;
                }
            }

            if (sources.length > 0) {
                callback({ video: sources[0] });
            } else {
                callback(null);
            }
        } catch (error) {
            console.error("Erro ao obter fontes de captura:", error);
            callback(null);
        }
    });

    mainWindow.on("closed", () => {
        stopAudioCapture();
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            setupAutoUpdater();
        }
    });
});

app.on("window-all-closed", () => {
    stopAudioCapture();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// Usa o helper nativo para descobrir janelas (inclusive fullscreen exclusivo)
function getNativeWindows() {
    return new Promise((resolve) => {
        const helperPath = path.join(resourcesBase, "enum_windows.exe");
        execFile(helperPath, [], { timeout: 5000 }, (err, stdout) => {
            if (err) {
                console.warn("[EnumWindows] Falha ao enumerar janelas nativas:", err.message);
                return resolve([]);
            }
            try {
                resolve(JSON.parse(stdout));
            } catch (parseErr) {
                console.warn("[EnumWindows] Falha ao parsear JSON:", parseErr.message);
                resolve([]);
            }
        });
    });
}

// IPC para obter lista de telas e janelas com miniaturas
ipcMain.handle("get-capture-sources", async () => {
    try {
        // Busca fontes do Electron e janelas nativas em paralelo
        const [sources, nativeWindows] = await Promise.all([
            desktopCapturer.getSources({
                types: ["screen", "window"],
                thumbnailSize: { width: 400, height: 225 },
                fetchWindowIcons: true
            }),
            getNativeWindows()
        ]);

        // Monta um Set dos HWNDs que o desktopCapturer já conhece
        const knownHwnds = new Set();
        for (const s of sources) {
            if (s.id.startsWith("window:")) {
                // source.id formato: "window:<hwnd>:<index>"
                const hwnd = s.id.split(":")[1];
                knownHwnds.add(hwnd);
            }
        }

        // Mapeia janelas nativas por HWND para acesso rápido
        const nativeByHwnd = new Map();
        for (const nw of nativeWindows) {
            nativeByHwnd.set(String(nw.hwnd), nw);
        }

        const IGNORED_WINDOW_NAMES = [
    "Experiência de entrada do Windows",
    "Experi´┐¢ncia de Entrada do Windows",
    "Windows Input Experience",
    "Filmes e TV",
    "Movies & TV",
    "Program Manager"
];

const filteredSources = sources.filter(s => {
    if (s.id.startsWith("screen:")) return true;
    return !IGNORED_WINDOW_NAMES.includes(s.name);
});

        // Monta a lista base com as fontes do desktopCapturer
        const result = filteredSources.map(s => {
            const isScreen = s.id.startsWith("screen:");
            const entry = {
                id: s.id,
                name: s.name,
                thumbnail: s.thumbnail.toDataURL(),
                appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
                isScreen,
                fullscreen: false,
                nativePid: 0
            };

            // Se for janela, verifica se é fullscreen via dados nativos
            if (!isScreen) {
                const hwnd = s.id.split(":")[1];
                const nw = nativeByHwnd.get(hwnd);
                if (nw) {
                    entry.fullscreen = nw.fullscreen;
                    entry.nativePid = nw.pid;
                }
            }

            return entry;
        });

        // Adiciona janelas fullscreen que o desktopCapturer NÃO detectou
        // (apps em exclusive fullscreen DirectX/Vulkan)
        for (const nw of nativeWindows) {
            if (!nw.fullscreen) continue;
            if (knownHwnds.has(String(nw.hwnd))) continue;

            // Essa janela é fullscreen mas invisível para o desktopCapturer!
            // Vamos adicioná-la com um ID especial para captura via tela
            console.log(`[EnumWindows] Janela fullscreen exclusiva detectada: "${nw.name}" (PID: ${nw.pid}, HWND: ${nw.hwnd})`);

            result.push({
                id: `native-fullscreen:${nw.hwnd}:${nw.pid}`,
                name: `🎮 ${nw.name}`,
                thumbnail: null,
                appIcon: null,
                isScreen: false,
                fullscreen: true,
                nativePid: nw.pid,
                isNativeFullscreen: true
            });
        }

        return result;
    } catch (err) {
        console.error("Falha ao listar janelas/telas:", err);
        return [];
    }
});

// Guarda a fonte escolhida pelo usuário
ipcMain.handle("select-capture-source", (event, sourceId) => {
    currentSelectedSourceId = sourceId;
    return true;
});

// Descobre o PID da janela selecionada
ipcMain.handle("get-source-pid", async (event, sourceId) => {
    // Para fontes native-fullscreen, o PID já está embutido no ID
    if (sourceId && sourceId.startsWith("native-fullscreen:")) {
        const parts = sourceId.split(":");
        const pid = parseInt(parts[2], 10);
        console.log(`[SourcePicker] Native fullscreen source -> PID: ${pid}`);
        return isNaN(pid) ? 0 : pid;
    }

    const pid = await getPidFromSourceId(sourceId);
    console.log(`[SourcePicker] Source ID: ${sourceId} -> PID: ${pid}`);
    return pid;
});

// Inicia captura de áudio nativa (isolada por processo ou sistema sem Concord)
ipcMain.handle("start-audio-capture", async (event, { pid, isScreen }) => {
    stopAudioCapture();

    try {
        loopbackInstance = new LoopbackCapture();

        if (pid && pid > 0) {
            console.log(`[AudioCapture] Iniciando captura isolada para o processo PID: ${pid}`);
            loopbackInstance.start(pid, (chunk) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("audio-pcm-data", chunk);
                }
            });
        } else {
            console.log(`[AudioCapture] Iniciando captura de áudio do sistema (excluindo Concord PID: ${process.pid})`);
            loopbackInstance.startSystemAudio((chunk) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("audio-pcm-data", chunk);
                }
            }, process.pid);
        }

        return { success: true };
    } catch (err) {
        console.error("[AudioCapture] Falha ao iniciar captura:", err);
        return { success: false, error: err.message };
    }
});

// Encerra captura de áudio nativa
ipcMain.handle("stop-audio-capture", () => {
    stopAudioCapture();
    return { success: true };
});
