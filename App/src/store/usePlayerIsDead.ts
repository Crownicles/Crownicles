import {PLAYER_EFFECTS} from "ws-packets/src/objects/PlayerUtility";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

/** Whether the shared profile says the character is dead, which leaves respawning as the only thing to do. */
export function usePlayerIsDead(): boolean {
	const state = usePlayerProfile();
	return state.status === "ready" && state.data.effect.effect === PLAYER_EFFECTS.DEAD;
}
