import {
	useEffect, useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BlacksmithEnchantmentTransferRes } from "ws-packets/src/fromServer/report/BlacksmithEnchantmentTransferRes";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

type EnchantmentTransferState = {
	outcome: BlacksmithEnchantmentTransferRes | null; clear: () => void;
};

/** An enchantment the blacksmith just moved onto another equipment, acknowledged until the player moves on. */
export function useEnchantmentTransferOutcome(): EnchantmentTransferState {
	const [outcome, setOutcome] = useState<BlacksmithEnchantmentTransferRes | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<BlacksmithEnchantmentTransferRes>(BlacksmithEnchantmentTransferRes.wireName, packet => {
		setOutcome(packet);
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.INVENTORY]) {
			queryClient.invalidateQueries({ queryKey: gameKey(entity) }).catch(console.error);
		}
	}), [queryClient]);
	return {
		outcome, clear: (): void => setOutcome(null)
	};
}
