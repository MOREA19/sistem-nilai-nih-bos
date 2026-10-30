import type { Peran } from './types.js';

// Data demo UI yang dicerminkan dari db/seed.js; bukan sumber keputusan kebijakan.
export interface DemoAccount {
	username: string;
	password: string;
	role: Peran;
	deviceId: string;
	nim: string | null;
}

export interface DemoClass {
	id: string;
	name: string;
	teacherUsername: string;
}

export const demoAccounts: DemoAccount[] = [
	{ username: 'admin', password: 'Admin123!', role: 'admin', deviceId: 'DEV-ADMIN-01', nim: null },
	{ username: 'dosen1', password: 'Dosen123!', role: 'dosen', deviceId: 'DEV-DOSEN1-01', nim: null },
	{ username: 'dosen2', password: 'Dosen123!', role: 'dosen', deviceId: 'DEV-DOSEN2-01', nim: null },
	{ username: 'mhs1', password: 'Mhs123!', role: 'mahasiswa', deviceId: 'DEV-MHS1-01', nim: '2026001' },
	{ username: 'mhs2', password: 'Mhs123!', role: 'mahasiswa', deviceId: 'DEV-MHS2-01', nim: '2026002' },
	{ username: 'mhs3', password: 'Mhs123!', role: 'mahasiswa', deviceId: 'DEV-MHS3-01', nim: '2026003' }
];

export const demoClasses: DemoClass[] = [
	{ id: 'IF101', name: 'Keamanan Informasi', teacherUsername: 'dosen1' },
	{ id: 'IF202', name: 'Basis Data', teacherUsername: 'dosen2' }
];

export function findDemoAccount(username: string): DemoAccount | undefined {
	return demoAccounts.find((account) => account.username === username);
}

export function classesForTeacher(username: string): DemoClass[] {
	return demoClasses.filter((demoClass) => demoClass.teacherUsername === username);
}

export function studentsForAdmin(): DemoAccount[] {
	return demoAccounts.filter((account) => account.role === 'mahasiswa');
}
