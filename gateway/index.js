require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { catat } = require('./audit');
const { daftarkanAuth } = require('./auth');
const { putuskan } = require('./policy');

const app = express();
const port = Number(process.env.PORT_GATEWAY || 3000);

// Folder ini hanya berisi shell UI dan aset publik, tidak memuat data sensitif.
app.use(express.static(require('node:path').join(__dirname, 'public')));

// Parse JSON sebelum handler autentikasi membaca kredensial dari body.
app.use(express.json({ limit: '32kb' }));

// Endpoint autentikasi ditangani langsung oleh gateway.
daftarkanAuth(app);

function tulisAudit(req, subjek, hasil, alasan) {
	catat(new Date().toISOString(), subjek || 'anonim',
		`${req.method} ${new URL(req.originalUrl, 'http://localhost').pathname}`,
		req.get('X-Device-ID'), hasil, alasan);
}

// Hanya token service-nilai yang boleh meminta gateway menyinkronkan transkrip.
app.post('/transkrip/sinkron', async (req, res) => {
	const authorization = req.get('Authorization') || '';
	const match = /^Bearer\s+(.+)$/i.exec(authorization);
	if (!match) {
		tulisAudit(req, 'anonim', 'deny', 'token_service_tidak_diberikan');
		return res.status(401).json({ error: 'Bearer token service diperlukan' });
	}

	let token;
	try {
		if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET tidak dikonfigurasi');
		token = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
	} catch {
		tulisAudit(req, 'anonim', 'deny', 'token_service_tidak_valid_atau_kedaluwarsa');
		return res.status(401).json({ error: 'Token service tidak valid atau kedaluwarsa' });
	}

	if (token.role !== 'service' || token.sub !== 'service-nilai') {
		tulisAudit(req, String(token.sub || 'anonim'), 'deny', 'hanya_service_nilai_diizinkan');
		return res.status(403).json({ error: 'Hanya token Service Nilai yang diizinkan' });
	}

	const serviceUrl = process.env.URL_SERVICE_TRANSKRIP ||
		`http://127.0.0.1:${process.env.PORT_TRANSKRIP || 3002}`;
	try {
		const upstream = await fetch(`${serviceUrl.replace(/\/$/, '')}/transkrip/sinkron`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${match[1]}`,
				'X-Gateway-Secret': process.env.GATEWAY_SECRET || '',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(req.body)
		});
		const responseBody = await upstream.text();
		if (!upstream.ok) {
			tulisAudit(req, 'service-nilai', 'deny', `service_transkrip_status_${upstream.status}`);
		} else {
			tulisAudit(req, 'service-nilai', 'allow', 'sinkronisasi_transkrip_berhasil');
		}
		res.status(upstream.status);
		if (upstream.headers.get('content-type')) {
			res.set('Content-Type', upstream.headers.get('content-type'));
		}
		return res.send(responseBody);
	} catch (error) {
		tulisAudit(req, 'service-nilai', 'deny', 'service_transkrip_tidak_tersedia');
		return res.status(502).json({ error: 'Gateway gagal menghubungi Service Transkrip' });
	}
});

// Request bisnis melewati verifikasi JWT, device, dan Policy Engine sebelum diteruskan.
app.use(async (req, res, next) => {
	const pathname = new URL(req.originalUrl, 'http://localhost').pathname;
	const jalurNilai = pathname === '/nilai' || /^\/nilai\/\d+$/.test(pathname) ||
		/^\/kelas\/[^/]+\/finalisasi$/.test(pathname);
	const jalurTranskrip = /^\/transkrip\/[^/]+$/.test(pathname);
	if (!jalurNilai && !jalurTranskrip) return next();

	const authorization = req.get('Authorization') || '';
	const match = /^Bearer\s+(.+)$/i.exec(authorization);
	if (!match) {
		tulisAudit(req, 'anonim', 'deny', 'access_token_tidak_diberikan');
		return res.status(401).json({ error: 'Bearer access token diperlukan' });
	}

	let user;
	try {
		if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET tidak dikonfigurasi');
		user = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
	} catch {
		tulisAudit(req, 'anonim', 'deny', 'access_token_tidak_valid_atau_kedaluwarsa');
		return res.status(401).json({ error: 'Access token tidak valid atau kedaluwarsa' });
	}

	const deviceId = req.get('X-Device-ID');
	const device = deviceId && db.prepare(`
		SELECT 1 FROM devices d JOIN users u ON u.id = d.user_id
		WHERE u.id = ? AND d.device_id = ?
	`).get(String(user.sub || ''), deviceId);
	if (!device) {
		tulisAudit(req, String(user.sub || 'anonim'), 'deny', 'device_tidak_terdaftar');
		return res.status(403).json({ error: 'Device tidak terdaftar untuk user ini' });
	}

	const keputusan = putuskan({ method: req.method, path: pathname, query: req.query, user });
	if (!keputusan.allowed) {
		tulisAudit(req, String(user.sub || 'anonim'), 'deny', keputusan.reason);
		return res.status(403).json({ error: 'Akses ditolak', reason: keputusan.reason });
	}

	const serviceUrl = jalurNilai
		? (process.env.URL_SERVICE_NILAI || `http://127.0.0.1:${process.env.PORT_NILAI || 3001}`)
		: (process.env.URL_SERVICE_TRANSKRIP || `http://127.0.0.1:${process.env.PORT_TRANSKRIP || 3002}`);
	try {
		const upstream = await fetch(`${serviceUrl.replace(/\/$/, '')}${req.originalUrl}`, {
			method: req.method,
			headers: {
				'Authorization': `Bearer ${match[1]}`,
				'X-Gateway-Secret': process.env.GATEWAY_SECRET || '',
				'X-Device-ID': deviceId,
				'Content-Type': req.is('application/json') ? 'application/json' : 'application/octet-stream'
			},
			...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: JSON.stringify(req.body || {}) })
		});
		const responseBody = await upstream.text();
		if (!upstream.ok) {
			tulisAudit(req, String(user.sub), 'deny', `service_menolak_status_${upstream.status}`);
		} else {
			tulisAudit(req, String(user.sub), 'allow', keputusan.reason);
		}
		res.status(upstream.status);
		if (upstream.headers.get('content-type')) res.set('Content-Type', upstream.headers.get('content-type'));
		return res.send(responseBody);
	} catch {
		tulisAudit(req, String(user.sub), 'deny', 'service_tujuan_tidak_tersedia');
		return res.status(502).json({ error: 'Gateway gagal menghubungi service tujuan' });
	}
});

// Catat request autentikasi dengan JSON rusak sebagai keputusan deny.
app.use((error, req, res, next) => {
	if (error && error.type === 'entity.parse.failed') {
		catat(new Date().toISOString(), 'anonim', `${req.method} ${req.path}`,
			req.get('X-Device-ID'), 'deny', 'body_json_tidak_valid');
		return res.status(400).json({ error: 'Body JSON tidak valid' });
	}
	return next(error);
});

// Semua route yang tidak diizinkan atau belum terdaftar ditolak secara default.
app.use((req, res) => {
	catat(new Date().toISOString(), 'anonim', `${req.method} ${req.path}`,
		req.get('X-Device-ID'), 'deny', 'endpoint_belum_tersedia');
	res.status(404).json({ error: 'Endpoint belum tersedia' });
});

app.listen(port, '127.0.0.1', () => {
	console.log(`API Gateway berjalan pada port ${port}`);
});