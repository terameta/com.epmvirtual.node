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
		// return line.trim();
		const values = headers.map( ( h, hi ) => {
			if ( headers[ hi + 1 ] ) {
				return line.substring( h.index, headers[ hi + 1 ].index - 1 );
			} else {
				return line.substring( h.index );
			}
		} );
		const tuple: any = {};
		headers.forEach( ( h, hi ) => {
			tuple[ h.label ] = values[ hi ];
		} );
		return tuple;
	} );

	console.log( '===========================================' );
	console.log( payload );
	console.log( '===========================================' );
	console.log( headers );
	console.log( '===========================================' );
	console.log( toReturn );
	console.log( '===========================================' );
	console.log( '===========================================' );

	// if ( by ) {
	// 	return keyBy( toReturn, by );
	// } else {
	// 	return toReturn;
	// }
}

/**
function prepare(result, command){
	var deferred = Q.defer();

	if(lines.length == 0){
		deferred.reject("Result is not valid");
	} else {
		var toReturn = [];
		var places = [];


		var curPlace = 0;
		var nexPlace = 0;

		var curObject = {};

		for( var l = 2; l < lines.length; l++ ){
			curObject = {};

			for( var p = 0; p < places.length; p++ ){
				curPlace = 0;
				nexPlace = 0;
				curPlace = places[p];
				if(p != (places.length -1) ) nexPlace = nexPlace = places[p+1];
				var curProp = '';
				if(nexPlace > 0){
					curProp = lines[l].substring(curPlace,nexPlace).trim();
				} else {
					curProp = lines[l].substring(curPlace).trim();
				}
				//console.log(p, headers[p], curProp);
				curObject[headers[p]] = curProp;
			}
			toReturn.push(curObject);
		}
		deferred.resolve(toReturn);
	}
	return deferred.promise;
}
 */