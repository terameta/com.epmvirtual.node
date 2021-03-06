import { interval, BehaviorSubject, timer, Subject, Subscription } from 'rxjs';
import { filter, map, retryWhen, tap, delayWhen } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import * as si from 'systeminformation';
import { defaultNode, Node, NodeCommand } from '../models/node.models';
import { SettingsWithCredentials } from 'models/settings';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as uuid from 'uuid/v1';
import { initializeApp, app, firestore, auth as firebaseAuth, FirebaseError } from 'firebase';
import { SortBy, waiter, deleteKeyIfFunction, SortByUUID, addDays, SortById } from './utilities/utilities';
import { fromDocRef, fromCollectionRef } from 'rxfire/firestore';
import wrtc = require( 'wrtc' );
import * as pty from 'node-pty';
import { platform } from 'os';
import { exec } from 'child_process';
import { StoragePool, StoragePoolFile } from 'models/storagepool.models';
import { returner } from './virsh/returner';
import * as promisers from './utilities/promisers';
import { join } from 'path';

export class EPMNode {
	public node: Node = defaultNode();
	public settings: SettingsWithCredentials = {} as SettingsWithCredentials;
	private isThisaNewNode$ = new BehaviorSubject<boolean>( false );
	private databaseApp: app.App = null;
	private database: firestore.Firestore = null;
	private nodeReference: firestore.DocumentReference = null;
	private isNodeReceived = false;
	private node$ = new BehaviorSubject<Node>( defaultNode() );
	private poolsReference: firestore.CollectionReference = null;
	private poolsSubscription: Subscription = null;
	private pools: { [ key: string ]: { pool: StoragePool, worker: boolean, timer: NodeJS.Timeout } } = null;
	private numberofWorkerRegistrations = 0;

	private shell = platform() === 'win32' ? 'powershell.exe' : 'bash';
	private ptyProcess: pty.IPty = null;

	private commandQueue: NodeCommand[] = [];
	private isCommandRunning = false;

