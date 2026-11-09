import {
	useEffect, useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApartmentRentRes } from "ws-packets/src/fromServer/home/ApartmentRentRes";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

type ApartmentRentState = {
	outcome: ApartmentRentRes | null; clear: () => void;
};

/** A rent collected at the notary, said in passing: the city refreshes on its own, the gain would otherwise go unseen. */
export function useApartmentRentOutcome(): ApartmentRentState {
	const [outcome, setOutcome] = useState<ApartmentRentRes | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<ApartmentRentRes>(ApartmentRentRes.wireName, packet => {
		setOutcome(packet);
		queryClient.invalidateQueries({ queryKey: gameKey(GAME_ENTITIES.PROFILE) }).catch(console.error);
	}), [queryClient]);
	return {
		outcome, clear: (): void => setOutcome(null)
	};
}
