import {useCallback, useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {SellCancelRes, SellRes} from "ws-packets/src/fromServer/inventory/SellRes";
import {DailyBonusCancelRes, DailyBonusCooldownRes, DailyBonusRes} from "ws-packets/src/fromServer/inventory/DailyBonusRes";
import {DrinkRes} from "ws-packets/src/fromServer/drink/DrinkRes";
import {DrinkCancel} from "ws-packets/src/fromServer/drink/DrinkCancel";
import {ItemRefusedRes} from "ws-packets/src/fromServer/inventory/ItemRefusedRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

export type InventoryOutcome =
	| {kind: "sale"; packet: SellRes}
	| {kind: "refused"; packet: ItemRefusedRes}
	| {kind: "daily"; packet: DailyBonusRes}
	| {kind: "drink"; packet: DrinkRes}
	| {kind: "cooldown"; packet: DailyBonusCooldownRes};

type InventoryOutcomeState = {outcome: InventoryOutcome | null; clear: () => void};

export function useInventoryOutcome(): InventoryOutcomeState {
	const [outcome, setOutcome] = useState<InventoryOutcome | null>(null);
	const clear = useCallback((): void => setOutcome(null), []);
	const queryClient = useQueryClient();
	useEffect(() => {
		const client = WebSocketClient.getInstance();
		const receive = (result: InventoryOutcome): void => {
			setOutcome(result);
			if (result.kind === "cooldown") return;
			for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.INVENTORY, GAME_ENTITIES.REPORT]) {
				queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(error => console.error("Failed to refresh inventory outcome:", error));
			}
		};
		const refreshAfterCancellation = (): void => {
			queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.REPORT)}).catch(error => console.error("Failed to resume report:", error));
		};
		const unregister = [
			client.registerPushedPacketHandler<SellRes>(SellRes.wireName, packet => receive({kind: "sale", packet})),
			client.registerPushedPacketHandler<ItemRefusedRes>(ItemRefusedRes.wireName, packet => receive({kind: "refused", packet})),
			client.registerPushedPacketHandler<DailyBonusRes>(DailyBonusRes.wireName, packet => receive({kind: "daily", packet})),
			client.registerPushedPacketHandler<DrinkRes>(DrinkRes.wireName, packet => receive({kind: "drink", packet})),
			client.registerPushedPacketHandler<DailyBonusCooldownRes>(DailyBonusCooldownRes.wireName, packet => receive({kind: "cooldown", packet})),
			client.registerPushedPacketHandler(SellCancelRes.wireName, refreshAfterCancellation),
			client.registerPushedPacketHandler(DrinkCancel.wireName, refreshAfterCancellation),
			client.registerPushedPacketHandler(DailyBonusCancelRes.wireName, refreshAfterCancellation)
		];
		return (): void => { unregister.forEach(stop => stop()); };
	}, [queryClient]);
	return {outcome, clear};
}
