import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {PetManagementRes} from "ws-packets/src/fromServer/pet/PetManagementRes";
import {PetManagementOutcome} from "ws-packets/src/objects/PetManagement";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type OutcomeState = {outcome: PetManagementOutcome | null; clear: () => void};
export function usePetManagementOutcome(): OutcomeState {
	const [outcome, setOutcome] = useState<PetManagementOutcome | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<PetManagementRes>(PetManagementRes.wireName, packet => {
		setOutcome(packet.outcome);
		for (const entity of [GAME_ENTITIES.PET, GAME_ENTITIES.PROFILE, GAME_ENTITIES.SHELTER, GAME_ENTITIES.GUILD, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.REPORT]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}), [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}