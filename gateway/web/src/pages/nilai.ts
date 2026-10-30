import { request } from '../api.js';
import { getUser } from '../session.js';
import type { DataResponse, NilaiRow } from '../types.js';
import { element, table } from '../ui.js';

export function renderNilai(): HTMLElement {
	const page = element('section', 'page');
	const heading = element('div', 'page-heading');
	heading.append(element('p', 'eyebrow', '01 / AKADEMIK'), element('h1', '', 'Nilai Saya'));
	const status = element('p', 'form-message');
	status.setAttribute('role', 'status');
	const host = element('div', 'table-wrap');
	page.append(heading, status, host);
	const user = getUser();
	if (!user) return page;
	void request<DataResponse<NilaiRow>>('GET', '/nilai').then((result) => {
		if (!result.ok || !result.body) {
			status.textContent = result.reason ?? `Request gagal (${result.status})`;
			return;
		}
		const grid = table(['Kelas', 'Nilai', 'Status']);
		for (const row of result.body.data) {
			const line = grid.body.insertRow();
			line.insertCell().textContent = `${row.kelas_id} · ${row.nama_kelas}`;
			line.insertCell().textContent = row.nilai.toFixed(2);
			line.insertCell().textContent = row.status === 'final' ? 'Final' : 'Draft';
		}
		status.textContent = result.body.data.length ? `${result.body.data.length} mata kuliah.` : 'Belum ada nilai.';
		host.replaceChildren(grid.node);
	});
	return page;
}