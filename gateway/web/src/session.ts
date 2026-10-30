import { getAccessToken, request, setAccessToken, setRequestDevice } from './api.js';
import { findDemoAccount } from './demo-data.js';
import type { ApiResult, LoginResponse, Peran } from './types.js';

export interface UserState {
	username: string;
	role: Peran;
	deviceId: string;
	nim: string | null;
}

let refreshToken: string | null = null;
let userState: UserState | null = null;
let expiryTimer = 0;
let expired = false;

function announceSession(): void {
	window.dispatchEvent(new Event('session-change'));
}

function tokenExpiry(token: string | null): number | null {
	if (!token) return null;
	try {
		const part = token.split('.')[1];
		if (!part) return null;
		const payload: unknown = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
		if (typeof payload !== 'object' || payload === null) return null;
		const exp = (payload as Record<string, unknown>).exp;
		return typeof exp === 'number' ? exp : null;
	} catch {
		return null;
	}
}

export function getUser(): UserState | null {
	return userState;
}

export function getCurrentDevice(): string {
	return userState?.deviceId ?? '';
}

export function remainingTokenSeconds(): number | null {
	const exp = tokenExpiry(getAccessToken());
	return exp === null ? null : Math.max(0, exp - Math.floor(Date.now() / 1000));
}

export function initialRoute(role: Peran): string {
	if (role === 'dosen') return '#/kelas';
	if (role === 'admin') return '#/transkrip';
	return '#/nilai';
}

export function hasExpiredSession(): boolean {
	return expired;
}

export async function login(username: string, password: string, deviceId: string): Promise<ApiResult<LoginResponse>> {
	setRequestDevice(deviceId);
	const result = await request<LoginResponse>('POST', '/auth/login', {
		body: { username, password }, includeAuth: false, deviceId
	});
	if (result.ok && result.body?.access_token) {
		const account = findDemoAccount(username);
		if (account) {
			setAccessToken(result.body.access_token);
			refreshToken = result.body.refresh_token ?? null;
			userState = { username: account.username, role: account.role, deviceId, nim: account.nim };
			expired = false;
			announceSession();
		}
	}
	return result;
}

export async function logout(): Promise<ApiResult<{ message: string }>> {
	const tokenToRevoke = refreshToken;
	const result: ApiResult<{ message: string }> = tokenToRevoke
		? await request<{ message: string }>('POST', '/auth/logout', { body: { refresh_token: tokenToRevoke } })
		: { status: 0, ok: false, body: null, reason: 'Refresh token tidak tersedia' };
	setAccessToken(null);
	setRequestDevice('');
	refreshToken = null;
	userState = null;
	announceSession();
	return result;
}

export function expireSession(): void {
	if (expired || !userState) return;
	expired = true;
	setAccessToken(null);
	setRequestDevice('');
	refreshToken = null;
	userState = null;
	announceSession();
}

export function startTokenClock(callback: () => void): void {
	window.clearInterval(expiryTimer);
	expiryTimer = window.setInterval(callback, 1000);
}

setRequestDevice('');