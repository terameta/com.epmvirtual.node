import { interval, BehaviorSubject, timer, Subject } from 'rxjs';
import { filter, catchError, delay, map, retryWhen, tap, delayWhen } from 'rxjs/operators';
import * as si from 'systeminformation';
import { defaultNode, Node } from '../models/node';
import { SettingsWithCredentials } from 'models/settings';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as uuid from 'uuid/v1';
import { initializeApp, app, firestore, auth as firebaseAuth } from 'firebase';
import { SortBy, waiter, deleteKeyIfFunction } from './utilities';
import { fromDocRef } from 'rxfire/firestore';
import wrtc = require( 'wrtc' );
import * as pty from 'node-pty';
import { platform } from 'os';


export class EPMNode {
	public node: Node = defaultNode();
	public settings: SettingsWithCredentials = {} as SettingsWithCredentials;
	private isThisaNewNode$ = new BehaviorSubject<boolean>( false );
	private databaseApp: app.App = null;
	private database: firestore.Firestore = null;
	private nodeReference: firestore.DocumentReference = null;
	private isNodeReceived = false;

	private shell = platform() === 'win32' ? 'powershell.exe' : 'bash';
	private ptyProcess: pty.IPty = null;

	constructor() {
		interval( 10000 ).subscribe( () => console.log( 'EPMVirtual Time:', new Date() ) );

		this.initiate().catch( e => {
			console.log( '!!! There is an issue with the initialization' );
			console.log( '!!! Please check the below error message to identify the issue and resolve' );
			console.log( '!!! Until then the system will not initiate' );
			console.log( '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' );
			console.log( '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' );
			console.log( e );
			console.log( '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' );
			console.log( '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' );
		} );
	}

	private initiate = async () => {
		await this.identifySelf();
		console.log( '*** EPMVirtual Node is now self identified' );
		await this.identifySettings();
		console.log( '*** EPMVirtual Node settings are now ready' );
		await this.connectToDatabase();
		console.log( '*** Connected to firestore database' );
		this.nodeReference = this.database.doc( 'nodes/' + this.node.id );
		await waiter();
		await this.identifyExistance();
		await this.actOnNewNode();
		await this.actOnExistingNode();
		this.scheduledTasks();
	}

	private identifySelf = async () => {
		this.node.os = await si.osInfo();
		this.node.name = this.node.os.hostname;
		deleteKeyIfFunction( this.node.os );
		this.node.system = await si.system();
		deleteKeyIfFunction( this.node.system );
		this.node.networkInterfaces = await si.networkInterfaces();
		this.node.networkInterfaces.sort( SortBy( 'iface' ) );
		this.node.networkInterfaces.forEach( deleteKeyIfFunction );
		this.node.cpu = await si.cpu();
		deleteKeyIfFunction( this.node.cpu );
		this.node.memory = await si.memLayout();
		deleteKeyIfFunction( this.node.memory );
		this.node.disk = await si.blockDevices();
		deleteKeyIfFunction( this.node.disk );
	}

	private identifySettings = async () => {
		this.settings.firebaseUser = process.env.Firebase_User;
		this.settings.firebasePass = process.env.Firebase_Pass;
		if ( !this.settings.firebaseUser ) throw new Error( 'Firebase user should be defined in the Environment variable as "Firebase_User"' );
		if ( this.settings.firebaseUser === '' ) throw new Error( 'Firebase user should be defined in the Environment variable as "Firebase_User" and it should not be an empty string' );
		if ( !this.settings.firebasePass ) throw new Error( 'Firebase password should be defined in the Environment variable as "Firebase_Pass"' );
		if ( this.settings.firebasePass === '' ) throw new Error( 'Firebase password should be defined in the Environment variable as "Firebase_Pass" and it should not be an empty string' );
		if ( !existsSync( 'settings.json' ) ) throw new Error( 'settings.json file should exist, please copy from settings.sample.json and update the details' );
		this.settings = { ...this.settings, ...JSON.parse( readFileSync( 'settings.json', 'utf8' ) ) };
		if ( !this.settings.firebase.apiKey || this.settings.firebase.apiKey === '' ) throw new Error( 'Settings json should have an apiKey item' );
		if ( !this.settings.firebase.authDomain || this.settings.firebase.authDomain === '' ) throw new Error( 'Settings json should have an authDomain item' );
		if ( !this.settings.firebase.databaseURL || this.settings.firebase.databaseURL === '' ) throw new Error( 'Settings json should have an databaseURL item' );
		if ( !this.settings.firebase.projectId || this.settings.firebase.projectId === '' ) throw new Error( 'Settings json should have an projectId item' );
		this.settings.firebase.timestampsInSnapshots = true;
		if ( existsSync( './nodeid.json' ) ) {
			const { nodeid } = JSON.parse( readFileSync( 'nodeid.json', 'utf8' ) );
			this.settings.nodeid = nodeid;
		} else {
			this.settings.nodeid = uuid();
			this.isThisaNewNode$.next( true );
			const toWrite = JSON.stringify( { nodeid: this.settings.nodeid } );
			writeFileSync( 'nodeid.json', toWrite );
		}
		this.node.id = this.settings.nodeid;
	}

