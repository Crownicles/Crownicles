import React, {PropsWithChildren, useEffect} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PreferencesValues {
	devMode: boolean;
}

type Preferences = {
	setDevMode(devMode: boolean): void;
	getDevMode(): boolean;
}

export const PreferencesContext = React.createContext<Preferences>({
	setDevMode(): void {
		console.warn("setDevMode called without PreferencesContext.Provider");
	},
	getDevMode(): boolean {
		console.warn("getDevMode called without PreferencesContext.Provider");
		return false;
	}
});

export function PreferencesProvider({ children }: PropsWithChildren) {
	const [preferences, setPreferences] = React.useState<PreferencesValues>({
		devMode: false
	});

	const savePreferences = async (): Promise<void> => {
		try {
			await AsyncStorage.setItem("preferences", JSON.stringify(preferences));
		} catch (error) {
			console.error("Failed to save preferences:", error);
		}
	}

	const setDevMode = (devMode: boolean): void => {
		setPreferences(prev => ({ ...prev, devMode }));
		savePreferences().then().catch(error => {
			console.error("Failed to save preferences:", error);
		});
	};

	const getDevMode = (): boolean => {
		return preferences.devMode;
	}

	const loadPreferences = async (): Promise<PreferencesValues | null> => {
		try {
			const storedPreferences = await AsyncStorage.getItem("preferences");
			if (storedPreferences) {
				const parsedPreferences = JSON.parse(storedPreferences);
				return {
					devMode: parsedPreferences.devMode || false,
				};
			}
		} catch (error) {
			console.error("Failed to load preferences:", error);
		}
		return null;
	}

	useEffect(() => {
		loadPreferences().then(storedPreferences => {
			if (storedPreferences) {
				setPreferences(storedPreferences);
			}
		}).catch(error => {
			console.error("Failed to load preferences on mount:", error);
		});
	}, []);

	return (
		<PreferencesContext.Provider value={{ setDevMode, getDevMode }}>
			{children}
		</PreferencesContext.Provider>
	);
}