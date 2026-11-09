import {
	useEffect, useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ItemUpgradeRes } from "ws-packets/src/fromServer/report/ItemUpgradeRes";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

type ItemUpgradeState = {
	outcome: ItemUpgradeRes | null; clear: () => void;
};

/** A weapon or an armor just raised a level, celebrated until the player moves on. */
export function useItemUpgradeOutcome(): ItemUpgradeState {
	const [outcome, setOutcome] = useState<ItemUpgradeRes | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<ItemUpgradeRes>(ItemUpgradeRes.wireName, packet => {
		setOutcome(packet);
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.INVENTORY]) {
			queryClient.invalidateQueries({ queryKey: gameKey(entity) }).catch(console.error);
		}
	}), [queryClient]);
	return {
		outcome, clear: (): void => setOutcome(null)
	};
}
