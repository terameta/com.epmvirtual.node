export interface Node {
	id: string,
	name: string,
	networkInterfaces: NodeNetworkInterfacesData[]
}

interface NodeNetworkInterfacesData {
	iface: string;
	ip4: string;
	ip6: string;
	mac: string;
	internal: boolean;
}

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