	private connectToDatabase = async () => {
		this.databaseApp = initializeApp( this.settings.firebase );
		this.database = this.databaseApp.firestore();
		this.database.settings( { timestampsInSnapshots: true } );
		await firebaseAuth().signInWithEmailAndPassword( this.settings.firebaseUser, this.settings.firebasePass ); // .catch( e => { throw e } );
	}

	private identifyExistance = async () => {

		let errorWaitDuration = 0;

		fromDocRef( this.nodeReference ).pipe(
			tap( () => { errorWaitDuration = 0; } ),
			retryWhen( errors => errors.pipe(
				tap( e => console.log( 'Firebase error >>>>:', e.toString() ) ),
				tap( () => { errorWaitDuration++; if ( errorWaitDuration > 120 ) errorWaitDuration = 120; } ),
				tap( () => console.log( 'We will now wait for', errorWaitDuration, 'seconds.' ) ),
				delayWhen( val => timer( errorWaitDuration * 1000 ) )
			) )
		).subscribe( recNode => {
			console.log( 'Node is now received' );
			this.isNodeReceived = true;
			this.node = { ...this.node, ...recNode.data() };
			this.isThisaNewNode$.next( !recNode.data() );
		} );
	}

	private actOnNewNode = async () => {
		this.isThisaNewNode$.pipe( filter( i => i ) ).subscribe( ( isNew ) => {
			this.database.doc( 'nodecandidates/list' ).update( {
				items: firestore.FieldValue.arrayUnion( this.node )
			} ).
				then( () => console.log( 'This node is now registered under the nodecandidates/list on database' ) ).
				catch( e => console.log( 'We are unable to update the nodecandidates', e.toString() ) );
		} );
	}

	private actOnExistingNode = async () => {
		this.isThisaNewNode$.pipe(
			filter( i => ( !i && this.isNodeReceived ) )
		).subscribe( async ( isNew ) => {
			if ( this.node.rtc.offer ) { await this.handleRTCOffer(); }
			if ( this.node.commands ) { await this.handleCommands(); }
		} );
	}

	private handleCommands = async () => {
		console.log( 'There are commands to be run in the queue' );
		console.log( this.node.commands.length );
		if ( this.node.commands && this.node.commands.length > 0 ) {
			this.node.commands.forEach( c => console.log( c ) );
		}
	}

	private handleRTCOffer = async () => {
		console.log( 'RTC: Request received' );
		const offer = JSON.parse( this.node.rtc.offer );
		await this.nodeReference.update( { 'rtc.offer': null } );
		const { servers } = await this.database.doc( 'settings/rtc' ).get().then( s => s.data() );
		const pc = new wrtc.RTCPeerConnection( servers, { optional: [] } );
		pc.oniceconnectionstatechange = () => {
			console.log( 'RTC: Connection state changed -', pc.iceConnectionState );
			if ( pc.iceConnectionState === 'failed' ) {
				if ( iceCandidateSub ) iceCandidateSub.unsubscribe();
			}
		}
		pc.onicecandidate = ( candidate ) => {
			if ( candidate.candidate ) {
				this.nodeReference.update( {
					'rtc.answerice': firestore.FieldValue.arrayUnion( JSON.stringify( { ice: candidate.candidate } ) )
				} )
			}
		}
		const iceCandidateSub = fromDocRef( this.nodeReference ).subscribe( ( a ) => {
			const n = ( a.data() ).rtc;
			if ( n ) {
				if ( n.offerice ) {
					if ( Array.isArray( n.offerice ) ) {
						n.offerice.forEach( ic => {
							pc.addIceCandidate( ( JSON.parse( ic ) ).ice );
						} )
					}
				}
			}
		} );
		pc.ondatachannel = ( event: RTCDataChannelEvent ) => {
			const dc = event.channel;
			console.log( 'RTC: Data channel received -', dc.id, dc.label );
			dc.onopen = () => {
				console.log( 'RTC: Data channel is now open -', dc.label );
				if ( dc.label === 'console' ) this.handleConsoleRequest( dc );
			}
			dc.onclose = ( event ) => {
				console.log( 'RTC: Data channel is now closed -', dc.label );
				this.ptyProcess.kill();
				this.ptyProcess = null;
			}
			dc.onerror = ( event ) => {
				console.log( 'RTC: Data channel is now in error state -', dc.label );
				this.ptyProcess.kill();
				this.ptyProcess = null;
			}
		}
		await pc.setRemoteDescription( new wrtc.RTCSessionDescription( offer ) );
		const answer = await pc.createAnswer();
		await pc.setLocalDescription( answer );
		await this.nodeReference.update( { 'rtc.answer': JSON.stringify( pc.localDescription ) } );
	}

