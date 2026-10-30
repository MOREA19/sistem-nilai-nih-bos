export const demoAccounts = [
    { username: 'admin', password: 'Admin123!', role: 'admin', deviceId: 'DEV-ADMIN-01', nim: null },
    { username: 'dosen1', password: 'Dosen123!', role: 'dosen', deviceId: 'DEV-DOSEN1-01', nim: null },
    { username: 'dosen2', password: 'Dosen123!', role: 'dosen', deviceId: 'DEV-DOSEN2-01', nim: null },
    { username: 'mhs1', password: 'Mhs123!', role: 'mahasiswa', deviceId: 'DEV-MHS1-01', nim: '2026001' },
    { username: 'mhs2', password: 'Mhs123!', role: 'mahasiswa', deviceId: 'DEV-MHS2-01', nim: '2026002' },
    { username: 'mhs3', password: 'Mhs123!', role: 'mahasiswa', deviceId: 'DEV-MHS3-01', nim: '2026003' }
];
export const demoClasses = [
    { id: 'IF101', name: 'Keamanan Informasi', teacherUsername: 'dosen1' },
    { id: 'IF202', name: 'Basis Data', teacherUsername: 'dosen2' }
];
export function findDemoAccount(username) {
    return demoAccounts.find((account) => account.username === username);
}
export function classesForTeacher(username) {
    return demoClasses.filter((demoClass) => demoClass.teacherUsername === username);
}
export function studentsForAdmin() {
    return demoAccounts.filter((account) => account.role === 'mahasiswa');
}
