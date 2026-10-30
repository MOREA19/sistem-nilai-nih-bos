import type { ApiResult } from './types.js';

export interface RequestOptions {
	body?: unknown;
	deviceId?: string;
	includeAuth?: boolean;
	tokenOverride?: string | null;
	showInDrawer?: boolean;
}

let accessToken: string | null = null;
let activeDeviceId = '';

export function setAccessToken(token: string | null): void {
	accessToken = token;
}

export function getAccessToken(): string | null {
	return accessToken;
}

export function setRequestDevice(deviceId: string): void {
	activeDeviceId = deviceId;
}

function valueFrom(payload: unknown, key: string): string | null {
	if (typeof payload !== 'object' || payload === null || !(key in payload)) return null;
	const value = (payload as Record<string, unknown>)[key];
	return typeof value === 'string' ? value : null;
}

function redactSecrets(text: string): string {
	try {
		const payload: unknown = JSON.parse(text);
		const redact = (value: unknown): unknown => {
			if (Array.isArray(value)) return value.map(redact);
			if (typeof value !== 'object' || value === null) return value;
			return Object.fromEntries(Object.entries(value).map(([key, item]) => {
				const secretField = /password|token|secret/i.test(key);
				return [key, secretField ? '[disamarkan]' : redact(item)];
			}));
		};
		return JSON.stringify(redact(payload), null, 2);
	} catch {
		return text;
	}
}

function updateResponsePanel(method: string, url: string, status: number, requestBody: string, responseText: string): void {
	const methodNode = document.querySelector<HTMLElement>('#response-method');
	const urlNode = document.querySelector<HTMLElement>('#response-url');
	const statusNode = document.querySelector<HTMLElement>('#response-status');
	const requestNode = document.querySelector<HTMLElement>('#response-request');
	if (methodNode) methodNode.textContent = method;
	if (urlNode) urlNode.textContent = url;
	if (statusNode) statusNode.textContent = status ? String(status) : 'Jaringan gagal';
	if (requestNode) requestNode.textContent = redactSecrets(requestBody);
	if (requestNode) requestNode.dataset.response = redactSecrets(responseText || '(respons kosong)');
	const bodyNode = document.querySelector<HTMLElement>('#response-body');
	if (bodyNode) bodyNode.textContent = requestNode?.dataset.response ?? '(respons kosong)';
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
	const headers = new Headers({ 'X-Device-ID': opts.deviceId ?? activeDeviceId });
	const token = opts.tokenOverride === undefined ? accessToken : opts.tokenOverride;
	if (opts.includeAuth !== false && token) headers.set('Authorization', `Bearer ${token}`);
	let requestBody = '';
	if (opts.body !== undefined) {
		headers.set('Content-Type', 'application/json');
		requestBody = JSON.stringify(opts.body, null, 2);
	}

	let status = 0;
	let responseText = '';
	let payload: unknown = null;
	try {
		const response = await fetch(path, {
			method,
			headers,
			...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) })
		});
		status = response.status;
		responseText = await response.text();
		if (responseText) {
			try {
				payload = JSON.parse(responseText) as unknown;
			} catch {
				payload = { raw: responseText };
			}
		}
	} catch (error) {
		payload = { error: error instanceof Error ? error.message : 'Permintaan gagal' };
	}
	if (opts.showInDrawer !== false) {
		updateResponsePanel(method, path, status, requestBody || '(tanpa body)', responseText || JSON.stringify(payload, null, 2));
	}
	if (status === 401 && opts.tokenOverride === undefined && opts.includeAuth !== false && accessToken) {
		window.dispatchEvent(new Event('access-token-expired'));
	}
	return {
		status,
		ok: status >= 200 && status < 300,
		body: payload as T | null,
		reason: valueFrom(payload, 'reason') ?? valueFrom(payload, 'error')
	};
}