import {
	useCallback, useEffect, useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	DefenseCancelRes, DefenseRes
} from "ws-packets/src/fromServer/defense/DefenseRes";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

/** The style now defending the player; a missing personality means a different one at each fight. */
export type DefenseOutcome = {
	personality?: string;
};
type DefenseOutcomeState = {
	outcome: DefenseOutcome | null; clear: () => void;
};

export function useDefenseOutcome(): DefenseOutcomeState {
	const queryClient = useQueryClient();
	const [outcome, setOutcome] = useState<DefenseOutcome | null>(null);

	// The toast restarts its countdown whenever its dismissal changes identity.
	const clear = useCallback((): void => setOutcome(null), []);
	useEffect(() => {
		const client = WebSocketClient.getInstance();

		// The choice held the player: once it is answered, only the report needs to catch up.
		const unblocked = (): void => {
			queryClient.invalidateQueries({ queryKey: gameKey(GAME_ENTITIES.REPORT) }).catch(console.error);
		};
		const unregister = [
			client.registerPushedPacketHandler<DefenseRes>(DefenseRes.wireName, packet => {
				setOutcome(packet.personality ? { personality: packet.personality } : {});
				unblocked();
			}),

			// Backing out of the choice is not an event.
			client.registerPushedPacketHandler(DefenseCancelRes.wireName, unblocked)
		];
		return (): void => {
			unregister.forEach(stop => stop());
		};
	}, [queryClient]);
	return {
		outcome, clear
	};
}
