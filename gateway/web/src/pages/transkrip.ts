import { studentsForAdmin } from '../demo-data.js';
import { request } from '../api.js';
import { getUser } from '../session.js';
import type { TranskripResponse } from '../types.js';
import { button, element, table } from '../ui.js';

export function renderTranskrip(): HTMLElement {
	const page = element('section', 'page');
	const user = getUser();
	const heading = element('div', 'page-heading');
	const title = user?.role === 'admin' ? 'Transkrip Mahasiswa' : 'Transkrip Saya';
	heading.append(element('p', 'eyebrow', 'AKADEMIK'), element('h1', '', title));
	const message = element('p', 'form-message');
	message.setAttribute('role', 'status');
	const host = element('div', 'table-wrap');
	page.append(heading);
	if (user?.role === 'admin') {
		const listHeading = element('h2', 'section-heading', 'Pilih mahasiswa');
		const studentList = element('div', 'student-list');
		for (const student of studentsForAdmin()) {
			const select = button(`${student.username} · ${student.nim ?? ''}`, 'user');
			select.addEventListener('click', () => void loadTranscript(student.nim ?? '', select, studentList, host, message));
			studentList.append(select);
		}
		page.append(listHeading, studentList, message, host);
		return page;
	}
	page.append(message, host);
	if (user?.nim) void loadTranscript(user.nim, null, page, host, message);
	return page;
}

async function loadTranscript(nim: string, action: HTMLButtonElement | null, list: HTMLElement, host: HTMLElement, message: HTMLElement): Promise<void> {
	if (!nim) return;
	if (action) action.disabled = true;
	list.querySelectorAll('button').forEach((buttonNode) => { buttonNode.disabled = true; });
	const result = await request<TranskripResponse>('GET', `/transkrip/${encodeURIComponent(nim)}`);
	list.querySelectorAll('button').forEach((buttonNode) => { buttonNode.disabled = false; });
	if (!result.ok || !result.body) {
		message.textContent = result.reason ?? `Request gagal (${result.status})`;
		host.replaceChildren();
		return;
	}
	if (result.body.data.length === 0) {
		message.textContent = 'Belum ada nilai tersinkron';
		host.replaceChildren();
		return;
	}
	message.textContent = `${result.body.nim} · ${result.body.data.length} mata kuliah.`;
	const grid = table(['Kelas', 'Mata kuliah', 'Nilai']);
	for (const row of result.body.data) {
		const line = grid.body.insertRow();
		line.insertCell().textContent = row.kelas_id;
		line.insertCell().textContent = row.nama_kelas;
		line.insertCell().textContent = row.nilai.toFixed(2);
	}
	host.replaceChildren(grid.node);
}