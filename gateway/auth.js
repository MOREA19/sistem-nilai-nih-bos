const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { catat } = require('./audit');

const ACCESS_TOKEN_SECONDS = 10 * 60;
const REFRESH_TOKEN_SECONDS = 24 * 60 * 60;

// Catat semua keputusan autentikasi dengan waktu UTC dan alasan yang jelas.
function audit(req, subjek, hasil, alasan) {
	catat(
		new Date().toISOString(),
		subjek || 'anonim',
		`${req.method} ${req.path}`,
		req.get('X-Device-ID'),
		hasil,
		alasan
	);
}

// Terbitkan access token dengan sub dan role, berlaku sepuluh menit.
function buatAccessToken(userId, role) {
	return jwt.sign(
		{ role },
		process.env.JWT_SECRET,
		{ subject: String(userId), expiresIn: ACCESS_TOKEN_SECONDS }
	);
}

// Buat token acak untuk client dan simpan hanya hash SHA-256 ke database.
function buatRefreshToken(userId) {
	const token = crypto.randomBytes(48).toString('base64url');
	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
	const expiresAt = new Date(Date.now() + REFRESH_TOKEN_SECONDS * 1000).toISOString();
	db.prepare(`
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
		VALUES (?, ?, ?, 0)
	`).run(userId, tokenHash, expiresAt);
	return token;
}

// Bandingkan secret dengan waktu konstan untuk mengurangi kebocoran timing.
function secretSama(diberikan, yangBenar) {
	if (typeof diberikan !== 'string' || typeof yangBenar !== 'string') return false;
	const hashDiberikan = crypto.createHash('sha256').update(diberikan).digest();
	const hashBenar = crypto.createHash('sha256').update(yangBenar).digest();
	return crypto.timingSafeEqual(hashDiberikan, hashBenar);
}

// Daftarkan endpoint autentikasi yang ditangani langsung oleh gateway.
function daftarkanAuth(app) {
	// Login memerlukan password yang benar dan device yang terdaftar pada akun.
	app.post('/auth/login', async (req, res) => {
		const body = req.body || {};
		const username = typeof body.username === 'string' ? body.username : '';
		const password = typeof body.password === 'string' ? body.password : '';
		const deviceId = req.get('X-Device-ID');
		const user = db.prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?')
			.get(username);

		if (!user) {
			audit(req, username ? `username:${username}` : 'anonim', 'deny', 'username_tidak_ditemukan');
			return res.status(401).json({ error: 'Kredensial atau device tidak valid' });
		}

		const passwordBenar = await bcrypt.compare(password, user.password_hash);
		if (!passwordBenar) {
			audit(req, String(user.id), 'deny', 'password_salah');
			return res.status(401).json({ error: 'Kredensial atau device tidak valid' });
		}

		const device = deviceId && db.prepare(
			'SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?'
		).get(user.id, deviceId);
		if (!device) {
			audit(req, String(user.id), 'deny', 'device_tidak_terdaftar');
			return res.status(401).json({ error: 'Kredensial atau device tidak valid' });
		}

		try {
			const accessToken = buatAccessToken(user.id, user.role);
			const refreshToken = buatRefreshToken(user.id);
			audit(req, String(user.id), 'allow', 'login_berhasil');
			return res.json({
				access_token: accessToken,
				refresh_token: refreshToken,
				token_type: 'Bearer',
				expires_in: ACCESS_TOKEN_SECONDS
			});
		} catch (error) {
			audit(req, String(user.id), 'deny', 'gagal_menerbitkan_token');
			return res.status(500).json({ error: 'Gagal menerbitkan token' });
		}
	});

	// Refresh hanya menerbitkan access token baru; refresh token tetap sama.
	app.post('/auth/refresh', (req, res) => {
		const refreshToken = req.body && req.body.refresh_token;
		if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
			audit(req, 'anonim', 'deny', 'refresh_token_tidak_diberikan');
			return res.status(401).json({ error: 'Refresh token tidak valid' });
		}

		const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
		const token = db.prepare(`
			SELECT rt.user_id, rt.expires_at, rt.revoked, u.role
			FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
			WHERE rt.token_hash = ?
		`).get(hash);

		if (!token) {
			audit(req, 'anonim', 'deny', 'refresh_token_tidak_dikenal');
			return res.status(401).json({ error: 'Refresh token tidak valid' });
		}
		if (token.revoked) {
			audit(req, String(token.user_id), 'deny', 'refresh_token_sudah_dicabut');
			return res.status(401).json({ error: 'Refresh token tidak valid' });
		}
		if (Date.parse(token.expires_at) <= Date.now()) {
			audit(req, String(token.user_id), 'deny', 'refresh_token_kedaluwarsa');
			return res.status(401).json({ error: 'Refresh token tidak valid' });
		}

		try {
			const accessToken = buatAccessToken(token.user_id, token.role);
			audit(req, String(token.user_id), 'allow', 'refresh_berhasil');
			return res.json({
				access_token: accessToken,
				token_type: 'Bearer',
				expires_in: ACCESS_TOKEN_SECONDS
			});
		} catch {
			audit(req, String(token.user_id), 'deny', 'gagal_menerbitkan_access_token');
			return res.status(500).json({ error: 'Gagal menerbitkan token' });
		}
	});

	// Logout mencabut refresh token agar tidak dapat dipakai kembali.
	app.post('/auth/logout', (req, res) => {
		const refreshToken = req.body && req.body.refresh_token;
		if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
			audit(req, 'anonim', 'deny', 'refresh_token_tidak_diberikan');
			return res.status(400).json({ error: 'Refresh token wajib diberikan' });
		}

		const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
		const token = db.prepare(
			'SELECT id, user_id, revoked FROM refresh_tokens WHERE token_hash = ?'
		).get(hash);
		if (!token) {
			audit(req, 'anonim', 'deny', 'refresh_token_tidak_dikenal');
			return res.status(401).json({ error: 'Refresh token tidak valid' });
		}
		if (token.revoked) {
			audit(req, String(token.user_id), 'deny', 'refresh_token_sudah_dicabut');
			return res.status(401).json({ error: 'Refresh token sudah dicabut' });
		}

		db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(token.id);
		audit(req, String(token.user_id), 'allow', 'logout_berhasil_token_dicabut');
		return res.json({ message: 'Logout berhasil' });
	});

	// Token service hanya diterbitkan dengan client ID dan secret yang cocok.
	app.post('/auth/service', (req, res) => {
		const body = req.body || {};
		const idBenar = typeof body.client_id === 'string' &&
			body.client_id === process.env.SERVICE_CLIENT_ID;
		const secretBenar = secretSama(body.client_secret, process.env.SERVICE_CLIENT_SECRET);
		if (!idBenar || !secretBenar) {
			audit(req, 'service-nilai', 'deny', 'client_credentials_tidak_valid');
			return res.status(401).json({ error: 'Client credentials tidak valid' });
		}

		try {
			const accessToken = jwt.sign(
				{ role: 'service' },
				process.env.JWT_SECRET,
				{ subject: 'service-nilai', expiresIn: 5 * 60 }
			);
			audit(req, 'service-nilai', 'allow', 'token_service_berhasil_diterbitkan');
			return res.json({
				access_token: accessToken,
				token_type: 'Bearer',
				expires_in: 5 * 60
			});
		} catch {
			audit(req, 'service-nilai', 'deny', 'gagal_menerbitkan_token_service');
			return res.status(500).json({ error: 'Gagal menerbitkan token service' });
		}
	});
}

module.exports = { daftarkanAuth };