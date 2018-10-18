export interface Node extends NodeCandidate {
	name: string
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
	responses: PtyResponse[]
}

export interface KeyPress {
	date: any,
	key: string,
	dateValue?: Date
}

export interface PtyResponse {
	date: Date | any,
	datum: string
}
