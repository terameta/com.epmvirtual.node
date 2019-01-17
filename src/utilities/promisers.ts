import * as fs from 'fs';
import { compile } from 'handlebars';

export const readFile = ( path: string, encoding: string = 'utf8' ) => {
	return new Promise( ( resolve, reject ) => {
		fs.readFile( path, encoding, ( error, data ) => {
			if ( error ) {
				reject( error );
			} else {
				resolve( data );
			}
		} );
	} );
};

export const xmlCompile = async ( payload: any, xmlPath: string, encoding: string = 'utf8' ) => {
	const xml = await readFile( xmlPath, encoding );
	const template = compile( xml );
	return template( payload );
}

export const jsonParse = ( toParse: string ) => {
	return new Promise( ( resolve, reject ) => {
		try {
			const toReturn = JSON.parse( toParse );
			resolve( toReturn );
		} catch ( e ) {
			reject( 'Not a valid json:' + toParse );
		}
	} );
};