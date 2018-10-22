import * as os from 'os';
import { defaultNode, Node, KeyPress } from "../models/node";
import { BehaviorSubject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { initializeApp, app, firestore } from 'firebase';
import { fromDocRef } from 'rxfire/firestore';
import { existsSync, readFileSync, writeFileSync } from "fs";
import { waiter, JSONDeepCopy, SortByDateValue } from "./utilities";
import { Settings } from "models/settings";
import * as uuid from 'uuid/v4';
import * as pty from 'node-pty';

export class EPMNode {
	public node: Node = defaultNode();
	private isThisaNewNode: BehaviorSubject<boolean> = new BehaviorSubject( false );
	private settings: Settings = null;
	private nodeid: string = null;
	private databaseApp: app.App = null;
	private database: firestore.Firestore = null;
	private nodeReference: firestore.DocumentReference = null;
	private shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
	private ptyProcess: pty.IPty = null;

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
				console.log( 'Once the file is at the correct place system will initiate automatically, there is no need to restart the service' );
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

		this.ptyProcess = pty.spawn( this.shell, [], { name: 'xterm-color', cols: 80, rows: 30, cwd: process.env.HOME, env: process.env } );
		this.ptyProcess.on( 'data', ( data ) => {
			this.nodeReference.update( {
				responses: firestore.FieldValue.arrayUnion( { date: new Date(), datum: data } )
			} );
		} );

		console.log( 'We should be handling exit as well' );

		this.databaseApp = initializeApp( this.settings.firebase );
		this.database = this.databaseApp.firestore();
		this.database.settings( { timestampsInSnapshots: true } );

		this.nodeReference = this.database.doc( 'nodes/' + this.nodeid );
		fromDocRef( this.nodeReference ).
			// pipe( debounceTime( 100 ) ).
			subscribe( this.nodeChange );
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

	private nodeChange = ( change: firestore.DocumentSnapshot ) => {
		this.node = change.data() as Node;
		if ( !this.node ) {
			this.isThisaNewNode.next( true );
		} else {
			if ( this.node.keypresses ) {
				this.node.keypresses.forEach( kp => kp.dateValue = kp.date.toDate() );
				this.node.keypresses.sort( SortByDateValue );
				if ( this.node.keypresses.length > 0 ) {
					const keyPress: KeyPress = this.node.keypresses.shift();
					this.ptyProcess.write( keyPress.key );
					delete keyPress.dateValue;
					this.nodeReference.update( {
						keypresses: firestore.FieldValue.arrayRemove( keyPress )
					} );
				}
			}
			// console.log( 'nodeChange', this.node );
		}
	}
}

// // import { Node, defaultNode, KeyPress } from '../models/node';

// // import { firebase } from 'firebase/app';// // import 'firebase/firestore';// import { docData } from 'rxfire/firestore';

// export class EPMNode {
// 	public node: Node = defaultNode();
// 	private settings: Settings = null;
// 	private nodeid: string = null;
// 	private databaseApp: app.App = null;
// 	private database: firestore.Firestore = null;
// 	private nodeReference: firestore.DocumentReference = null;


// 	private initiate = async () => {
// 		this.database.settings( { timestampsInSnapshots: true } );

// 		// this.database.doc( 'nodes/' + this.nodeid ).onSnapshot( this.nodeChange );
// 		this.nodeReference = this.database.doc( 'nodes/' + this.nodeid );
// 		this.nodeReference.onSnapshot( this.nodeChange );

// 		// ptyProcess.write( 'ls\r' );
// 		// ptyProcess.resize( 100, 40 );
// 		// ptyProcess.write( 'top\r' );

// 	}
// }