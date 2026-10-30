import { classesForTeacher } from '../demo-data.js';
import { request } from '../api.js';
import { getUser } from '../session.js';
import { button, element, input, table } from '../ui.js';
export function renderKelas() {
    const page = element('section', 'page');
    const user = getUser();
    const teacherClasses = user ? classesForTeacher(user.username) : [];
    const heading = element('div', 'page-heading');
    heading.append(element('p', 'eyebrow', 'AKADEMIK'), element('h1', '', 'Kelas Saya'));
    const classTabs = element('div', 'segmented-control');
    const summary = element('p', 'form-message');
    const tableHost = element('div', 'table-wrap');
    const finalizationButton = button('Finalisasi Kelas', 'lock', 'primary');
    const topControls = element('div', 'page-actions');
    topControls.append(finalizationButton);
    const info = element('p', 'muted-note', 'Nama mahasiswa tidak tersedia pada data seed.');
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    const dialogHeading = element('h2', '', 'Finalisasi kelas');
    const dialogText = element('p', '', 'Nilai draft di kelas ini akan dikunci dan disinkronkan ke transkrip.');
    const dialogActions = element('div', 'dialog-actions');
    const cancel = button('Batal', 'x');
    const confirm = button('Finalisasi', 'lock', 'primary');
    dialogActions.append(cancel, confirm);
    dialog.append(dialogHeading, dialogText, dialogActions);
    page.append(heading, classTabs, topControls, summary, info, tableHost, dialog);
    let selectedClass = teacherClasses[0]?.id ?? '';
    let rows = [];
    let requestBusy = false;
    const renderTabs = () => {
        classTabs.replaceChildren();
        for (const demoClass of teacherClasses) {
            const tab = button(`${demoClass.id} · ${demoClass.name}`, 'file-text', selectedClass === demoClass.id ? 'selected' : '');
            tab.setAttribute('aria-pressed', String(selectedClass === demoClass.id));
            tab.addEventListener('click', () => {
                if (requestBusy || selectedClass === demoClass.id)
                    return;
                selectedClass = demoClass.id;
                summary.textContent = '';
                renderTabs();
                void loadGrades();
            });
            classTabs.append(tab);
        }
    };
    const updateFinalizeState = () => {
        finalizationButton.disabled = requestBusy || rows.length === 0 || rows.every((row) => row.status === 'final');
    };
    const renderRows = () => {
        const grid = table(['NIM', 'Nama', 'Nilai', 'Status', 'Aksi']);
        for (const row of rows) {
            const line = grid.body.insertRow();
            line.insertCell().textContent = row.nim;
            line.insertCell().textContent = 'Tidak tersedia pada data seed';
            const gradeCell = line.insertCell();
            gradeCell.textContent = row.nilai.toFixed(2);
            const statusCell = line.insertCell();
            statusCell.textContent = row.status === 'final' ? 'Final' : 'Draft';
            const actionCell = line.insertCell();
            if (row.status === 'final') {
                actionCell.textContent = 'Final';
                continue;
            }
            const edit = button('Ubah', 'file-text');
            actionCell.append(edit);
            edit.addEventListener('click', () => {
                gradeCell.replaceChildren();
                actionCell.replaceChildren();
                const gradeInput = input('number', String(row.nilai));
                gradeInput.min = '0';
                gradeInput.max = '100';
                gradeInput.step = '0.01';
                gradeInput.setAttribute('aria-label', `Nilai baru untuk ${row.nim}`);
                gradeCell.append(gradeInput);
                const save = button('Simpan', 'check');
                const discard = button('Batal', 'x');
                actionCell.append(save, discard);
                discard.addEventListener('click', renderRows);
                save.addEventListener('click', async () => {
                    const value = Number(gradeInput.value);
                    if (gradeInput.value === '' || !Number.isFinite(value) || value < 0 || value > 100) {
                        summary.textContent = 'Nilai harus berupa angka dari 0 sampai 100.';
                        return;
                    }
                    save.disabled = true;
                    discard.disabled = true;
                    requestBusy = true;
                    const result = await request('PUT', `/nilai/${row.id}`, { body: { nilai: value } });
                    requestBusy = false;
                    if (!result.ok) {
                        summary.textContent = result.reason ?? `Request gagal (${result.status})`;
                        renderRows();
                        return;
                    }
                    summary.textContent = 'Nilai berhasil diperbarui.';
                    await loadGrades();
                });
            });
        }
        tableHost.replaceChildren(grid.node);
        updateFinalizeState();
    };
    async function loadGrades() {
        if (!selectedClass || requestBusy)
            return;
        requestBusy = true;
        finalizationButton.disabled = true;
        const result = await request('GET', `/nilai?kelas_id=${encodeURIComponent(selectedClass)}`);
        requestBusy = false;
        if (!result.ok || !result.body) {
            summary.textContent = result.reason ?? `Request gagal (${result.status})`;
            rows = [];
            tableHost.replaceChildren();
            updateFinalizeState();
            return;
        }
        rows = result.body.data;
        if (!summary.textContent)
            summary.textContent = `${rows.length} baris nilai.`;
        renderRows();
    }
    finalizationButton.addEventListener('click', () => dialog.showModal());
    cancel.addEventListener('click', () => dialog.close());
    confirm.addEventListener('click', async () => {
        if (!selectedClass || requestBusy)
            return;
        confirm.disabled = true;
        cancel.disabled = true;
        requestBusy = true;
        const result = await request('POST', `/kelas/${encodeURIComponent(selectedClass)}/finalisasi`, { body: {} });
        requestBusy = false;
        confirm.disabled = false;
        cancel.disabled = false;
        dialog.close();
        if (!result.ok || !result.body) {
            summary.textContent = result.reason ?? `Request gagal (${result.status})`;
            updateFinalizeState();
            return;
        }
        const syncMessage = result.body.sinkronisasi?.message ?? 'Status sinkronisasi tidak tersedia.';
        summary.textContent = `${result.body.jumlah} baris final. ${syncMessage}`;
        await loadGrades();
    });
    if (teacherClasses.length === 0) {
        summary.textContent = 'Tidak ada kelas yang tercatat untuk akun ini di data demo.';
        finalizationButton.disabled = true;
    }
    else {
        renderTabs();
        void loadGrades();
    }
    return page;
}
