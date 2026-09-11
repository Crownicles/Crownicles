import {useEffect, useRef, useState} from "react";
import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {FromClientPacketLike, FromServerPacketLike, makeFromClientPacket} from "ws-packets/src/MakePackets";
import {EquipReq} from "ws-packets/src/fromClient/EquipReq";
import {SellReq} from "ws-packets/src/fromClient/SellReq";
import {DrinkReq} from "ws-packets/src/fromClient/DrinkReq";
import {EquipNoItemRes} from "ws-packets/src/fromServer/equip/EquipNoItemRes";
import {SellNoItemRes, SellRes} from "ws-packets/src/fromServer/inventory/SellRes";
import {DrinkNoAvailablePotion} from "ws-packets/src/fromServer/drink/DrinkNoAvailablePotion";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Blocked} from "ws-packets/src/fromServer/common/Blocked";
import {GameClient, GameAnswer} from "@/src/networking/GameClient";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {useCollectors} from "@/src/collectors/CollectorsContext";

type InventoryMenu = {
	request: FromClientPacketLike<FromClientPacket>;
	emptyPacket: FromServerPacketLike<FromServerPacket>;
	emptyMessage: string;
};

export const INVENTORY_MENUS = {
	EQUIP: {request: EquipReq, emptyPacket: EquipNoItemRes, emptyMessage: "app:equipment.noItems"},
	SELL: {request: SellReq, emptyPacket: SellNoItemRes, emptyMessage: "app:sale.noItems"},
	DRINK: {request: DrinkReq, emptyPacket: DrinkNoAvailablePotion, emptyMessage: "app:inventoryActions.noPotion"}
} satisfies Record<string, InventoryMenu>;

type InventoryMenuState = {
	message: string | null;
	open: (menu: InventoryMenu) => Promise<void>;
};

function commandMessage(answer: GameAnswer<ReactionCollectorCreation>, menu: InventoryMenu): string {
	if (answer.kind !== "alternative") return "app:common.connectionError";
	if (answer.packetName === menu.emptyPacket.wireName) return menu.emptyMessage;
	return "app:collector.pending";
}

export function useInventoryMenus(): InventoryMenuState {
	const {track} = useCollectors();
	const [message, setMessage] = useState<string | null>(null);
	const inFlight = useRef(false);
	const active = useRef(true);

	useEffect(() => {
		active.current = true;
		return (): void => { active.current = false; };
	}, []);

	const open = async (menu: InventoryMenu): Promise<void> => {
		if (inFlight.current) return;
		inFlight.current = true;
		setMessage(null);
		try {
			const answer = await GameClient.request(makeFromClientPacket(menu.request, {}), ReactionCollectorCreation, [menu.emptyPacket, Blocked]);
			if (!active.current) return;
			if (answer.kind === "answer") track(answer.packet);
			else setMessage(commandMessage(answer, menu));
		}
		catch {
			if (active.current) setMessage("app:common.connectionError");
		}
		finally {
			inFlight.current = false;
		}
	};

	return {message, open};
}

type SaleOutcomeState = {outcome: SellRes | null; clear: () => void};

export function useSaleOutcome(): SaleOutcomeState {
	const [outcome, setOutcome] = useState<SellRes | null>(null);
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<SellRes>(SellRes.wireName, setOutcome), []);
	return {outcome, clear: (): void => setOutcome(null)};
}
