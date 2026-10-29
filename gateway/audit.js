const db = require('../db/database');

// Simpan keputusan autentikasi agar kejadian sukses maupun gagal dapat ditelusuri.
function catat(waktu, subjek, endpoint, device, hasil, alasan) {
	db.prepare(`
		INSERT INTO audit_log (waktu, subjek, endpoint, device, hasil, alasan)
		VALUES (?, ?, ?, ?, ?, ?)
	`).run(waktu, subjek, endpoint, device || null, hasil, alasan);
}

module.exports = { catat };