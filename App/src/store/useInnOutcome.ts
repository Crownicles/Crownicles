import {useCallback, useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {INN_OUTCOMES, InnRes} from "ws-packets/src/fromServer/report/InnRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type InnOutcomeState = {outcome: InnRes | null; clear: () => void};

/** A meal or a room just served at an inn, or the time before it is served again. */
export function useInnOutcome(): InnOutcomeState {
	const [outcome, setOutcome] = useState<InnRes | null>(null);
	const clear = useCallback((): void => setOutcome(null), []);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<InnRes>(InnRes.wireName, packet => {
		setOutcome(packet);
		if (packet.outcome.type !== INN_OUTCOMES.MEAL && packet.outcome.type !== INN_OUTCOMES.ROOM) return;
		queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.PROFILE)}).catch(console.error);
	}), [queryClient]);
	return {outcome, clear};
}
