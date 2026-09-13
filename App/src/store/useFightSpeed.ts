import {useEffect, useRef, useState} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {FIGHT_SPEEDS, FightSpeed} from "@/src/display/FightMotion";

export type FightSpeedSetting = {speed: FightSpeed; setSpeed: (speed: FightSpeed) => void};
const FIGHT_SPEED_STORAGE_KEY = "combat-animation-speed";

export function useFightSpeed(): FightSpeedSetting {
	const [speed, updateSpeed] = useState<FightSpeed>(FIGHT_SPEEDS.NORMAL);
	const changed = useRef(false);
	useEffect(() => {
		let active = true;
		AsyncStorage.getItem(FIGHT_SPEED_STORAGE_KEY).then(saved => {
			if (!active || changed.current) return;
			if (saved === FIGHT_SPEEDS.NORMAL || saved === FIGHT_SPEEDS.FAST) updateSpeed(saved);
		}).catch(error => console.warn("Could not restore combat animation speed", error));
		return (): void => {active = false;};
	}, []);
	const setSpeed = (next: FightSpeed): void => {
		changed.current = true;
		updateSpeed(next);
		AsyncStorage.setItem(FIGHT_SPEED_STORAGE_KEY, next).catch(error => console.warn("Could not save combat animation speed", error));
	};
	return {speed, setSpeed};
}