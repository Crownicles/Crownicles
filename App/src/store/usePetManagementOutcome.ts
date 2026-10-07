import {useCallback, useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {PetManagementRes} from "ws-packets/src/fromServer/pet/PetManagementRes";
import {PET_MANAGEMENT_ERRORS, PetManagementOutcome} from "ws-packets/src/objects/PetManagement";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {petManagementRefusal} from "@/src/collectors/PetManagementOutcome";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

/** Backing out of a menu is not news: the player already knows they did it. */
function isWorthShowing(outcome: PetManagementOutcome): boolean {
	return outcome.type !== "error" || outcome.error !== PET_MANAGEMENT_ERRORS.CANCELLED;
}

type OutcomeState = {outcome: PetManagementOutcome | null; clear: () => void};
export function usePetManagementOutcome(): OutcomeState {
	const [outcome, setOutcome] = useState<PetManagementOutcome | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<PetManagementRes>(PetManagementRes.wireName, (packet, {answersRequest}) => {
		// The screen that asked shows the refusal where the player made the request.
		if (answersRequest && petManagementRefusal(packet.outcome) !== null) return;
		setOutcome(isWorthShowing(packet.outcome) ? packet.outcome : null);
		for (const entity of [GAME_ENTITIES.PET, GAME_ENTITIES.PROFILE, GAME_ENTITIES.SHELTER, GAME_ENTITIES.GUILD, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.REPORT]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}), [queryClient]);
	const clear = useCallback((): void => setOutcome(null), []);
	return {outcome, clear};
}