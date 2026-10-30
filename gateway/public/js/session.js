import { getAccessToken, request, setAccessToken, setRequestDevice } from './api.js';
import { findDemoAccount } from './demo-data.js';
let refreshToken = null;
let userState = null;
let expiryTimer = 0;
let expired = false;
function announceSession() {
    window.dispatchEvent(new Event('session-change'));
}
function tokenExpiry(token) {
    if (!token)
        return null;
    try {
        const part = token.split('.')[1];
        if (!part)
            return null;
        const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        if (typeof payload !== 'object' || payload === null)
            return null;
        const exp = payload.exp;
        return typeof exp === 'number' ? exp : null;
    }
    catch {
        return null;
    }
}
export function getUser() {
    return userState;
}
export function getCurrentDevice() {
    return userState?.deviceId ?? '';
}
export function remainingTokenSeconds() {
    const exp = tokenExpiry(getAccessToken());
    return exp === null ? null : Math.max(0, exp - Math.floor(Date.now() / 1000));
}
export function initialRoute(role) {
    if (role === 'dosen')
        return '#/kelas';
    if (role === 'admin')
        return '#/transkrip';
    return '#/nilai';
}
export function hasExpiredSession() {
    return expired;
}
export async function login(username, password, deviceId) {
    setRequestDevice(deviceId);
    const result = await request('POST', '/auth/login', {
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
export async function logout() {
    const tokenToRevoke = refreshToken;
    const result = tokenToRevoke
        ? await request('POST', '/auth/logout', { body: { refresh_token: tokenToRevoke } })
        : { status: 0, ok: false, body: null, reason: 'Refresh token tidak tersedia' };
    setAccessToken(null);
    setRequestDevice('');
    refreshToken = null;
    userState = null;
    announceSession();
    return result;
}
export function expireSession() {
    if (expired || !userState)
        return;
    expired = true;
    setAccessToken(null);
    setRequestDevice('');
    refreshToken = null;
    userState = null;
    announceSession();
}
export function startTokenClock(callback) {
    window.clearInterval(expiryTimer);
    expiryTimer = window.setInterval(callback, 1000);
}
setRequestDevice('');
