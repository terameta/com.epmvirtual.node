import { existsSync, readFileSync, writeFileSync } from "fs";
import { waiter } from "./utilities";
import { Settings } from "models/settings";
import * as uuid from 'uuid/v4';
import { firestore, initializeApp, app } from 'firebase';
import { BehaviorSubject } from 'rxjs';
import * as os from 'os';

export class EPMNode {
	private settings: Settings = null;
	private nodeid: string = null;
	private databaseApp: app.App = null;
	private database: firestore.Firestore = null;
	private isThisaNewNode: BehaviorSubject<boolean> = new BehaviorSubject( false );
	private nodeReference: firestore.DocumentReference = null;

	constructor() {
		console.clear();
		this.initiate();
	}

	private initiate = async () => {
		this.isThisaNewNode.subscribe( this.thisisaNewNode );

		let notified = false;
		while ( !existsSync( 'settings.json' ) ) {
			if ( !notified ) {
				console.log( 'There is no settings.json file, please create one with necessary details' );
				notified = true;
			}
			await waiter();
		}
		this.settings = JSON.parse( readFileSync( 'settings.json', 'utf8' ) );

		if ( existsSync( './nodeid.json' ) ) {
			const { nodeid } = JSON.parse( readFileSync( 'nodeid.json', 'utf8' ) );
			this.nodeid = nodeid;
		} else {
			this.nodeid = uuid();
			this.isThisaNewNode.next( true );
			const toWrite = JSON.stringify( { nodeid: this.nodeid } );
			writeFileSync( 'nodeid.json', toWrite );
		}

		this.databaseApp = initializeApp( this.settings.firebase );
		this.database = this.databaseApp.firestore();
		this.database.settings( { timestampsInSnapshots: true } );

		// this.database.doc( 'nodes/' + this.nodeid ).onSnapshot( this.nodeChange );
		this.nodeReference = this.database.doc( 'nodes/' + this.nodeid );
		this.nodeReference.onSnapshot( this.nodeChange );
	}

	private nodeChange = ( change: firestore.DocumentSnapshot ) => {
		const status = change.data();
		if ( !status ) this.isThisaNewNode.next( true );
		console.log( 'nodeChange', status );
	}

	private thisisaNewNode = ( isit: boolean ) => {
		if ( isit ) {
			this.database.doc( 'nodecandidates/list' ).update( {
				items: firestore.FieldValue.arrayUnion( {
					id: this.nodeid,
					hostname: os.hostname(),
					ostype: os.type(),
					osplatform: os.platform(),
					osarch: os.arch(),
					osrelease: os.release()
				} )
			} );
		}
	}
}