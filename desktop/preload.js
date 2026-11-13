const { contextBridge, ipcRenderer } = require("electron");

// Expõe APIs seguras para a janela do Concord
contextBridge.exposeInMainWorld("concordDesktop", {
    isDesktop: true,
    getCaptureSources: () => ipcRenderer.invoke("get-capture-sources"),
    selectSource: (sourceId) => ipcRenderer.invoke("select-capture-source", sourceId),
    getPidForSource: (sourceId) => ipcRenderer.invoke("get-source-pid", sourceId),
    startAudioCapture: (params) => ipcRenderer.invoke("start-audio-capture", params),
    stopAudioCapture: () => ipcRenderer.invoke("stop-audio-capture"),
    onAudioData: (callback) => {
        ipcRenderer.on("audio-pcm-data", (event, chunk) => callback(chunk));
    }
});
