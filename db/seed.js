const bcrypt = require('bcryptjs');
const db = require('./database');

const seed = db.transaction(() => {
  // Hapus tabel anak dahulu agar seed dapat dijalankan ulang.
  db.exec(`
    DELETE FROM audit_log;
    DELETE FROM refresh_tokens;
    DELETE FROM transkrip;
    DELETE FROM nilai;
    DELETE FROM devices;
    DELETE FROM kelas;
    DELETE FROM users;
  `);

  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, role, nim) VALUES (?, ?, ?, ?)'
  );
  const insertDevice = db.prepare('INSERT INTO devices (user_id, device_id) VALUES (?, ?)');
  const akun = [
    { username: 'admin', password: 'Admin123!', role: 'admin', nim: null, device: 'DEV-ADMIN-01' },
    { username: 'dosen1', password: 'Dosen123!', role: 'dosen', nim: null, device: 'DEV-DOSEN1-01' },
    { username: 'dosen2', password: 'Dosen123!', role: 'dosen', nim: null, device: 'DEV-DOSEN2-01' },
    { username: 'mhs1', password: 'Mhs123!', role: 'mahasiswa', nim: '2026001', device: 'DEV-MHS1-01' },
    { username: 'mhs2', password: 'Mhs123!', role: 'mahasiswa', nim: '2026002', device: 'DEV-MHS2-01' },
    { username: 'mhs3', password: 'Mhs123!', role: 'mahasiswa', nim: '2026003', device: 'DEV-MHS3-01' }
  ];

  const ids = {};
  for (const account of akun) {
    const result = insertUser.run(
      account.username,
      bcrypt.hashSync(account.password, 10),
      account.role,
      account.nim
    );
    ids[account.username] = Number(result.lastInsertRowid);
    insertDevice.run(ids[account.username], account.device);
  }

  const insertClass = db.prepare('INSERT INTO kelas (id, nama, dosen_id) VALUES (?, ?, ?)');
  insertClass.run('IF101', 'Keamanan Informasi', ids.dosen1);
  insertClass.run('IF202', 'Basis Data', ids.dosen2);

  const insertGrade = db.prepare(
    "INSERT INTO nilai (kelas_id, nim, nilai, status) VALUES (?, ?, ?, 'draft')"
  );
  const grades = [
    ['IF101', '2026001', 85], ['IF101', '2026002', 78], ['IF101', '2026003', 91],
    ['IF202', '2026001', 88], ['IF202', '2026002', 82], ['IF202', '2026003', 76]
  ];
  for (const grade of grades) insertGrade.run(...grade);
});

seed();
console.log(`Seed selesai: ${db.prepare('SELECT COUNT(*) AS jumlah FROM users').get().jumlah} akun, ` +
  `${db.prepare('SELECT COUNT(*) AS jumlah FROM kelas').get().jumlah} kelas, ` +
  `${db.prepare('SELECT COUNT(*) AS jumlah FROM nilai').get().jumlah} nilai.`);
db.close();