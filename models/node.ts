export interface Node extends NodeCandidate {
	name: string,
	terminal: {
		requested: boolean,
		dimensions: {
			cols: number, rows: number
		}
	}
}

export const defaultNode = (): Node => ( { id: '', name: '' } as Node );

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
