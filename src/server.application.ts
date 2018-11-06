import * as os from 'os';
import { defaultNode, Node, KeyPress, NodeCommand, CommandType } from "../models/node";
import { BehaviorSubject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { initializeApp, app, firestore } from 'firebase';
import { fromDocRef } from 'rxfire/firestore';
import { existsSync, readFileSync, writeFileSync } from "fs";
import { waiter, JSONDeepCopy, SortByDateValue } from "./utilities";
import { Settings } from "models/settings";
import * as uuid from 'uuid/v4';
import * as pty from 'node-pty';
import * as si from 'systeminformation';
import { exec } from 'child_process';

export class EPMNode {
	public node: Node = defaultNode();
	private isThisaNewNode: BehaviorSubject<boolean> = new BehaviorSubject( true );
	private nodeReceived = false;
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
		// si.cpu().then( console.log );
		// si.battery().then( console.log );
		// si.blockDevices().then( console.log );
		// si.diskLayout().then( console.log );

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


		this.databaseApp = initializeApp( this.settings.firebase );
		this.database = this.databaseApp.firestore();
		this.database.settings( { timestampsInSnapshots: true } );

		this.nodeReference = this.database.doc( 'nodes/' + this.nodeid );
		fromDocRef( this.nodeReference ).subscribe( this.nodeChange );
	}

	private thisisaNewNode = ( isit: boolean ) => {
		if ( isit ) {
			if ( this.nodeReceived ) {
				console.log( 'This is a new node' );
				this.database.doc( 'nodecandidates/list' ).update( {
					items: firestore.FieldValue.arrayUnion( {
						id: this.nodeid,
						hostname: os.hostname(),
						ostype: os.type(),
						osplatform: os.platform(),
						osarch: os.arch(),
						osrelease: os.release()
					} )
				} ).catch( ( error ) => {
					console.log( '===========================================' );
					console.log( '===========================================' );
					console.log( 'We could not register the new node. Below is the error trace' );
					console.error( error );
					console.log( '===========================================' );
					console.log( '===========================================' );
				} );
			}
		} else {
			// console.log( 'This is not a new node' );
			if ( !this.ptyProcess ) {
				console.log( 'We will now create the ptyProcess' );
				this.ptyProcess = pty.spawn( this.shell, [], { name: 'xterm-color', cols: 80, rows: 30, cwd: process.env.HOME, env: process.env } );
				this.ptyProcess.on( 'data', ( data ) => {
					this.nodeReference.update( {
						responses: firestore.FieldValue.arrayUnion( { date: new Date(), datum: data } )
					} );
				} );
				console.log( 'We should be handling exit as well' );
			}
		}
	}

	private nodeChange = async ( change: firestore.DocumentSnapshot ) => {
		// console.log( 'We have reached here as well' );
		this.node = change.data() as Node;
		this.nodeReceived = true;
		// console.log( 'We have reached here as well', this.node );
		if ( !this.node ) {
			this.isThisaNewNode.next( true );
		} else {
			this.isThisaNewNode.next( false );
			this.ptyProcess.resize( this.node.terminal.dimensions.cols | 80, this.node.terminal.dimensions.rows | 30 );
			if ( this.node.keypresses && this.node.keypresses.length > 0 ) {
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
			} else if ( this.node.commands && this.node.commands.length > 0 ) {
				const command = this.getFirstInArray( this.node.commands );
				await this.nodeReference.update( { commands: firestore.FieldValue.arrayRemove( command ) } ).catch( console.error );
				await this.executeCommand( command );

				// if ( this.node.commands.length > 0 ) {
				// 	this.node.commands.forEach( c => c.dateValue = c.date.toDate() );
				// 	this.node.commands.sort( SortByDateValue );
				// 	const command = this.node.commands.shift();
				// 	await this.executeCommand( command );
				// 	delete command.dateValue;
				// 	this.nodeReference.update( {
				// 		commands: firestore.FieldValue.arrayRemove( command )
				// 	} );
				// }
			}
		}
	}

	private executeCommand = async ( command: NodeCommand ) => {
		if ( command.commandType === CommandType.reboot ) { command.command = 'sudo reboot'; }
		console.log( '===========================================' );
		console.log( '===========================================' );
		console.log( 'We sholud now execute below command' );
		console.log( command );
		console.log( '===========================================' );
		console.log( 'Initiating execution now' );
		await this.executeCommandAction( command.command );
		console.log( '===========================================' );
		console.log( 'Execution is now complete' );
		console.log( '===========================================' );
	}

	private executeCommandAction = ( command: string ) => {
		return new Promise( ( resolve, reject ) => {
			exec( command, ( error, stdout ) => {
				if ( error ) {
					reject( error );
				} else {
					resolve( stdout );
				}
			} );
		} );
	}

	private getFirstInArray = ( items: any[] ) => {
		items.forEach( i => i.dateValue = i.date.toDate() );
		items.sort( SortByDateValue );
		const item = items.shift();
		delete item.dateValue;
		return item;
	}
}
