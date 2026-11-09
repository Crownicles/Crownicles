import {
	useEffect, useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EnchanterDisenchantRes } from "ws-packets/src/fromServer/report/EnchanterDisenchantRes";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

type EnchanterDisenchantState = {
	outcome: EnchanterDisenchantRes | null; clear: () => void;
};

/** An enchantment Mernil just removed for free, acknowledged until the player moves on. */
export function useEnchanterDisenchantOutcome(): EnchanterDisenchantState {
	const [outcome, setOutcome] = useState<EnchanterDisenchantRes | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<EnchanterDisenchantRes>(EnchanterDisenchantRes.wireName, packet => {
		setOutcome(packet);
		queryClient.invalidateQueries({ queryKey: gameKey(GAME_ENTITIES.INVENTORY) }).catch(console.error);
	}), [queryClient]);
	return {
		outcome, clear: (): void => setOutcome(null)
	};
}
