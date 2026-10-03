import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {PetExpeditionRes, PetExpeditionStartedRes, PetExpeditionCancelRes, PetExpeditionRecallRes, PetExpeditionResolveRes, PetExpeditionErrorRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

export type ExpeditionOutcome =
	| {kind: "status"; packet: PetExpeditionRes}
	| {kind: "started"; packet: PetExpeditionStartedRes}
	| {kind: "cancelled"; packet: PetExpeditionCancelRes}
	| {kind: "recalled"; packet: PetExpeditionRecallRes}
	| {kind: "resolved"; packet: PetExpeditionResolveRes}
	| {kind: "error"; packet: PetExpeditionErrorRes};
type ExpeditionOutcomeState = {outcome: ExpeditionOutcome | null; clear: () => void};

export function useExpeditionOutcome(): ExpeditionOutcomeState {
	const [outcome, setOutcome] = useState<ExpeditionOutcome | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => {
		const client = WebSocketClient.getInstance();
		const receive = (result: ExpeditionOutcome): void => {
			setOutcome(result);
			if (result.kind === "status" || result.kind === "error") return;
			for (const entity of [GAME_ENTITIES.PET, GAME_ENTITIES.PROFILE, GAME_ENTITIES.INVENTORY, GAME_ENTITIES.GUILD, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.REPORT]) {
				queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
			}
		};
		const unregister = [
			client.registerPushedPacketHandler<PetExpeditionRes>(PetExpeditionRes.wireName, packet => receive({kind: "status", packet})),
			client.registerPushedPacketHandler<PetExpeditionStartedRes>(PetExpeditionStartedRes.wireName, packet => receive({kind: "started", packet})),
			client.registerPushedPacketHandler<PetExpeditionCancelRes>(PetExpeditionCancelRes.wireName, packet => receive({kind: "cancelled", packet})),
			client.registerPushedPacketHandler<PetExpeditionRecallRes>(PetExpeditionRecallRes.wireName, packet => receive({kind: "recalled", packet})),
			client.registerPushedPacketHandler<PetExpeditionResolveRes>(PetExpeditionResolveRes.wireName, packet => receive({kind: "resolved", packet})),
			client.registerPushedPacketHandler<PetExpeditionErrorRes>(PetExpeditionErrorRes.wireName, packet => receive({kind: "error", packet}))
		];
		return (): void => {unregister.forEach(stop => stop());};
	}, [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}