	private handleConsoleRequest = ( dc: RTCDataChannel ) => {
		if ( this.ptyProcess ) { this.ptyProcess.kill(); this.ptyProcess = null; }
		this.ptyProcess = pty.spawn( this.shell, [], { name: 'xterm-color', cols: 80, rows: 30, cwd: process.env.HOME, env: process.env } );
		this.ptyProcess.on( 'data', ( data ) => dc.send( JSON.stringify( { type: 'data', data } ) ) );
		this.ptyProcess.on( 'exit', ( exitCode: number ) => dc.send( JSON.stringify( { type: 'exit', exitCode } ) ) );
		dc.onmessage = ( event ) => {
			const data = JSON.parse( event.data );
			if ( data.type === 'key' ) this.ptyProcess.write( data.key );
			if ( data.type === 'resize' ) this.ptyProcess.resize( data.cols, data.rows );
		}
	}

	private scheduledTasks = async () => {
		interval( 30000 ).subscribe( async () => {
			this.checkNetwork();
			this.reportLoad();
		} );
	}

	private checkNetwork = async () => {
		const oldNics = JSON.stringify( this.node.networkInterfaces.sort( SortBy( 'mac' ) ) );
		const newNics = JSON.stringify( ( await si.networkInterfaces() ).sort( SortBy( 'mac' ) ) );
		if ( oldNics !== newNics && !this.isThisaNewNode$.getValue() ) this.nodeReference.update( this.node );
	}
	private reportLoad = async () => {
		// si.mem().then( console.log ); // This will print the current memory usage and state
		// si.currentLoad().then( console.log ); // This will print the current cpu usage and state	
	}
}
// import { defaultNode, Node, KeyPress, NodeCommand } from "../models/node";
// import { BehaviorSubject, interval, combineLatest } from 'rxjs';

// import { fromDocRef, fromCollectionRef } from 'rxfire/firestore';
// import { existsSync, readFileSync, writeFileSync } from "fs";
// import { waiter, JSONDeepCopy, SortByDateValue } from "./utilities";
// import { Settings } from "models/settings";
// import { exec } from 'child_process';

// export class EPMNode {
// 	public node: Node = defaultNode();
// 	private nodeReceived = false;
// 	private settings: Settings = null;
// 	private nodeid: string = null;

// 	private nodeReference: firestore.DocumentReference = null;
// 	private poolsReference: firestore.CollectionReference;
// 	private shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
// 	private ptyProcess: pty.IPty = null;
// 	private isExecutingCommand = false;
// 	private isSchedulesInitiated = false;

// 	constructor() {}

// 	private initiate = async () => {
// 		this.isThisaNewNode.subscribe( this.thisisaNewNode );


// 		this.nodeReference = this.database.doc( 'nodes/' + this.nodeid );
// 		fromDocRef( this.nodeReference ).subscribe( this.nodeChange );
// 	}

// 	private thisisaNewNode = ( isit: boolean ) => {
// 		if ( isit ) {
// 			if ( this.nodeReceived ) {
// 				console.log( 'This is a new node' );
// 				this.database.doc( 'nodecandidates/list' ).update( {
// 					items: firestore.FieldValue.arrayUnion( {
// 						id: this.nodeid,
// 						hostname: os.hostname(),
// 						ostype: os.type(),
// 						osplatform: os.platform(),
// 						osarch: os.arch(),
// 						osrelease: os.release()
// 					} )
// 				} ).catch( ( error ) => {
// 					console.log( '===========================================' );
// 					console.log( '===========================================' );
// 					console.log( 'We could not register the new node. Below is the error trace' );
// 					console.error( error );
// 					console.log( '===========================================' );
// 					console.log( '===========================================' );
// 				} );
// 			}
// 		} else {
// 			// console.log( 'This is not a new node' );
// 			if ( !this.ptyProcess ) {
// 				console.log( 'We will now create the ptyProcess' );
// 				this.ptyProcess = pty.spawn( this.shell, [], { name: 'xterm-color', cols: 80, rows: 30, cwd: process.env.HOME, env: process.env } );
// 				this.ptyProcess.on( 'data', ( data ) => {
// 					this.nodeReference.update( {
// 						responses: firestore.FieldValue.arrayUnion( { date: new Date(), datum: data } )
// 					} );
// 				} );
// 				console.log( 'We should be handling exit as well' );
// 			}
// 			if ( !this.isSchedulesInitiated ) this.schedulesInitiate();
// 		}
// 	}

