import {
	useEffect, useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HomeBedRes } from "ws-packets/src/fromServer/home/HomeBedRes";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

type HomeBedState = {
	outcome: HomeBedRes | null; clear: () => void;
};

/** A rest in the player's own bed, said in passing over the home they stay in. */
export function useHomeBedOutcome(): HomeBedState {
	const [outcome, setOutcome] = useState<HomeBedRes | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<HomeBedRes>(HomeBedRes.wireName, packet => {
		setOutcome(packet);
		queryClient.invalidateQueries({ queryKey: gameKey(GAME_ENTITIES.PROFILE) }).catch(console.error);
	}), [queryClient]);
	return {
		outcome, clear: (): void => setOutcome(null)
	};
}
