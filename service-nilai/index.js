require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const app = express();
const port = Number(process.env.PORT_NILAI || 3001);

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
app.get('/nilai', (req, res) => {
	const subject = String(req.user.sub || '');

	if (req.user.role === 'mahasiswa') {
		const mahasiswa = db.prepare('SELECT nim FROM users WHERE id = ? AND role = ?')
			.get(subject, 'mahasiswa');
		if (!mahasiswa) return res.status(403).json({ error: 'Akun mahasiswa tidak ditemukan' });

		const data = db.prepare(`
			SELECT n.id, n.kelas_id, k.nama AS nama_kelas, n.nim, n.nilai, n.status
			FROM nilai n JOIN kelas k ON k.id = n.kelas_id
			WHERE n.nim = ? ORDER BY n.kelas_id
		`).all(mahasiswa.nim);
		return res.json({ data });
	}

	if (req.user.role === 'dosen') {
		const kelasId = req.query.kelas_id;
		if (typeof kelasId !== 'string' || !kelasId) {
			return res.status(400).json({ error: 'Query kelas_id wajib diisi' });
		}
		const kelas = db.prepare('SELECT id FROM kelas WHERE id = ? AND dosen_id = ?')
			.get(kelasId, subject);
		if (!kelas) return res.status(403).json({ error: 'Kelas bukan kelas yang diampu dosen ini' });

		const data = db.prepare(`
			SELECT n.id, n.kelas_id, k.nama AS nama_kelas, n.nim, n.nilai, n.status
			FROM nilai n JOIN kelas k ON k.id = n.kelas_id
			WHERE n.kelas_id = ? ORDER BY n.nim
		`).all(kelasId);
		return res.json({ data });
	}

	return res.status(403).json({ error: 'Role tidak diizinkan melihat nilai' });
});

app.put('/nilai/:id', (req, res) => {
	if (req.user.role !== 'dosen') {
		return res.status(403).json({ error: 'Hanya dosen yang dapat mengubah nilai' });
	}
	const nilaiBaru = req.body && req.body.nilai;
	if (typeof nilaiBaru !== 'number' || !Number.isFinite(nilaiBaru) || nilaiBaru < 0 || nilaiBaru > 100) {
		return res.status(400).json({ error: 'nilai harus berupa angka dari 0 sampai 100' });
	}

	const nilaiLama = db.prepare(`
		SELECT n.id, n.status, k.dosen_id
		FROM nilai n JOIN kelas k ON k.id = n.kelas_id
		WHERE n.id = ?
	`).get(req.params.id);
	if (!nilaiLama) return res.status(404).json({ error: 'Nilai tidak ditemukan' });
	if (String(nilaiLama.dosen_id) !== String(req.user.sub)) {
		return res.status(403).json({ error: 'Kelas bukan kelas yang diampu dosen ini' });
	}
	if (nilaiLama.status === 'final') {
		return res.status(409).json({ error: 'Nilai sudah final' });
	}

	db.prepare("UPDATE nilai SET nilai = ? WHERE id = ? AND status = 'draft'")
		.run(nilaiBaru, req.params.id);
	res.json({ message: 'Nilai berhasil diperbarui' });
});

app.post('/kelas/:id/finalisasi', async (req, res) => {
	if (req.user.role !== 'dosen') {
		return res.status(403).json({ error: 'Hanya dosen yang dapat memfinalisasi nilai' });
	}

	const kelas = db.prepare('SELECT id, dosen_id FROM kelas WHERE id = ?').get(req.params.id);
	if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan' });
	if (String(kelas.dosen_id) !== String(req.user.sub)) {
		return res.status(403).json({ error: 'Kelas bukan kelas yang diampu dosen ini' });
	}

	const finalisasi = db.transaction(() => {
		db.prepare("UPDATE nilai SET status = 'final' WHERE kelas_id = ? AND status = 'draft'")
			.run(kelas.id);
		return db.prepare(`
			SELECT nim, kelas_id, nilai
			FROM nilai
			WHERE kelas_id = ? AND status = 'final'
			ORDER BY nim
		`).all(kelas.id);
	});
	const daftarNilaiFinal = finalisasi();
	const gatewayUrl = (process.env.GATEWAY_URL || process.env.URL_GATEWAY || 'http://127.0.0.1:3000')
		.replace(/\/$/, '');

	try {
		// Service Nilai meminta token service lewat endpoint autentikasi gateway.
		const tokenResponse = await fetch(`${gatewayUrl}/auth/service`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_id: process.env.SERVICE_CLIENT_ID,
				client_secret: process.env.SERVICE_CLIENT_SECRET
			})
		});
		if (!tokenResponse.ok) {
			const detail = await tokenResponse.text();
			return res.status(502).json({
				error: 'Nilai sudah difinalisasi, tetapi gateway gagal menerbitkan token service',
				status_gateway: tokenResponse.status,
				detail
			});
		}
		const tokenBody = await tokenResponse.json();
		if (!tokenBody.access_token) {
			return res.status(502).json({ error: 'Gateway tidak mengembalikan access token service' });
		}

		// Sinkronisasi selalu melalui gateway, tidak pernah menghubungi port 3002 langsung.
		const syncResponse = await fetch(`${gatewayUrl}/transkrip/sinkron`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${tokenBody.access_token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(daftarNilaiFinal)
		});
		if (!syncResponse.ok) {
			const detail = await syncResponse.text();
			return res.status(502).json({
				error: 'Nilai sudah difinalisasi, tetapi sinkronisasi transkrip gagal',
				status_gateway: syncResponse.status,
				detail
			});
		}

		const hasilSinkron = await syncResponse.json();
		return res.json({
			message: 'Nilai kelas difinalisasi dan transkrip disinkronkan',
			jumlah: daftarNilaiFinal.length,
			sinkronisasi: hasilSinkron
		});
	} catch (error) {
		return res.status(502).json({
			error: 'Nilai sudah difinalisasi, tetapi gateway atau Service Transkrip tidak dapat dihubungi',
			detail: error.message
		});
	}
});

app.listen(port, '127.0.0.1', () => {
	console.log(`Service Nilai berjalan pada port ${port}`);
});