import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {PetFeedOutcome, PetFeedRes} from "ws-packets/src/fromServer/pet/PetCareRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type PetFeedOutcomeState = {outcome: PetFeedOutcome | null; clear: () => void};

export function usePetFeedOutcome(): PetFeedOutcomeState {
	const queryClient = useQueryClient();
	const [outcome, setOutcome] = useState<PetFeedOutcome | null>(null);
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<PetFeedRes>(PetFeedRes.wireName, packet => {
		setOutcome(packet.outcome);
		const entities = packet.outcome.success ? [GAME_ENTITIES.PET, GAME_ENTITIES.PROFILE, GAME_ENTITIES.GUILD, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.REPORT] : [GAME_ENTITIES.PET, GAME_ENTITIES.REPORT];
		for (const entity of entities) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}), [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}