import { icon, type IconName } from './icons.js';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

export function field(labelText: string, control: HTMLElement): HTMLElement {
	const wrapper = element('label', 'field');
	wrapper.append(element('span', '', labelText), control);
	return wrapper;
}

export function input(type: string, value = '', placeholder = ''): HTMLInputElement {
	const control = document.createElement('input');
	control.type = type;
	control.value = value;
	control.placeholder = placeholder;
	return control;
}

export function button(text: string, iconName: IconName, variant = ''): HTMLButtonElement {
	const control = element('button', `button ${variant}`.trim());
	control.type = 'button';
	control.append(icon(iconName), document.createTextNode(text));
	return control;
}

export function table(headers: string[]): { node: HTMLTableElement; body: HTMLTableSectionElement } {
	const node = document.createElement('table');
	const head = node.createTHead().insertRow();
	for (const label of headers) {
		const cell = document.createElement('th');
		cell.scope = 'col';
		cell.textContent = label;
		head.append(cell);
	}
	return { node, body: node.createTBody() };
}