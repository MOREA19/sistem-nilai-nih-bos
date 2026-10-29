require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const app = express();
const port = Number(process.env.PORT_TRANSKRIP || 3002);

// Setiap request wajib datang dari gateway dan membawa JWT yang masih valid.
app.use((req, res, next) => {
	if (!process.env.GATEWAY_SECRET || req.get('X-Gateway-Secret') !== process.env.GATEWAY_SECRET) {
		return res.status(403).json({ error: 'Request harus berasal dari gateway' });
	}

	const authorization = req.get('Authorization') || '';
	const match = /^Bearer\s+(.+)$/i.exec(authorization);
	if (!match || !process.env.JWT_SECRET) {
		return res.status(401).json({ error: 'Bearer token diperlukan' });
	}

	try {
		req.user = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
		next();
	} catch {
		return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
	}
});

app.use(express.json());

// Pengecekan role dan kepemilikan ini adalah defense in depth.
// Keputusan akses utama tetap menjadi tanggung jawab Policy Engine gateway.
app.get('/transkrip/:nim', (req, res) => {
	const { nim } = req.params;

	if (req.user.role === 'mahasiswa') {
		const mahasiswa = db.prepare('SELECT nim FROM users WHERE id = ? AND role = ?')
			.get(String(req.user.sub || ''), 'mahasiswa');
		if (!mahasiswa || mahasiswa.nim !== nim) {
			return res.status(403).json({ error: 'Mahasiswa hanya dapat melihat transkrip miliknya' });
		}
	} else if (req.user.role !== 'admin') {
		return res.status(403).json({ error: 'Role tidak diizinkan melihat transkrip' });
	}

	const mahasiswa = db.prepare('SELECT nim FROM users WHERE nim = ? AND role = ?')
		.get(nim, 'mahasiswa');
	if (!mahasiswa) return res.status(404).json({ error: 'Mahasiswa tidak ditemukan' });

	const data = db.prepare(`
		SELECT t.id, t.nim, t.kelas_id, k.nama AS nama_kelas, t.nilai
		FROM transkrip t JOIN kelas k ON k.id = t.kelas_id
		WHERE t.nim = ? ORDER BY t.kelas_id
	`).all(nim);
	res.json({ nim, data });
});

app.post('/transkrip/sinkron', (req, res) => {
	if (req.user.role !== 'service' || req.user.sub !== 'service-nilai') {
		return res.status(403).json({ error: 'Hanya token service yang dapat menyinkronkan transkrip' });
	}

	const daftar = Array.isArray(req.body) ? req.body : req.body && req.body.data;
	if (!Array.isArray(daftar)) {
		return res.status(400).json({ error: 'Body harus berupa array atau memiliki properti data berupa array' });
	}

	for (const item of daftar) {
		if (!item || typeof item.nim !== 'string' || typeof item.kelas_id !== 'string' ||
				typeof item.nilai !== 'number' || !Number.isFinite(item.nilai) || item.nilai < 0 || item.nilai > 100) {
			return res.status(400).json({ error: 'Setiap item harus berisi nim, kelas_id, dan nilai 0 sampai 100' });
		}
		const nilaiFinal = db.prepare(`
			SELECT nilai FROM nilai
			WHERE nim = ? AND kelas_id = ? AND status = 'final'
		`).get(item.nim, item.kelas_id);
		if (!nilaiFinal || Number(nilaiFinal.nilai) !== item.nilai) {
			return res.status(409).json({ error: 'Data sinkronisasi harus cocok dengan nilai final di database' });
		}
	}

	const upsert = db.prepare(`
		INSERT INTO transkrip (nim, kelas_id, nilai)
		VALUES (@nim, @kelas_id, @nilai)
		ON CONFLICT(nim, kelas_id) DO UPDATE SET nilai = excluded.nilai
	`);
	const simpanSemua = db.transaction((items) => {
		for (const item of items) upsert.run(item);
	});

	try {
		simpanSemua(daftar);
	} catch {
		return res.status(400).json({ error: 'NIM atau kelas_id tidak ditemukan' });
	}

	res.json({ message: 'Transkrip berhasil disinkronkan', jumlah: daftar.length });
});

app.listen(port, '127.0.0.1', () => {
	console.log(`Service Transkrip berjalan pada port ${port}`);
});