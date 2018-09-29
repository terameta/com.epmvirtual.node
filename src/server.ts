import { EPMNode } from "./server.application";

const app = new EPMNode();

// const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// const ptyProcess = pty.spawn( shell, [], {
// 	name: 'xterm-color',
// 	cols: 80,
// 	rows: 30,
// 	cwd: process.env.HOME,
// 	env: process.env
// } );

// ptyProcess.on( 'data', ( data ) => {
// 	console.log( data );
// } );

// ptyProcess.write( 'ls\r' );
// ptyProcess.resize( 100, 40 );
// ptyProcess.write( 'top\r' );


