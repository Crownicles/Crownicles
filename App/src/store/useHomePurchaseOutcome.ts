import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {HomePurchaseRes} from "ws-packets/src/fromServer/home/HomePurchaseRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type HomePurchaseState = {outcome: HomePurchaseRes | null; clear: () => void};

/** A home or an apartment just bought at the notary, celebrated until the player moves on. */
export function useHomePurchaseOutcome(): HomePurchaseState {
	const [outcome, setOutcome] = useState<HomePurchaseRes | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<HomePurchaseRes>(HomePurchaseRes.wireName, packet => {
		setOutcome(packet);
		queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.PROFILE)}).catch(console.error);
	}), [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}
