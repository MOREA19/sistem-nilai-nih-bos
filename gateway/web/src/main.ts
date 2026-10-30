import { getUser, expireSession, hasExpiredSession, initialRoute, logout, remainingTokenSeconds, startTokenClock } from './session.js';
import { icon, type IconName } from './icons.js';
import { renderMasuk } from './pages/masuk.js';
import { renderNilai } from './pages/nilai.js';
import { renderTranskrip } from './pages/transkrip.js';
import { renderKelas } from './pages/kelas.js';
import { renderSimulasi } from './pages/simulasi.js';
import { button, element } from './ui.js';
import type { Peran } from './types.js';

interface MenuItem {
	route: string;
	label: string;
	iconName: IconName;
}

const menus: Record<Peran, MenuItem[]> = {
	mahasiswa: [
		{ route: 'nilai', label: 'Nilai Saya', iconName: 'file-text' },
		{ route: 'transkrip', label: 'Transkrip Saya', iconName: 'graduation-cap' },
		{ route: 'simulasi', label: 'Simulasi Pelanggaran', iconName: 'lock' }
	],
	dosen: [
		{ route: 'kelas', label: 'Kelas Saya', iconName: 'file-text' },
		{ route: 'simulasi', label: 'Simulasi Pelanggaran', iconName: 'lock' }
	],
	admin: [
		{ route: 'transkrip', label: 'Transkrip Mahasiswa', iconName: 'graduation-cap' },
		{ route: 'simulasi', label: 'Simulasi Pelanggaran', iconName: 'lock' }
	]
};

const outlet = document.querySelector<HTMLElement>('#page-content');
const headerUser = document.querySelector<HTMLElement>('#header-user');
const headerRole = document.querySelector<HTMLElement>('#header-role');
const headerDevice = document.querySelector<HTMLElement>('#header-device');
const tokenClock = document.querySelector<HTMLElement>('#token-clock');
const logoutHost = document.querySelector<HTMLElement>('#logout-host');
const navigation = document.querySelector<HTMLElement>('#sidebar-nav');
const sessionBanner = document.querySelector<HTMLElement>('#session-banner');
let expiryHandled = false;

function updateHeader(): void {
	const user = getUser();
	if (headerUser) headerUser.textContent = user?.username ?? 'Belum masuk';
	if (headerRole) headerRole.textContent = user?.role.toUpperCase() ?? 'ANONIM';
	if (headerDevice) headerDevice.textContent = user?.deviceId ?? '—';
	if (sessionBanner) sessionBanner.hidden = !hasExpiredSession();
	if (logoutHost) {
		logoutHost.replaceChildren();
		if (user) {
			const control = button('Keluar', 'log-out');
			control.addEventListener('click', async () => {
				control.disabled = true;
				await logout();
				window.location.hash = '#/masuk';
			});
			logoutHost.append(control);
		}
	}
	updateClock();
}

function updateClock(): void {
	if (!tokenClock) return;
	const seconds = remainingTokenSeconds();
	tokenClock.classList.toggle('expired-soon', seconds !== null && seconds < 60);
	tokenClock.textContent = seconds === null ? '—' : `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
	if (seconds === 0 && getUser() && !expiryHandled) {
		expiryHandled = true;
		expireSession();
	}
}

function renderNavigation(route: string): void {
	if (!navigation) return;
	navigation.replaceChildren();
	const user = getUser();
	if (!user) return;
	menus[user.role].forEach((item, index) => {
		const link = element('a', `nav-link${item.route === route ? ' active' : ''}`);
		link.href = `#/${item.route}`;
		link.dataset.route = item.route;
		link.append(element('span', 'nav-number', String(index + 1).padStart(2, '0')), icon(item.iconName), document.createTextNode(item.label));
		navigation.append(link);
	});
}

function renderRoute(): void {
	if (!outlet) return;
	const requested = window.location.hash.replace(/^#\/?/, '') || 'masuk';
	const user = getUser();
	if (!user && requested !== 'masuk') {
		window.location.hash = '#/masuk';
		return;
	}
	if (user && requested === 'masuk') {
		window.location.hash = initialRoute(user.role);
		return;
	}
	const allowedRoutes = user ? menus[user.role].map((item) => item.route) : ['masuk'];
	if (user && !allowedRoutes.includes(requested)) {
		window.location.hash = initialRoute(user.role);
		return;
	}
	const pages: Record<string, () => HTMLElement> = {
		masuk: renderMasuk,
		nilai: renderNilai,
		transkrip: renderTranskrip,
		kelas: renderKelas,
		simulasi: renderSimulasi
	};
	const render = pages[requested];
	if (!render) {
		window.location.hash = user ? initialRoute(user.role) : '#/masuk';
		return;
	}
	outlet.replaceChildren(render());
	renderNavigation(requested);
}

document.querySelector('#token-icon')?.replaceChildren(icon('clock'));
document.querySelector('#response-icon')?.replaceChildren(icon('server'));
window.addEventListener('session-change', () => {
	if (getUser()) expiryHandled = false;
	updateHeader();
	renderRoute();
});
window.addEventListener('access-token-expired', () => {
	if (getUser() && !expiryHandled) {
		expiryHandled = true;
		expireSession();
	}
});
window.addEventListener('hashchange', renderRoute);
updateHeader();
renderRoute();
startTokenClock(updateClock);