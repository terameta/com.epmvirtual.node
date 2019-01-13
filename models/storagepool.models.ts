export interface StoragePool {
	id: string,
	name: string,
	rbdname: string,
	dc: string,
	monitors: string,
	user: string,
	secretuuid: string,
	key: string,
	files: StoragePoolFile[]
}

export interface StoragePoolFile {
	name: string,
	size: number,
	actualsize: number
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
	files: []
} );
