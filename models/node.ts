import { JSONDeepCopy } from "../src/utilities";

export interface Node {
	id: string,
	name: string,
	os: NodeOsData,
	system: NodeSystemData,
	networkInterfaces: NodeNetworkInterfacesData[],
	cpu: NodeCpuData,
	memory: NodeMemoryLayoutData
}

interface NodeNetworkInterfacesData {
	iface: string;
	ip4: string;
	ip6: string;
	mac: string;
	internal: boolean;
}

interface NodeSystemData {
	manufacturer: string;
	model: string;
	version: string;
	serial: string;
	uuid: string;
}

interface NodeOsData {
	platform: string;
	distro: string;
	release: string;
	codename: string;
	kernel: string;
	arch: string;
	hostname: string;
	logofile: string;
}

interface NodeCpuData {
	manufacturer: string;
	brand: string;
	vendor: string;
	family: string;
	model: string;
	stepping: string;
	revision: string;
	speed: string;
	speedmin: string;
	speedmax: string;
	cores: number;
	cache: NodeCpuCacheData;
	flags: string;
}

interface NodeCpuCacheData {
	l1d: number;
	l1i: number;
	l2: number;
	l3: number;
}

interface NodeMemoryLayoutData {
	size: number;
	bank: string;
	type: string;
	clockSpeed: number;
	formFactor: string;
	partNum: string;
	serialNum: string;
	voltageConfigured: number;
	voltageMin: number;
	voltageMax: number;
}

const baseNode: Node = {
	id: null,
	name: null,
	os: null,
	system: null,
	networkInterfaces: null,
	cpu: null
}

export const defaultNode = (): Node => JSONDeepCopy( baseNode );

// export interface Node extends NodeCandidate {
// 	name: string,
// 	terminal: {
// 		requested: boolean,
// 		dimensions: {
// 			cols: number, rows: number
// 		}
// 	},
// 	lastCommandResult: string,
// 	lastCommand: string,
// 	currentCommand: string,
// 	poolAssignments: PoolAssignment,
// 	poolWorkerAssignments: PoolWorkerAssignment
// }

// export const defaultNode = (): Node => ( { id: '', name: '', terminal: { dimensions: { cols: 0, rows: 0 } }, poolAssignments: {}, poolWorkerAssignments: {} } as Node );

// export interface NodeCandidateObject {
// 	id: string,
// 	items: NodeCandidate[]
// }

// export interface NodeCandidate {
// 	id: string,
// 	name: string,
// 	details: any,
// 	hostname: string,
// 	ostype: string,
// 	osplatform: string,
// 	osarch: string,
// 	osrelease: string,
// 	keypresses: KeyPress[],
// 	responses: PtyResponse[],
// 	commands: NodeCommand[]
// }

// export interface KeyPress {
// 	date: any,
// 	key: string,
// 	dateValue?: Date
// }

// export interface PtyResponse {
// 	date: any,
// 	datum: string,
// 	dateValue?: Date
// }

// export interface NodeCommand {
// 	date: any,
// 	command: string,
// 	dateValue?: Date
// }


// export interface PoolAssignment {
// 	[ key: string ]: boolean
// }

// export interface PoolWorkerAssignment {
// 	[ key: string ]: boolean
// }
