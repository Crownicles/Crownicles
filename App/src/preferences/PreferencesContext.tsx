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

	const setDevMode = (devMode: boolean) => {
		setPreferences(prev => ({ ...prev, devMode }));
		savePreferences().then().catch(error => {
			console.error("Failed to save preferences:", error);
		});
	};

	const getDevMode = () => {
		return preferences.devMode;
	}

	const savePreferences = async () => {
		try {
			await AsyncStorage.setItem("preferences", JSON.stringify(preferences));
		} catch (error) {
			console.error("Failed to save preferences:", error);
		}
	}

	// todo: loadPreferences not working
	const loadPreferences = async () => {
		try {
			const storedPreferences = await AsyncStorage.getItem("preferences");
			if (storedPreferences) {
				const parsedPreferences = JSON.parse(storedPreferences);
				setPreferences({
					devMode: parsedPreferences.devMode || false,
				});
			}
		} catch (error) {
			console.error("Failed to load preferences:", error);
		}
	}

	useEffect(() => {
		loadPreferences().then().catch(error => {
			console.error("Failed to load preferences on mount:", error);
		});
	}, []);

	return (
		<PreferencesContext.Provider value={{ setDevMode, getDevMode }}>
			{children}
		</PreferencesContext.Provider>
	);
}