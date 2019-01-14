export const returner = async ( payload: string ) => {
	payload = payload.trim();
	const lines = payload.split( '\n' ).map( l => l.trim() );
	if ( lines.length === 0 ) throw new Error( 'Virsh returner payload is not valid' );
	const headers = lines[ 0 ].split( ' ' ).filter( h => !!h && h !== '' );
	const headerN = headers.length;
	const indices = headers.map( h => lines[ 0 ].indexOf( h ) );
	const toReturn: any[] = [];
	console.log( '===========================================' );
	console.log( headers );
	console.log( indices );
	console.log( '===========================================' );
	lines.forEach( ( l, li ) => {
		if ( li > 0 ) {
			const toPush: any = {};
			headers.forEach( ( h, hi ) => {
				// if ( hi < ( headerN - 1 ) ) {
				toPush[ h ] = l.substring( indices[ hi ], indices[ hi + 1 ] );
				// } else {

				// }
			} );
			toReturn.push( toPush );
		}
	} );
	console.log( toReturn );
	console.log( '===========================================' );
	console.log( '===========================================' );
	return toReturn;
}
/**
 *
var Q				= require('q');

module.exports = {
	prepare: prepare
};

function prepare(result, command){
	var deferred = Q.defer();
	var wte = ''; 		//What to Expect
	if(command == 'list'){			wte = ['Id', 'Name', 'State'];																					}
	if(command == 'vol-list'){		wte = ['Name', 'Path', 'Type', 'Capacity', 'Allocation'];												}
	if(command == 'domblklist'){	wte = ['Type', 'Device', 'Target', 'Source'];																}
	if(command == 'secret-list'){	wte = ['UUID', 'Usage'];																							}
	if(command == 'pool-list'){	wte = ['Name', 'State', 'Autostart', 'Persistent', 'Capacity', 'Allocation', 'Available'];	}

	result = result.trim();

	var lines = result.split('\n');
	for( var cl = 0; cl < lines.length; cl++ ){
		lines[cl] = lines[cl].trim();
	}

	if(lines.length == 0){
		deferred.reject("Result is not valid");
	} else {
		var toReturn = [];
		var places = [];
		for( var i = 0; i < wte.length; i++ ){
			places[i] = lines[0].indexOf(wte[i]);
			var shouldIterate = true;
			while(shouldIterate){
				var isEmpty = true;

				for( var clc = 2; clc < lines.length; clc++ ){
					if(places[i] > 0){
						if( lines[clc][places[i] - 1] != ' ') isEmpty = false;
					}
				}

				if(isEmpty) shouldIterate = false;
				if(shouldIterate) places[i] = places[i] - 1;
			}
		}

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
				//console.log(p, wte[p], curProp);
				curObject[wte[p]] = curProp;
			}
			toReturn.push(curObject);
		}
		deferred.resolve(toReturn);
	}
	return deferred.promise;
}
 */