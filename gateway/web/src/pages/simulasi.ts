import { demoAccounts, findDemoAccount } from '../demo-data.js';
import { request } from '../api.js';
import { icon } from '../icons.js';
import type { ApiResult, DataResponse, LoginResponse, NilaiRow } from '../types.js';
import { getUser } from '../session.js';
import { button, element, field, input, table } from '../ui.js';

interface ScenarioRun {
	result: ApiResult<unknown>;
	setupError?: string;
}

interface Scenario {
	name: string;
	expectedAllowed: boolean;
	run: () => Promise<ScenarioRun>;
}

const account = (username: string) => findDemoAccount(username)!;

async function loginTest(username: string): Promise<ApiResult<LoginResponse>> {
	const demoAccount = account(username);
	return request<LoginResponse>('POST', '/auth/login', {
		body: { username: demoAccount.username, password: demoAccount.password },
		includeAuth: false,
		deviceId: demoAccount.deviceId,
		showInDrawer: false
	});
}

function setupError(message: string): ScenarioRun {
	return { result: { status: 0, ok: false, body: null, reason: message }, setupError: message };
}

const scenarios: Scenario[] = [
	{
		name: 'Login perangkat tidak terdaftar', expectedAllowed: false,
		run: async () => ({ result: await request<LoginResponse>('POST', '/auth/login', {
			body: { username: 'mhs1', password: account('mhs1').password },
			includeAuth: false, deviceId: 'SALAH-123'
		}) })
	},
	{
		name: 'Request tanpa token', expectedAllowed: false,
		run: async () => ({ result: await request<unknown>('GET', '/nilai', {
			includeAuth: false, deviceId: account('mhs1').deviceId
		}) })
	},
	{
		name: 'Token rusak', expectedAllowed: false,
		run: async () => ({ result: await request<unknown>('GET', '/nilai', {
			tokenOverride: 'token-rusak', deviceId: account('mhs1').deviceId
		}) })
	},
	{
		name: 'Mahasiswa lihat transkrip mahasiswa lain', expectedAllowed: false,
		run: async () => {
			const login = await loginTest('mhs1');
			if (!login.ok || !login.body?.access_token) return setupError(login.reason ?? 'Login demo gagal');
			return { result: await request<unknown>('GET', '/transkrip/2026002', {
				tokenOverride: login.body.access_token, deviceId: account('mhs1').deviceId
			}) };
		}
	},
	{
		name: 'Admin lihat transkrip', expectedAllowed: true,
		run: async () => {
			const login = await loginTest('admin');
			if (!login.ok || !login.body?.access_token) return setupError(login.reason ?? 'Login admin gagal');
			return { result: await request<unknown>('GET', '/transkrip/2026001', {
				tokenOverride: login.body.access_token, deviceId: account('admin').deviceId
			}) };
		}
	},
	{
		name: 'Dosen ubah nilai kelas yang tidak diampu', expectedAllowed: false,
		run: async () => {
			const otherTeacher = await loginTest('dosen2');
			if (!otherTeacher.ok || !otherTeacher.body?.access_token) return setupError(otherTeacher.reason ?? 'Login dosen2 gagal');
			const grades = await request<DataResponse<NilaiRow>>('GET', '/nilai?kelas_id=IF202', {
				tokenOverride: otherTeacher.body.access_token,
				deviceId: account('dosen2').deviceId,
				showInDrawer: false
			});
			const firstGrade = grades.body?.data[0];
			if (!grades.ok || !firstGrade) return setupError(grades.reason ?? 'Nilai kelas IF202 tidak ditemukan');
			const teacher = await loginTest('dosen1');
			if (!teacher.ok || !teacher.body?.access_token) return setupError(teacher.reason ?? 'Login dosen1 gagal');
			return { result: await request<unknown>('PUT', `/nilai/${firstGrade.id}`, {
				body: { nilai: firstGrade.nilai },
				tokenOverride: teacher.body.access_token,
				deviceId: account('dosen1').deviceId
			}) };
		}
	},
	{
		name: 'Dosen ubah nilai yang sudah final', expectedAllowed: false,
		run: async () => {
			const teacher = await loginTest('dosen1');
			if (!teacher.ok || !teacher.body?.access_token) return setupError(teacher.reason ?? 'Login dosen1 gagal');
			const token = teacher.body.access_token;
			let grades = await request<DataResponse<NilaiRow>>('GET', '/nilai?kelas_id=IF101', {
				tokenOverride: token, deviceId: account('dosen1').deviceId, showInDrawer: false
			});
			if (!grades.ok || !grades.body) return setupError(grades.reason ?? 'Daftar IF101 tidak dapat dimuat');
			let finalGrade = grades.body.data.find((row) => row.status === 'final');
			if (!finalGrade) {
				const finalized = await request<unknown>('POST', '/kelas/IF101/finalisasi', {
					body: {}, tokenOverride: token, deviceId: account('dosen1').deviceId, showInDrawer: false
				});
				if (!finalized.ok) return setupError(finalized.reason ?? 'Finalisasi prasyarat ditolak');
				grades = await request<DataResponse<NilaiRow>>('GET', '/nilai?kelas_id=IF101', {
					tokenOverride: token, deviceId: account('dosen1').deviceId, showInDrawer: false
				});
				finalGrade = grades.body?.data.find((row) => row.status === 'final');
			}
			if (!finalGrade) return setupError('Tidak ditemukan nilai final di IF101');
			return { result: await request<unknown>('PUT', `/nilai/${finalGrade.id}`, {
				body: { nilai: finalGrade.nilai }, tokenOverride: token, deviceId: account('dosen1').deviceId
			}) };
		}
	},
	{
		name: 'Token dosen ke /transkrip/sinkron', expectedAllowed: false,
		run: async () => {
			const teacher = await loginTest('dosen1');
			if (!teacher.ok || !teacher.body?.access_token) return setupError(teacher.reason ?? 'Login dosen1 gagal');
			return { result: await request<unknown>('POST', '/transkrip/sinkron', {
				body: [], tokenOverride: teacher.body.access_token, deviceId: account('dosen1').deviceId
			}) };
		}
	},
	{
		name: 'Refresh setelah logout', expectedAllowed: false,
		run: async () => {
			const login = await loginTest('mhs1');
			const token = login.body?.refresh_token;
			if (!login.ok || !token) return setupError(login.reason ?? 'Refresh token tidak tersedia');
			const loggedOut = await request<unknown>('POST', '/auth/logout', {
				body: { refresh_token: token }, includeAuth: false,
				deviceId: account('mhs1').deviceId, showInDrawer: false
			});
			if (!loggedOut.ok) return setupError(loggedOut.reason ?? 'Logout skenario gagal');
			return { result: await request<unknown>('POST', '/auth/refresh', {
				body: { refresh_token: token }, includeAuth: false, deviceId: account('mhs1').deviceId
			}) };
		}
	}
];

