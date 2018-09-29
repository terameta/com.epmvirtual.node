import { existsSync, readSync, readFileSync } from "fs";
import { waiter } from "./utilities";


export class EPMNode {
	private settings: any = null;

	constructor() {
		this.initiate();
	}

	private initiate = async () => {
		let notified = false;
		while ( !existsSync( 'settings.ts' ) ) {
			if ( !notified ) {
				console.log( 'There is no settings.ts file, please create one with necessary details' );
				notified = true;
			}
			await waiter();
		}
		this.settings = JSON.parse( readFileSync( 'settings.ts', 'utf8' ) );
		console.log( this.settings );
	}
}