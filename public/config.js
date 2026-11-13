const CONFIG = {
    SOCKET_SERVER: (() => {
        // Permite override manual se necessário para testes
        const override = typeof localStorage !== "undefined" ? localStorage.getItem("concord_server_override") : null;
        if (override) return override;

        // Se estiver rodando no servidor web local
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            return "http://localhost:3000/";
        }

        // Padrão para Web em produção e Concord Desktop: Servidor Render
        return "https://concord-rn1j.onrender.com/";
    })()
};
