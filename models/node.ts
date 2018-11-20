export interface Node extends NodeCandidate {
	name: string,
	terminal: {
		requested: boolean,
		dimensions: {
			cols: number, rows: number
		}
	},
	poolAssignments: PoolAssignment,
	poolWorkerAssignments: PoolWorkerAssignment
}

export const defaultNode = (): Node => ( { id: '', name: '', terminal: { dimensions: { cols: 0, rows: 0 } }, poolAssignments: {}, poolWorkerAssignments: {} } as Node );

export interface NodeCandidateObject {
	id: string,
	items: NodeCandidate[]
}

export interface NodeCandidate {
	id: string,
	name: string,
	hostname: string,
	ostype: string,
	osplatform: string,
	osarch: string,
	osrelease: string,
	keypresses: KeyPress[],
	responses: PtyResponse[],
	commands: NodeCommand[]
}

export interface KeyPress {
	date: any,
	key: string,
	dateValue?: Date
}

export interface PtyResponse {
	date: any,
	datum: string,
	dateValue?: Date
}

export interface NodeCommand {
	date: any,
	command: string,
	dateValue?: Date
}


export interface PoolAssignment {
	[ key: string ]: boolean
}

export interface PoolWorkerAssignment {
	[ key: string ]: boolean
}
