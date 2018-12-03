export interface Settings {
	firebase: {
		apiKey: string,
		authDomain: string,
		databaseURL: string,
		projectId: string,
		timestampsInSnapshots: boolean
	}
}

export interface SettingsWithCredentials extends Settings {
	firebaseUser: string,
	firebasePass: string
}