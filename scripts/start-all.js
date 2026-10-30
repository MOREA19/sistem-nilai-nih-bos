const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const services = ['service-nilai/index.js', 'service-transkrip/index.js', 'gateway/index.js'];
const children = services.map((script) => spawn(process.execPath, [path.join(root, script)], {
	cwd: root,
	stdio: 'inherit',
	env: process.env
}));

let stopping = false;
function stop(code = 0) {
	if (stopping) return;
	stopping = true;
	for (const child of children) if (child.exitCode === null) child.kill();
	process.exitCode = code;
}

for (const child of children) {
	child.on('error', (error) => {
		console.error(error.message);
		stop(1);
	});
	child.on('exit', (code) => {
		if (!stopping) stop(code ?? 1);
	});
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));