import {
	useEffect, useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ItemRecycleRes } from "ws-packets/src/fromServer/report/ItemRecycleRes";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

type ItemRecycleState = {
	outcome: ItemRecycleRes | null; clear: () => void;
};

/** A reserve item just dismantled by the scrap dealer, shown with what it gave back until the player moves on. */
export function useItemRecycleOutcome(): ItemRecycleState {
	const [outcome, setOutcome] = useState<ItemRecycleRes | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<ItemRecycleRes>(ItemRecycleRes.wireName, packet => {
		setOutcome(packet);
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.INVENTORY]) {
			queryClient.invalidateQueries({ queryKey: gameKey(entity) }).catch(console.error);
		}
	}), [queryClient]);
	return {
		outcome, clear: (): void => setOutcome(null)
	};
}
