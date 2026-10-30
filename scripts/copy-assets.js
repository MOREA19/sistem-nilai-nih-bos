const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const icons = [
	'log-in', 'log-out', 'file-text', 'graduation-cap', 'check', 'x',
	'play', 'lock', 'clock', 'server', 'user'
];
const weights = ['400', '500', '600'];
const publicRoot = path.join(root, 'gateway', 'public');
const iconRoot = path.join(publicRoot, 'icons');
const fontRoot = path.join(publicRoot, 'fonts');
fs.mkdirSync(iconRoot, { recursive: true });
fs.mkdirSync(fontRoot, { recursive: true });

for (const name of icons) {
	fs.copyFileSync(path.join(root, 'node_modules', 'lucide-static', 'icons', `${name}.svg`), path.join(iconRoot, `${name}.svg`));
}
for (const family of ['ibm-plex-sans', 'ibm-plex-mono']) {
	for (const weight of weights) {
		const filename = `${family}-latin-${weight}-normal.woff2`;
		fs.copyFileSync(path.join(root, 'node_modules', '@fontsource', family, 'files', filename), path.join(fontRoot, filename));
	}
}
console.log(`Aset lokal disalin: ${icons.length} ikon dan ${weights.length * 2} font.`);