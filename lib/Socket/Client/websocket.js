import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { DEFAULT_ORIGIN } from '../../Defaults/index.js';
import { AbstractSocketClient } from './types.js';
export class WebSocketClient extends AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
    }
    get isOpen() {
        return this.socket?.readyState === WebSocket.OPEN;
    }
    get isClosed() {
        return this.socket === null || this.socket?.readyState === WebSocket.CLOSED;
    }
    get isClosing() {
        return this.socket === null || this.socket?.readyState === WebSocket.CLOSING;
    }
    get isConnecting() {
        return this.socket?.readyState === WebSocket.CONNECTING;
    }
    connect() {
        if (this.socket) {
            return;
        }
        // Auto-inject proxy agent from WHATSAPP_PROXY_URL env var if no agent is configured.
        // This allows cloud deployments to route ONLY WhatsApp traffic through a residential
        // proxy without affecting other outbound traffic (e.g. API calls, package installs).
        // Using a WhatsApp-specific env var avoids the side effects of setting HTTPS_PROXY
        // globally, which would route all process traffic through the proxy.
        let agent = this.config.agent;
        if (agent) {
            console.log('[baileys-proxy] using explicitly configured agent');
        }
        else if (process.env.WHATSAPP_PROXY_URL) {
            console.log('[baileys-proxy] using WHATSAPP_PROXY_URL for WebSocket agent');
            agent = new HttpsProxyAgent(process.env.WHATSAPP_PROXY_URL);
        }
        else {
            console.log('[baileys-proxy] no proxy configured (WHATSAPP_PROXY_URL not set), connecting direct');
        }
        this.socket = new WebSocket(this.url, {
            origin: DEFAULT_ORIGIN,
            headers: this.config.options?.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent
        });
        this.socket.setMaxListeners(0);
        const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response'];
        for (const event of events) {
            this.socket?.on(event, (...args) => this.emit(event, ...args));
        }
    }
    async close() {
        if (!this.socket) {
            return;
        }
        const closePromise = new Promise(resolve => {
            this.socket?.once('close', resolve);
        });
        this.socket.close();
        await closePromise;
        this.socket = null;
    }
    send(str, cb) {
        this.socket?.send(str, cb);
        return Boolean(this.socket);
    }
}
//# sourceMappingURL=websocket.js.map