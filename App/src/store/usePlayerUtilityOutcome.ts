import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {PlayerUtilityRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {PlayerUtilityOutcome} from "ws-packets/src/objects/PlayerUtility";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type UtilityOutcomeState = {outcome: PlayerUtilityOutcome | null; clear: () => void};
export function usePlayerUtilityOutcome(): UtilityOutcomeState {
	const [outcome, setOutcome] = useState<PlayerUtilityOutcome | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<PlayerUtilityRes>(PlayerUtilityRes.wireName, packet => {
		if (packet.outcome.type === "error" || packet.outcome.type === "money") {
			setOutcome(packet.outcome);
			return;
		}
		// The death screen already announced the cost and played the resurrection: leaving it is the result.
		if (packet.outcome.type !== "respawn") setOutcome(packet.outcome);
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.REPORT, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.MAP, GAME_ENTITIES.GUILD]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}), [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}
