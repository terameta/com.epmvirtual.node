export const waiter = ( timeout?: number ) => {
	return new Promise( ( resolve ) => {
		setTimeout( resolve, timeout || 5000 );
	} );
}