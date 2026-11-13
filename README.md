# Concord

Compartilhe sua tela com até 4 amigos, direto do navegador ou pelo app desktop. Sem Nitro, sem anúncios, sem vergonha.

O Concord cria salas de até **5 pessoas**, com transmissão de tela em tempo real (WebRTC) e chat de texto lado a lado com o vídeo. Qualquer participante pode transmitir quando ninguém estiver transmitindo.

## Funcionalidades

- **Salas para até 5 pessoas**: crie uma sala e compartilhe o código de 8 caracteres.
- **Transmissão livre**: não existe host fixo; quem quiser transmite quando a sala estiver livre.
- **Chat em grupo**: mensagens em tempo real, apagadas quando a sala fecha (nada é gravado).
- **Qualidade ajustável**: 720p ou 1080p, a até 30 FPS.
- **Modos de transmissão**: *Jogos* (prioriza FPS) ou *Geral / Leitura* (prioriza nitidez).
- **Estatísticas ao vivo**: resolução, FPS e bitrate recebidos.
- **Tela cheia** no player.
- **Apelido salvo** no navegador.

### Exclusivo do Concord Desktop (Windows)

- **Seletor de janelas e telas** com miniaturas, no estilo Discord.
- **Áudio isolado por aplicativo (anti-eco)**: captura só o som do app escolhido, para seus amigos não ouvirem sua própria voz duplicada.
- **Detecção de jogos em tela cheia exclusiva** (DirectX/Vulkan).

## Baixar

Baixe o instalador mais recente na página de [Releases](../../releases/latest) e execute o `Concord Setup X.X.X.exe`.

> Como o instalador ainda não tem assinatura de código, o Windows SmartScreen pode mostrar "editor desconhecido". Clique em **Mais informações → Executar assim mesmo**.

Prefere não instalar nada? Use a versão web.

## Como usar

1. Defina seu apelido no topo da página.
2. Clique em **Criar sala** ou digite o código de uma sala existente.
3. Envie o código para seus amigos (máximo de 5 pessoas por sala).
4. Escolha qualidade e propósito, clique em **Iniciar transmissão** e selecione a tela ou janela.

Dica: se estiver em chamada de voz, evite compartilhar o áudio do computador para não gerar eco. No app desktop, use a opção de áudio isolado.

## Tecnologias

- **Servidor**: Node.js, Express e Socket.IO (sinalização WebRTC e chat)
- **Cliente**: HTML, CSS e JavaScript puro, com WebRTC
- **Desktop**: Electron, [`loopback-capture`](https://www.npmjs.com/package/loopback-capture) para áudio por processo e helpers em C# para enumerar janelas
- **Empacotamento**: electron-builder (instalador NSIS)

## Estrutura do projeto

```
CONCORD/
├── server/          # Servidor Express + Socket.IO
├── public/          # Interface web (usada também pelo desktop)
└── desktop/         # App Electron
    ├── main.js
    ├── preload.js
    ├── get_pid.cs
    └── enum_windows.cs
```

## Rodando localmente

Requisitos: Node.js 18 ou superior.

```bash
# Instalar dependências do servidor
npm install

# Iniciar o servidor (http://localhost:3000)
npm start
```

Abra `http://localhost:3000` em dois navegadores para testar uma sala.

O endereço do servidor é definido em `public/config.js`: em `localhost` usa o servidor local, caso contrário usa o servidor de produção.

### Rodando o app desktop

```bash
cd desktop
npm install
cd ..
npm run desktop
```

## Gerando o instalador (Windows)

1. Compile os helpers nativos, uma vez, dentro de `desktop/`:

   ```bat
   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /out:get_pid.exe get_pid.cs
   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /out:enum_windows.exe enum_windows.cs
   ```

2. Gere o instalador:

   ```bat
   cd desktop
   npm install
   npm run dist
   ```

O instalador sai em `desktop/dist/`. Compile no Windows, pois o `loopback-capture` só tem binários para win32/linux x64.

## Limitações conhecidas

- 1080p é experimental e pode causar travamentos dependendo da conexão.
- A captura de áudio isolada funciona apenas no Windows, no app desktop.
- A conexão é feita via STUN público, então redes muito restritivas (NAT simétrico) podem exigir um servidor TURN.

## Créditos

App feito quase inteiramente com o uso de IA. Agradecimentos especiais ao ChatGPT, Gemini e Claude.

## Licença

ISC
