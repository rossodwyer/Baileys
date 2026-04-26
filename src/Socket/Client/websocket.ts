import WebSocket from 'ws'
import { appendFileSync } from 'fs'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { DEFAULT_ORIGIN } from '../../Defaults'
import { AbstractSocketClient } from './types'

export class WebSocketClient extends AbstractSocketClient {
	protected socket: WebSocket | null = null

	get isOpen(): boolean {
		return this.socket?.readyState === WebSocket.OPEN
	}
	get isClosed(): boolean {
		return this.socket === null || this.socket?.readyState === WebSocket.CLOSED
	}
	get isClosing(): boolean {
		return this.socket === null || this.socket?.readyState === WebSocket.CLOSING
	}
	get isConnecting(): boolean {
		return this.socket?.readyState === WebSocket.CONNECTING
	}

	connect() {
		if (this.socket) {
			return
		}

		// Auto-inject proxy agent from WHATSAPP_PROXY_URL env var if no agent is configured.
		// This allows cloud deployments to route ONLY WhatsApp traffic through a residential
		// proxy without affecting other outbound traffic (e.g. API calls, package installs).
		// Using a WhatsApp-specific env var avoids the side effects of setting HTTPS_PROXY
		// globally, which would route all process traffic through the proxy.
		const debugLog = (msg: string) => {
			try {
				appendFileSync('/tmp/baileys-debug.log', `[${new Date().toISOString()}] [baileys-proxy] ${msg}\n`)
			} catch {
				// best-effort; if /tmp isn't writable, swallow rather than crash
			}
		}

		let agent = this.config.agent
		if (agent) {
			debugLog('using explicitly configured agent')
		} else if (process.env.WHATSAPP_PROXY_URL) {
			debugLog('using WHATSAPP_PROXY_URL for WebSocket agent')
			agent = new HttpsProxyAgent(process.env.WHATSAPP_PROXY_URL)
		} else {
			debugLog('no proxy configured (WHATSAPP_PROXY_URL not set), connecting direct')
		}

		this.socket = new WebSocket(this.url, {
			origin: DEFAULT_ORIGIN,
			headers: this.config.options?.headers as {},
			handshakeTimeout: this.config.connectTimeoutMs,
			timeout: this.config.connectTimeoutMs,
			agent
		})

		this.socket.setMaxListeners(0)

		const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response']

		for (const event of events) {
			this.socket?.on(event, (...args: any[]) => this.emit(event, ...args))
		}
	}

	async close() {
		if (!this.socket) {
			return
		}

		const closePromise = new Promise<void>(resolve => {
			this.socket?.once('close', resolve)
		})

		this.socket.close()

		await closePromise

		this.socket = null
	}
	send(str: string | Uint8Array, cb?: (err?: Error) => void): boolean {
		this.socket?.send(str, cb)

		return Boolean(this.socket)
	}
}
