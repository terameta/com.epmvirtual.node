import { keyBy } from 'lodash';

export const returner = async ( payload: string, by: string = null ) => {
	payload = payload.trim();
	const lines = payload.split( '\n' ).map( l => l.trim() );
	if ( lines.length === 0 ) throw new Error( 'Virsh returner payload is not valid' );
	const headers = lines[ 0 ].split( ' ' ).filter( h => !!h && h !== '' );
	const headerN = headers.length;
	const indices = headers.map( h => lines[ 0 ].indexOf( h ) );
	const toReturn: any[] = [];
	lines.forEach( ( l, li ) => {
		if ( li > 1 ) {
			const toPush: any = {};
			headers.forEach( ( h, hi ) => {
				// if ( hi < ( headerN - 1 ) ) {
				toPush[ h ] = l.substring( indices[ hi ], indices[ hi + 1 ] );
				// } else {}
			} );
			toReturn.push( toPush );
		}
	} );
	if ( by ) {
		return keyBy( toReturn, by );
	} else {
		return toReturn;
	}
}
