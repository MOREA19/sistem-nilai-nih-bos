import { demoAccounts, findDemoAccount } from '../demo-data.js';
import { initialRoute, login } from '../session.js';
import { button, element, field, input, table } from '../ui.js';

export function renderMasuk(): HTMLElement {
	const page = element('section', 'page');
	const heading = element('div', 'page-heading');
	heading.append(element('p', 'eyebrow', 'AKSES SISTEM'), element('h1', '', 'Masuk'));
	page.append(heading);
	const form = element('form', 'form-grid login-form');
	const username = input('text', '', 'username');
	username.autocomplete = 'username';
	username.required = true;
	const password = input('password', '', 'password');
	password.autocomplete = 'current-password';
	password.required = true;
	const device = input('text', '', 'Otomatis dari username');
	device.readOnly = true;
	device.setAttribute('aria-label', 'Perangkat terpilih');
	const unknownLabel = element('label', 'checkbox-field');
	const unknownDevice = document.createElement('input');
	unknownDevice.type = 'checkbox';
	unknownLabel.append(unknownDevice, element('span', '', 'Gunakan perangkat tidak terdaftar'));
	unknownDevice.addEventListener('change', () => {
		const account = findDemoAccount(username.value.trim());
		device.value = unknownDevice.checked ? 'SALAH-123' : account?.deviceId ?? '';
	});
	username.addEventListener('input', () => {
		if (!unknownDevice.checked) device.value = findDemoAccount(username.value.trim())?.deviceId ?? '';
	});
	form.append(field('Username', username), field('Password', password), field('Perangkat', device));
	form.append(unknownLabel);
	const error = element('p', 'form-message');
	error.setAttribute('role', 'status');
	const submit = button('Masuk', 'log-in', 'primary');
	submit.type = 'submit';
	form.append(error, submit);
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		submit.disabled = true;
		error.textContent = '';
		const account = findDemoAccount(username.value.trim());
		if (!unknownDevice.checked && account) device.value = account.deviceId;
		const result = await login(username.value.trim(), password.value, device.value);
		submit.disabled = false;
		if (result.ok && account) window.location.hash = initialRoute(account.role);
		else error.textContent = result.reason ?? 'Masuk ditolak';
	});
	const accountsHeading = element('h2', 'section-heading', 'Akun demo');
	const accountsTable = table(['Peran', 'Username', 'Perangkat', '']);
	for (const account of demoAccounts) {
		const row = accountsTable.body.insertRow();
		row.insertCell().textContent = account.role;
		row.insertCell().textContent = account.username;
		row.insertCell().textContent = account.deviceId;
		const action = row.insertCell();
		const fill = button('Isi', 'user');
		fill.setAttribute('aria-label', `Isi akun ${account.username}`);
		fill.addEventListener('click', () => {
			username.value = account.username;
			password.value = account.password;
			unknownDevice.checked = false;
			device.value = account.deviceId;
			error.textContent = '';
		});
		action.append(fill);
	}
	page.append(form, accountsHeading, element('div', 'table-wrap'));
	page.lastElementChild?.append(accountsTable.node);
	return page;
}