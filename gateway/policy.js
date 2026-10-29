const db = require('../db/database');

// Jam akhir bersifat eksklusif, misalnya 07 sampai 21 berarti [07:00, 21:00).
function dalamJamAkses(now = new Date()) {
	const mulai = Number(process.env.JAM_MULAI);
	const selesai = Number(process.env.JAM_SELESAI);
	if (!Number.isInteger(mulai) || !Number.isInteger(selesai) ||
		mulai < 0 || mulai > 23 || selesai < 0 || selesai > 24 || mulai >= selesai) {
		return false;
	}
	const menitSekarang = now.getHours() * 60 + now.getMinutes();
	return menitSekarang >= mulai * 60 && menitSekarang < selesai * 60;
}

// Tolak secara default; seluruh kepemilikan dan role utama dibaca ulang dari DB.
function putuskan({ method, path, query, user }) {
	const akun = db.prepare('SELECT id, role, nim FROM users WHERE id = ?')
		.get(String(user.sub || ''));
	if (!akun || akun.role !== user.role) {
		return { allowed: false, reason: 'akun_tidak_ditemukan_atau_role_tidak_cocok' };
	}

	if (method === 'GET' && path === '/nilai' &&
		['mahasiswa', 'dosen'].includes(akun.role)) {
		if (akun.role === 'dosen') {
			const kelasId = query.kelas_id;
			if (typeof kelasId !== 'string' || !kelasId) {
				return { allowed: false, reason: 'kelas_id_wajib_untuk_dosen' };
			}
			const kelas = db.prepare('SELECT id FROM kelas WHERE id = ? AND dosen_id = ?')
				.get(kelasId, akun.id);
			if (!kelas) return { allowed: false, reason: 'kelas_bukan_ajaran_dosen' };
		}
		return { allowed: true, reason: 'role_dan_kepemilikan_nilai_valid' };
	}

	const nilaiMatch = /^\/nilai\/(\d+)$/.exec(path);
	if (method === 'PUT' && nilaiMatch && akun.role === 'dosen') {
		const nilai = db.prepare(`
			SELECT n.status, k.dosen_id
			FROM nilai n JOIN kelas k ON k.id = n.kelas_id
			WHERE n.id = ?
		`).get(nilaiMatch[1]);
		if (!nilai || String(nilai.dosen_id) !== String(akun.id)) {
			return { allowed: false, reason: 'nilai_tidak_ada_atau_kelas_bukan_ajaran_dosen' };
		}
		if (nilai.status !== 'draft') return { allowed: false, reason: 'nilai_sudah_final' };
		if (!dalamJamAkses()) return { allowed: false, reason: 'di_luar_jam_akses' };
		return { allowed: true, reason: 'dosen_pengampu_dan_jam_akses_valid' };
	}

	const finalisasiMatch = /^\/kelas\/([^/]+)\/finalisasi$/.exec(path);
	if (method === 'POST' && finalisasiMatch && akun.role === 'dosen') {
		const kelas = db.prepare('SELECT dosen_id FROM kelas WHERE id = ?')
			.get(finalisasiMatch[1]);
		if (!kelas || String(kelas.dosen_id) !== String(akun.id)) {
			return { allowed: false, reason: 'kelas_bukan_ajaran_dosen' };
		}
		if (!dalamJamAkses()) return { allowed: false, reason: 'di_luar_jam_akses' };
		return { allowed: true, reason: 'dosen_pengampu_dan_jam_akses_valid' };
	}

	const transkripMatch = /^\/transkrip\/([^/]+)$/.exec(path);
	if (method === 'GET' && transkripMatch) {
		if (akun.role === 'admin') return { allowed: true, reason: 'admin_diizinkan' };
		if (akun.role === 'mahasiswa' && akun.nim === transkripMatch[1]) {
			return { allowed: true, reason: 'transkrip_milik_sendiri' };
		}
		return { allowed: false, reason: 'transkrip_bukan_milik_sendiri' };
	}

	return { allowed: false, reason: 'endpoint_atau_role_tidak_diizinkan' };
}

module.exports = { dalamJamAkses, putuskan };