export interface StoragePool {
	id: string,
	name: string,
	rbdname: string,
	dc: string,
	monitors: string,
	user: string,
	secretuuid: string,
	key: string,
	files: { [ key: string ]: StoragePoolFile }
}

export interface StoragePoolFile {
	id: string,
	name: string,
	size: number,
	actualSize: number,
	lastCheck: Date
}

export const defaultStoragePool = (): StoragePool => ( {
	id: '',
	name: '',
	rbdname: '',
	dc: '',
	monitors: '',
	user: '',
	secretuuid: '',
	key: '',
	files: {}
} );
