import { keyBy } from 'lodash';

export const returner = async ( payload: string, by: string = null ) => {
	const lines = payload.trim().split( '\n' ).map( l => l.trim() );
	if ( lines.length === 0 ) throw new Error( 'Virsh returner payload is not valid' );
	const headers = lines[ 0 ].split( ' ' ).filter( h => !!h && h !== '' ).map( h => ( { label: h, index: 0 } ) );
	const headerN = headers.length;
	const places = [];

	headers.forEach( header => {
		header.index = lines[ 0 ].indexOf( header.label );
		let shouldIterate = true;
		while ( shouldIterate ) {
			let isEmpty = true;
			lines.filter( ( l, li ) => li > 1 ).forEach( ( line, lIndex ) => {
				if ( header.index > 0 ) {
					if ( line[ header.index - 1 ] !== ' ' ) isEmpty = false;
				}
			} );
			if ( isEmpty ) shouldIterate = false;
			if ( shouldIterate ) header.index--;
		}
	} );

	const toReturn = lines.filter( ( l, li ) => li > 1 ).map( line => {
		const values = headers.map( ( h, hi ) => {
			if ( headers[ hi + 1 ] ) {
				return line.substring( h.index, headers[ hi + 1 ].index - 1 );
			} else {
				return line.substring( h.index );
			}
		} );
		const tuple: any = {};
		headers.forEach( ( h, hi ) => {
			tuple[ h.label ] = values[ hi ].trim();
		} );
		return tuple;
	} );

	if ( by ) {
		return keyBy( toReturn, by );
	} else {
		return toReturn;
	}
}
