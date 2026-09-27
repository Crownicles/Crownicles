import {COMMAND_REJECTIONS} from "ws-packets/src/objects/CommandRejection";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {PLAYER_EFFECTS} from "ws-packets/src/objects/PlayerUtility";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {RequestState} from "@/src/store/useGameQuery";

/** Core refuses most commands to a character who has not set off yet. */
export function refusedAsNotStarted(state: RequestState<FromServerPacket>): boolean {
	return state.status === "failed"
		&& state.rejection?.type === COMMAND_REJECTIONS.EFFECT
		&& state.rejection.currentEffectId === PLAYER_EFFECTS.NOT_STARTED;
}

/** Whether Core refuses the profile because the character has not set off yet, which only the first report changes. */
export function usePlayerHasNotStarted(): boolean {
	return refusedAsNotStarted(usePlayerProfile());
}
