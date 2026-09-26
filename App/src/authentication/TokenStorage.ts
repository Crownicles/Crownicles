import {Platform} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {deleteItemAsync, getItemAsync, setItemAsync} from "expo-secure-store";

/**
 * Where the session is kept between launches.
 *
 * The builds that ship put it in the device keychain. `expo-secure-store` has no browser
 * implementation, so a browser opened for development falls back to the plain key/value store:
 * enough to exercise the game, never a shipped configuration.
 */
const keychainAvailable = Platform.OS !== "web";

export const TOKEN_STORAGE_KEY_TEMPLATE = "auth-token-";

export function readStoredToken(key: string): Promise<string | null> {
	return keychainAvailable ? getItemAsync(key) : AsyncStorage.getItem(key);
}

/** The session is stored in chunks because the keychain caps the size of a single item. */
export async function readFullStoredToken(): Promise<string> {
	let token = "";
	let part = 1;
	let chunk = await readStoredToken(`${TOKEN_STORAGE_KEY_TEMPLATE}${part}`);
	while (chunk) {
		token += chunk;
		part++;
		chunk = await readStoredToken(`${TOKEN_STORAGE_KEY_TEMPLATE}${part}`);
	}
	return token;
}

export function writeStoredToken(key: string, value: string): Promise<void> {
	return keychainAvailable ? setItemAsync(key, value) : AsyncStorage.setItem(key, value);
}

export function deleteStoredToken(key: string): Promise<void> {
	return keychainAvailable ? deleteItemAsync(key) : AsyncStorage.removeItem(key);
}
