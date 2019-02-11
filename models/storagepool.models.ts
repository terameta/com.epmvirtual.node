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
	Allocation: string,
	Capacity: string,
	Name: string,
	Path: string,
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
