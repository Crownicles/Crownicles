import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {ClassesCancelRes, ClassesCooldownRes, ClassesRes} from "ws-packets/src/fromServer/classes/ClassesRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

export type ClassOutcome = {kind: "success"; classId: number} | {kind: "cooldown"; timestamp: number} | {kind: "cancelled"};
type ClassOutcomeState = {outcome: ClassOutcome | null; clear: () => void};

export function useClassOutcome(): ClassOutcomeState {
	const queryClient = useQueryClient();
	const [outcome, setOutcome] = useState<ClassOutcome | null>(null);
	useEffect(() => {
		const client = WebSocketClient.getInstance();
		const receive = (result: ClassOutcome): void => {
			setOutcome(result);
			if (result.kind === "cooldown") return;
			const entities = result.kind === "success" ? [GAME_ENTITIES.PROFILE, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.CLASSES, GAME_ENTITIES.INVENTORY, GAME_ENTITIES.REPORT] : [GAME_ENTITIES.REPORT];
			for (const entity of entities) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
		};
		const unregister = [
			client.registerPushedPacketHandler<ClassesRes>(ClassesRes.wireName, packet => receive({kind: "success", classId: packet.classId})),
			client.registerPushedPacketHandler<ClassesCooldownRes>(ClassesCooldownRes.wireName, packet => receive({kind: "cooldown", timestamp: packet.timestamp})),
			client.registerPushedPacketHandler(ClassesCancelRes.wireName, () => receive({kind: "cancelled"}))
		];
		return (): void => {unregister.forEach(stop => stop());};
	}, [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}