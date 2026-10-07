import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {ClassesCancelRes, ClassesCooldownRes, ClassesRes} from "ws-packets/src/fromServer/classes/ClassesRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

export type ClassOutcome = {kind: "success"; classId: number} | {kind: "cooldown"; timestamp: number};
type ClassOutcomeState = {outcome: ClassOutcome | null; clear: () => void};

export function useClassOutcome(): ClassOutcomeState {
	const queryClient = useQueryClient();
	const [outcome, setOutcome] = useState<ClassOutcome | null>(null);
	useEffect(() => {
		const client = WebSocketClient.getInstance();
		const receive = (result: ClassOutcome): void => {
			setOutcome(result);
			if (result.kind === "cooldown") return;
			for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.CLASSES, GAME_ENTITIES.INVENTORY, GAME_ENTITIES.REPORT]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
		};
		const unregister = [
			client.registerPushedPacketHandler<ClassesRes>(ClassesRes.wireName, packet => receive({kind: "success", classId: packet.classId})),
			client.registerPushedPacketHandler<ClassesCooldownRes>(ClassesCooldownRes.wireName, packet => receive({kind: "cooldown", timestamp: packet.timestamp})),
			// Backing out of the menu is not an event: only the report needs to catch up.
			client.registerPushedPacketHandler(ClassesCancelRes.wireName, () => queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.REPORT)}).catch(console.error))
		];
		return (): void => {unregister.forEach(stop => stop());};
	}, [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}