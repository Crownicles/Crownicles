import {COMMAND_REJECTIONS} from "ws-packets/src/objects/CommandRejection";
import {PLAYER_EFFECTS} from "ws-packets/src/objects/PlayerUtility";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

/** Whether Core refuses the profile because the character has not set off yet, which only the first report changes. */
export function usePlayerHasNotStarted(): boolean {
	const state = usePlayerProfile();
	return state.status === "failed"
		&& state.rejection?.type === COMMAND_REJECTIONS.EFFECT
		&& state.rejection.currentEffectId === PLAYER_EFFECTS.NOT_STARTED;
}
