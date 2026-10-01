import {useSyncExternalStore} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {createPlatformGames} from "./PlatformGames";
import {GameServicesSnapshot, GameServicesStore} from "./GameServicesStore";

export const gameServicesStore = new GameServicesStore(createPlatformGames(), AsyncStorage);

export function useGameServices(): GameServicesSnapshot {
	return useSyncExternalStore(gameServicesStore.subscribe, gameServicesStore.getSnapshot, gameServicesStore.getSnapshot);
}