export function renderSimulasi(): HTMLElement {
	const page = element('section', 'page');
	const heading = element('div', 'page-heading');
	heading.append(element('p', 'eyebrow', 'VERIFIKASI'), element('h1', '', 'Simulasi Pelanggaran'));
	const autoHeading = element('h2', 'section-heading', 'Skenario otomatis');
	const runAll = button('Jalankan semua', 'play', 'primary');
	const warning = element('p', 'manual-note', 'Skenario nilai final dapat memfinalisasi IF101 sebagai prasyarat. Untuk memulihkan data demo, jalankan npm run seed di terminal. Skenario menggunakan sesi terpisah dan tidak mengganti sesi Anda.');
	const resultTable = table(['Skenario', 'Harapan', 'Status HTTP', 'Alasan dari gateway', 'Hasil', '']);
	const rowControls = scenarios.map((scenario) => {
		const row = resultTable.body.insertRow();
		row.insertCell().textContent = scenario.name;
		const expected = row.insertCell();
		expected.append(statusBadge(scenario.expectedAllowed));
		const status = row.insertCell();
		status.className = 'mono';
		status.textContent = '—';
		const reason = row.insertCell();
		reason.className = 'reason-cell';
		reason.textContent = 'Belum dijalankan';
		const outcome = row.insertCell();
		outcome.className = 'mono result-cell';
		outcome.textContent = '—';
		const actionCell = row.insertCell();
		const run = button('Jalankan', 'play');
		actionCell.append(run);
		return { scenario, status, reason, outcome, run };
	});

	const execute = async (index: number): Promise<void> => {
		const item = rowControls[index];
		item.run.disabled = true;
		item.outcome.textContent = 'Berjalan';
		try {
			const run = await item.scenario.run();
			const passed = !run.setupError && run.result.ok === item.scenario.expectedAllowed;
			item.status.textContent = run.result.status ? String(run.result.status) : '—';
			item.reason.textContent = run.setupError ?? run.result.reason ?? 'Tidak ada alasan pada body respons gateway.';
			item.outcome.replaceChildren(icon(passed ? 'check' : 'x'), document.createTextNode(passed ? 'LULUS' : 'GAGAL'));
			item.outcome.className = `mono result-cell ${passed ? 'pass' : 'fail'}`;
		} catch (error) {
			item.status.textContent = '—';
			item.reason.textContent = error instanceof Error ? error.message : 'Pengujian gagal';
			item.outcome.textContent = 'GAGAL';
			item.outcome.className = 'mono result-cell fail';
		} finally {
			item.run.disabled = false;
		}
	};

	runAll.addEventListener('click', async () => {
		runAll.disabled = true;
		for (let index = 0; index < rowControls.length; index += 1) await execute(index);
		runAll.disabled = false;
	});
	rowControls.forEach((item, index) => item.run.addEventListener('click', () => void execute(index)));

	const manualHeading = element('h2', 'section-heading', 'Percobaan manual');
	const manualNote = element('p', 'muted-note', 'Untuk demo di video. Jam akses dan akses langsung ke port 3001/3002 diuji manual di terminal dan lewat .env.');
	const form = element('form', 'manual-form');
	const endpoint = document.createElement('select');
	const endpointOptions = [
		{ value: 'nilai', label: 'GET /nilai' },
		{ value: 'transkrip', label: 'GET /transkrip/:nim' },
		{ value: 'ubah', label: 'PUT /nilai/:id' },
		{ value: 'finalisasi', label: 'POST /kelas/:id/finalisasi' },
		{ value: 'sinkron', label: 'POST /transkrip/sinkron' }
	];
	for (const item of endpointOptions) {
		const option = document.createElement('option');
		option.value = item.value;
		option.textContent = item.label;
		endpoint.append(option);
	}
	const nim = input('text', '', 'NIM');
	const gradeId = input('number', '', 'ID nilai');
	const classId = input('text', '', 'ID kelas');
	const gradeValue = input('number', '', 'Nilai baru');
	gradeValue.min = '0';
	gradeValue.max = '100';
	gradeValue.step = '0.01';
	const device = document.createElement('select');
	const currentUser = getUser();
	const otherDevice = demoAccounts.find((demoAccount) => demoAccount.deviceId !== currentUser?.deviceId);
	const deviceOptions = [
		{ value: currentUser?.deviceId ?? '', label: `Device sesi · ${currentUser?.deviceId ?? ''}` },
		{ value: otherDevice?.deviceId ?? '', label: `Device akun lain · ${otherDevice?.deviceId ?? ''}` },
		{ value: 'SALAH-123', label: 'Perangkat tidak terdaftar · SALAH-123' }
	];
	for (const item of deviceOptions) {
		const option = document.createElement('option');
		option.value = item.value;
		option.textContent = item.label;
		device.append(option);
	}
	const nimField = field('NIM', nim);
	const gradeIdField = field('ID nilai', gradeId);
	const classIdField = field('ID kelas', classId);
	const gradeValueField = field('Nilai', gradeValue);
	const deviceField = field('Perangkat request', device);
	const send = button('Kirim percobaan', 'play');
	send.type = 'submit';
	const validationMessage = element('p', 'manual-error');
	validationMessage.setAttribute('role', 'status');
	const manualResult = element('section', 'manual-result');
	manualResult.setAttribute('aria-live', 'polite');
	const confirmDialog = document.createElement('dialog');
	confirmDialog.className = 'confirm-dialog';
	const confirmHeading = element('h2', '', 'Konfirmasi finalisasi');
	const confirmMessage = element('p', '', 'Finalisasi akan mengunci nilai draft dan memperbarui transkrip kelas.');
	const confirmActions = element('div', 'dialog-actions');
	const cancelFinalize = button('Batal', 'x');
	const acceptFinalize = button('Lanjutkan', 'check', 'primary');
	confirmActions.append(cancelFinalize, acceptFinalize);
	confirmDialog.append(confirmHeading, confirmMessage, confirmActions);
	form.append(field('Endpoint', endpoint), nimField, gradeIdField, classIdField, gradeValueField, deviceField, validationMessage, send);
	page.append(confirmDialog);

	const updateManualFields = (): void => {
		const kind = endpoint.value;
		nimField.hidden = kind !== 'transkrip';
		gradeIdField.hidden = kind !== 'ubah';
		const classRequired = (kind === 'nilai' && currentUser?.role === 'dosen') || kind === 'finalisasi';
		classIdField.hidden = !classRequired;
		gradeValueField.hidden = kind !== 'ubah';
		nim.required = kind === 'transkrip';
		gradeId.required = kind === 'ubah';
		classId.required = classRequired;
		gradeValue.required = kind === 'ubah';
		validationMessage.textContent = '';
	};
	endpoint.addEventListener('change', updateManualFields);
	updateManualFields();
	const sendManualRequest = async (): Promise<void> => {
		const kind = endpoint.value;
		let path = '/nilai';
		let method = 'GET';
		let body: unknown;
		if (kind === 'transkrip') path = `/transkrip/${encodeURIComponent(nim.value.trim())}`;
		if (kind === 'nilai' && currentUser?.role === 'dosen') path += `?kelas_id=${encodeURIComponent(classId.value.trim())}`;
		if (kind === 'ubah') {
			method = 'PUT';
			path = `/nilai/${encodeURIComponent(gradeId.value.trim())}`;
			body = { nilai: Number(gradeValue.value) };
		}
		if (kind === 'finalisasi') {
			method = 'POST';
			path = `/kelas/${encodeURIComponent(classId.value.trim())}/finalisasi`;
			body = {};
		}
		if (kind === 'sinkron') {
			method = 'POST';
			path = '/transkrip/sinkron';
			body = [];
		}
		send.disabled = true;
		validationMessage.textContent = '';
		manualResult.replaceChildren(element('p', 'muted-note', 'Request berjalan.'));
		try {
			const result = await request<unknown>(method, path, {
				...(body === undefined ? {} : { body }), deviceId: device.value
			});
			const raw = element('pre', 'manual-json', JSON.stringify(result.body, null, 2) ?? '(respons kosong)');
			manualResult.replaceChildren(
				element('p', result.ok ? 'manual-success' : 'manual-error', `HTTP ${result.status || 'gagal'} · ${result.reason ?? (result.ok ? 'Permintaan diizinkan.' : 'Tidak ada alasan pada respons.')}`),
				raw
			);
		} finally {
			send.disabled = false;
		}
	};
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		validationMessage.textContent = '';
		if (endpoint.value === 'ubah' && (!Number.isFinite(Number(gradeValue.value)) || Number(gradeValue.value) < 0 || Number(gradeValue.value) > 100)) {
			validationMessage.textContent = 'Nilai harus berupa angka dari 0 sampai 100.';
			return;
		}
		if (endpoint.value === 'finalisasi') {
			confirmMessage.textContent = `Finalisasi ${classId.value.trim()} akan mengunci semua nilai draft di kelas ini dan memperbarui transkrip.`;
			confirmDialog.showModal();
			return;
		}
		void sendManualRequest();
	});
	cancelFinalize.addEventListener('click', () => confirmDialog.close());
	acceptFinalize.addEventListener('click', async () => {
		acceptFinalize.disabled = true;
		cancelFinalize.disabled = true;
		confirmDialog.close();
		await sendManualRequest();
		acceptFinalize.disabled = false;
		cancelFinalize.disabled = false;
	});

	page.append(heading, autoHeading, runAll, warning, element('div', 'table-wrap'), manualHeading, manualNote, form, manualResult);
	page.querySelector<HTMLElement>('.table-wrap')?.append(resultTable.node);
	return page;
}

function statusBadge(allowed: boolean): HTMLElement {
	const badge = element('span', `status-badge ${allowed ? 'allowed' : 'denied'}`);
	badge.append(icon(allowed ? 'check' : 'x'), document.createTextNode(allowed ? 'DIIZINKAN' : 'DITOLAK'));
	return badge;
}
