export type Peran = 'mahasiswa' | 'dosen' | 'admin';

export interface LoginResponse {
	access_token: string;
	refresh_token?: string;
	token_type: 'Bearer';
	expires_in: number;
}

export interface NilaiRow {
	id: number;
	kelas_id: string;
	nama_kelas: string;
	nim: string;
	nilai: number;
	status: 'draft' | 'final';
}

export interface TranskripRow {
	id: number;
	nim: string;
	kelas_id: string;
	nama_kelas: string;
	nilai: number;
}

export interface ApiResult<T> {
	status: number;
	ok: boolean;
	body: T | null;
	reason: string | null;
}

export interface DataResponse<T> {
	data: T[];
}

export interface TranskripResponse {
	nim: string;
	data: TranskripRow[];
}