// 	private nodeChange = async ( change: firestore.DocumentSnapshot ) => {
// 		// console.log( 'We have reached here as well' );
// 		this.node = change.data() as Node;
// 		console.log( 'We are at nodeChange' );
// 		console.log( this.node );
// 		this.nodeReceived = true;
// 		// console.log( 'We have reached here as well', this.node );
// 		if ( !this.node ) {
// 			this.isThisaNewNode.next( true );
// 		} else {
// 			this.isThisaNewNode.next( false );
// 			this.poolAssignments();
// 			this.ptyProcess.resize( this.node.terminal.dimensions.cols | 80, this.node.terminal.dimensions.rows | 30 );
// 			if ( this.node.keypresses && this.node.keypresses.length > 0 ) {
// 				this.node.keypresses.forEach( kp => kp.dateValue = kp.date.toDate() );
// 				this.node.keypresses.sort( SortByDateValue );
// 				if ( this.node.keypresses.length > 0 ) {
// 					const keyPress: KeyPress = this.node.keypresses.shift();
// 					this.ptyProcess.write( keyPress.key );
// 					delete keyPress.dateValue;
// 					this.nodeReference.update( {
// 						keypresses: firestore.FieldValue.arrayRemove( keyPress )
// 					} );
// 				}
// 			} else if ( this.node.commands && this.node.commands.length > 0 ) {
// 				const command = this.getFirstInArray( this.node.commands );
// 				if ( !this.isExecutingCommand ) {
// 					this.isExecutingCommand = true;
// 					await this.nodeReference.update( { commands: firestore.FieldValue.arrayRemove( command ) } ).catch( console.error );
// 					await this.nodeReference.update( { currentCommand: command.command } );
// 					const result = await this.executeCommand( command );
// 					this.isExecutingCommand = false;
// 					await this.nodeReference.update( { currentCommand: '', lastCommand: command.command, lastCommandResult: result } );
// 				}
// 			}
// 		}
// 	}

// 	private executeCommand = async ( command: NodeCommand ) => {
// 		// console.log( '===========================================' );
// 		// console.log( '===========================================' );
// 		// console.log( 'We sholud now execute below command' );
// 		// console.log( command );
// 		// console.log( '===========================================' );
// 		// console.log( 'Initiating execution now' );
// 		return await this.executeCommandAction( command.command );
// 		// console.log( '===========================================' );
// 		// console.log( 'Execution is now complete' );
// 		// console.log( '===========================================' );
// 	}

// 	private executeCommandAction = ( command: string ): Promise<string> => {
// 		return new Promise( ( resolve, reject ) => {
// 			exec( command, ( error, stdout ) => {
// 				if ( error ) {
// 					// reject( error );
// 					resolve( '!!!!!!!!!!!\n' + error.message + '\n!!!!!!!!!!!' );
// 				} else {
// 					resolve( stdout );
// 				}
// 			} );
// 		} );
// 	}

// 	private getFirstInArray = ( items: any[] ) => {
// 		items.forEach( i => i.dateValue = i.date.toDate() );
// 		items.sort( SortByDateValue );
// 		const item = items.shift();
// 		delete item.dateValue;
// 		return item;
// 	}

// 	private schedulesInitiate = async () => {
// 		if ( !this.isSchedulesInitiated ) {
// 			this.isSchedulesInitiated = true;
// 			// if ( this.node.isPoolWorker ) {
// 			// 	interval( 3000 ).subscribe( this.getPoolFiles );
// 			// }
// 		}
// 	}

// 	private poolAssignments = async () => {
// 		console.log( 'Pool Assignments called' );
// 		Object.keys( this.node.poolAssignments ).filter( paKey => this.node.poolAssignments[ paKey ] ).forEach( ( paKey ) => {
// 			console.log( 'We are assigned this pool:', paKey );
// 		} );
// 	}

// 	private getPoolFiles = async () => {
// 		// console.log( 'Get pool files is now called' );
// 		const poolFiles: any[] = JSON.parse( await this.executeCommandAction( 'rbd ls -l --format json --pretty-format' ) );
// 		poolFiles.forEach( file => {
// 			console.log( file.image, file.size, file.format );
// 			console.log( file );
// 		} );
// 	}
// }