	constructor() {
		interval( 10000 ).subscribe( async () => { console.log( 'EPMVirtual Time:', new Date() ); } );

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
		this.poolsReference = this.database.collection( 'storagepools' );
		await waiter();
		await this.identifyExistance();
		await this.actOnNewNode();
		await this.actOnExistingNode();
		await this.handlePools();
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
		// this.settings.firebase.timestampsInSnapshots = true;
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
		// this.database.settings( { timestampsInSnapshots: true } );
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
			this.node$.next( this.node );
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
			if ( this.node.poolAssignments && Object.values( this.node.poolAssignments ).filter( v => v ).length > 0 ) { this.handlePools(); } else { this.cancelPools(); }
			if ( this.node.rtc && this.node.rtc.offer ) { await this.handleRTCOffer(); }
			if ( this.node.commands && this.node.commands.length > 0 ) { await this.handleCommands(); }
		} );
	}

	private handlePools = async () => {
		if ( !this.poolsSubscription ) {
			this.poolsSubscription = combineLatest( [
				fromCollectionRef( this.poolsReference ).pipe( map( s => s.docs.map( d => ( <StoragePool>{ id: d.id, ...d.data() } ) ) ) ),
				this.node$
			] ).pipe( map( ( [ a, b ] ) => ( a ) ) ).
				subscribe( this.handlePoolsAction, ( error: FirebaseError ) => {
					console.log( 'We are unable to subscribe to the storage pools' );
					console.log( error.name, ':', error.message );
				} );
		}
	}
	private handlePoolsAction = async ( pools: StoragePool[] ) => {
		console.log( 'We are at the handlePoolsAction' );
		if ( !this.pools ) this.pools = {};
		const receivedPools = pools.filter( p => this.node.poolAssignments[ p.id ] === true );
		const extraPools = receivedPools.filter( p => !this.pools[ p.id ] );
		if ( extraPools.length > 0 ) {
			extraPools.forEach( p => this.pools[ p.id ] = { pool: p, worker: this.node.poolWorkerAssignments[ p.id ], timer: null } );
			const existingSecrets = await returner( await this.executeCommandAction( 'virsh secret-list' ).catch( () => '' ), 'UUID' );
			const existingPools = await returner( await this.executeCommandAction( 'virsh pool-list --details --all' ).catch( () => '' ), 'Name' );
			const secretsToCreate = Object.values( this.pools ).filter( p => !existingSecrets[ p.pool.secretuuid ] ).map( p => ( { UUID: p.pool.secretuuid, key: p.pool.key, name: p.pool.rbdname || p.pool.name || p.pool.secretuuid } ) );
			for ( const scr of secretsToCreate ) {
				const secretXML = await promisers.xmlCompile( scr, join( __dirname, './virsh/templates/secret.define.xml' ) );
				const secretPath = '/tmp/' + scr.UUID + '.xml';
				await promisers.writeFile( secretPath, secretXML );
				await this.executeCommandAction( 'virsh secret-define --file ' + secretPath );
			}
			for ( const pool of extraPools ) {
				await this.executeCommandAction( 'virsh secret-set-value ' + pool.secretuuid + ' ' + pool.key );

				if ( !existingPools[ pool.id ] ) {
					( pool as any ).source = pool.monitors.split( ',' ).map( s => s.trim() ).map( s => { const [ address, port ] = s.split( ':' ).map( t => t.trim() ); return { address, port }; } );
					const poolXML = await promisers.xmlCompile( pool, join( __dirname, './virsh/templates/pool.define.xml' ) );
					const poolPath = '/tmp/' + pool.id + '.xml';
					await promisers.writeFile( poolPath, poolXML );
					await this.executeCommandAction( 'virsh pool-define --file ' + poolPath );
				}
			}
		}

		receivedPools.forEach( async ( p ) => {
			if ( this.pools[ p.id ] && p.key !== this.pools[ p.id ].pool.key ) {
				this.pools[ p.id ].pool.key = p.key;
				await this.executeCommandAction( 'virsh secret-set-value ' + p.secretuuid + ' ' + p.key );
			}
			if ( p.files ) {
				this.pools[ p.id ].pool.files = p.files;
			} else {
				this.pools[ p.id ].pool.files = {};
			}
		} );

		receivedPools.forEach( async ( p ) => {
			if ( this.pools[ p.id ] ) {
				await this.executeCommandAction( 'virsh pool-autostart ' + p.id ).catch( () => ( {} ) );
				await this.executeCommandAction( 'virsh pool-start ' + p.id ).catch( () => ( {} ) );
			}
		} );

		Object.values( this.pools ).forEach( async ( p ) => {
			if ( p.worker ) {
				this.actAsPoolWorker( p );
				if ( !p.timer ) {
					p.timer = setInterval( () => { this.actAsPoolWorker( p ); }, 300000 );
					this.numberofWorkerRegistrations++;
				}
			}
		} );
	}

	private actAsPoolWorker = async ( payload: { pool: StoragePool, worker: boolean, timer: NodeJS.Timeout } ) => {
		console.log( 'We are at actAsPoolWorker' );
		let filesArti = 0;
		let filesEksi = 0;
		if ( !payload.pool.files ) payload.pool.files = {};
		const files = this.pools[ payload.pool.id ].pool.files;
		const volumes: { [ key: string ]: StoragePoolFile } = {};
		const volArray = await returner( await this.executeCommandAction( 'virsh vol-list --details --pool ' + payload.pool.id ) );
		volArray.forEach( ( v: any ) => { v.id = Buffer.from( v.Name ).toString( 'base64' ); volumes[ v.id ] = v; } );
		for ( const volume of ( volArray as any[] ) ) {
			if ( !files[ volume.id ] ) {
				filesArti++;
				await this.database.doc( `storagepools/${payload.pool.id}` ).update( { [ 'files.' + volume.id ]: volume } );
			}
		}
		if ( filesArti === 0 ) {
			for ( const registeredFile of Object.values( payload.pool.files ) ) {
				if ( !volumes[ registeredFile.id ] ) {
					filesEksi++;
					await this.database.doc( `storagepools/${payload.pool.id}` ).update( { [ 'files.' + registeredFile.id ]: firestore.FieldValue.delete() } );
				}
			}
		}
		for ( const file of ( volArray as any[] ).
			sort( SortById ).
			filter( v => !!files[ v.id ] ).
			map( v => files[ v.id ] ).
			map( v => {
				if ( !v.lastCheck ) v.lastCheck = addDays( new Date(), -365 );
				if ( ( v.lastCheck as any ).toDate ) v.lastCheck = ( v.lastCheck as any ).toDate();
				return v;
			} ).
			filter( v => v.lastCheck < addDays( new Date(), -7 ) ).
			filter( ( v, vi ) => ( vi < 1 ) ) ) {
			const result = await returner( await this.executeCommandAction( 'rbd du ' + file.Name ) );
			const newSize: string = ( result )[ 0 ].USED || '0';
			const newCapacity: string = ( result )[ 0 ].PROVISIONED || '0';
			await this.database.doc( `storagepools/${payload.pool.id}` ).update( {
				[ 'files.' + file.id + '.Allocation' ]: newSize,
				[ 'files.' + file.id + '.Capacity' ]: newCapacity,
				[ 'files.' + file.id + '.lastCheck' ]: ( new Date() )
			} );
		}
		console.log( 'Number of registered files:', Object.keys( payload.pool.files ).length, '#WorkerRegistrations:', this.numberofWorkerRegistrations, 'FilesArti:', filesArti, 'FilesEksi:', filesEksi );
	}

	private cancelPools = async () => {
		if ( this.poolsSubscription ) { this.poolsSubscription.unsubscribe(); this.poolsSubscription = null; }
	}

	private handleCommands = async () => {
		this.node.commands.sort( SortByUUID );
		const cc = this.node.commands.splice( 0, 1 )[ 0 ];
		this.commandQueue.push( cc );
		this.commandQueue.sort( SortByUUID );
		await this.nodeReference.update( { commands: firestore.FieldValue.arrayRemove( cc ) } ).catch( console.error );
		this.runCommands();
	}

	private runCommands = async () => {
		if ( !this.isCommandRunning ) {
			const cc = this.commandQueue.splice( 0, 1 )[ 0 ];
			if ( cc ) {
				this.isCommandRunning = true;
				await this.nodeReference.update( { currentCommand: cc.command } );
				const result = await this.executeCommandAction( cc.command );
				this.isCommandRunning = false;
				await this.nodeReference.update( { currentCommand: '', lastCommand: cc.command, lastCommandResult: result } );
				this.runCommands();
			}
		}
	}

	private executeCommandAction = ( command: string ): Promise<string> => {
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

	private handleRTCOffer = async () => {
		console.log( 'RTC: Request received' );
		const offer = JSON.parse( this.node.rtc.offer );
		await this.nodeReference.update( { 'rtc.offer': null } );
		const { servers } = await this.database.doc( 'settings/rtc' ).get().then( s => s.data() );
		const pc = new wrtc.RTCPeerConnection( servers, { optional: [] } );
		pc.oniceconnectionstatechange = () => {
			console.log( 'RTC: Connection state changed -', pc.iceConnectionState );
			if ( pc.iceConnectionState === 'failed' ) {
				// tslint:disable-next-line: no-use-before-declare
				if ( iceCandidateSub ) iceCandidateSub.unsubscribe();
			}
		};
		pc.onicecandidate = ( candidate ) => {
			if ( candidate.candidate ) {
				this.nodeReference.update( {
					'rtc.answerice': firestore.FieldValue.arrayUnion( JSON.stringify( { ice: candidate.candidate } ) )
				} );
			}
		};
		const iceCandidateSub = fromDocRef( this.nodeReference ).subscribe( ( a ) => {
			const n = ( a.data() ).rtc;
			if ( n ) {
				if ( n.offerice ) {
					if ( Array.isArray( n.offerice ) ) {
						n.offerice.forEach( ic => {
							pc.addIceCandidate( ( JSON.parse( ic ) ).ice );
						} );
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
			};
			dc.onclose = ( closeEvent ) => {
				console.log( 'RTC: Data channel is now closed -', dc.label );
				this.ptyProcess.kill();
				this.ptyProcess = null;
			};
			dc.onerror = ( errorEvent ) => {
				console.log( 'RTC: Data channel is now in error state -', dc.label );
				this.ptyProcess.kill();
				this.ptyProcess = null;
			};
		};
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
		};
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
