import {useEffect, useRef, useState} from "react";
import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {FromClientPacketLike, FromServerPacketLike, makeFromClientPacket} from "ws-packets/src/MakePackets";
import {EquipReq} from "ws-packets/src/fromClient/EquipReq";
import {SellReq} from "ws-packets/src/fromClient/SellReq";
import {DrinkReq} from "ws-packets/src/fromClient/DrinkReq";
import {EquipNoItemRes} from "ws-packets/src/fromServer/equip/EquipNoItemRes";
import {SellNoItemRes} from "ws-packets/src/fromServer/inventory/SellRes";
import {DailyBonusReq} from "ws-packets/src/fromClient/DailyBonusReq";
import {DailyBonusCooldownRes, DailyBonusNoObjectRes, DailyBonusRes} from "ws-packets/src/fromServer/inventory/DailyBonusRes";
import {DrinkNoAvailablePotion} from "ws-packets/src/fromServer/drink/DrinkNoAvailablePotion";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Blocked} from "ws-packets/src/fromServer/common/Blocked";
import {GameClient, GameAnswer} from "@/src/networking/GameClient";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {i18n} from "@/src/translations/i18n";
import {commandRejectionMessage} from "@/src/display/CommandRejection";

export type CommandMenu = {
	request: FromClientPacketLike<FromClientPacket>;
	emptyPacket: FromServerPacketLike<FromServerPacket>;
	emptyMessage: string;
	outcomePackets?: FromServerPacketLike<FromServerPacket>[];
};

export const INVENTORY_MENUS = {
	EQUIP: {request: EquipReq, emptyPacket: EquipNoItemRes, emptyMessage: "app:equipment.noItems"},
	SELL: {request: SellReq, emptyPacket: SellNoItemRes, emptyMessage: "app:sale.noItems"},
	DRINK: {request: DrinkReq, emptyPacket: DrinkNoAvailablePotion, emptyMessage: "app:inventoryActions.noPotion"},
	DAILY: {request: DailyBonusReq, emptyPacket: DailyBonusNoObjectRes, emptyMessage: "app:dailyBonus.noObject", outcomePackets: [DailyBonusRes, DailyBonusCooldownRes]}
} satisfies Record<string, CommandMenu>;

/** Picks the reaction the screen already knows the player chose, or nothing to let them choose. */
type MenuResolver = (collector: ReactionCollectorCreation) => number | null;

export type CommandMenuState = {
	message: string | null;
	pending: boolean;
	open: (menu: CommandMenu, request?: FromClientPacket, resolve?: MenuResolver) => Promise<void>;
};

function commandMessage(answer: GameAnswer<ReactionCollectorCreation>, menu: CommandMenu): string | null {
	if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
	if (answer.kind !== "alternative") return i18n.t("app:common.connectionError");
	if (answer.packetName === menu.emptyPacket.wireName) return i18n.t(menu.emptyMessage);
	if (menu.outcomePackets?.some(packet => packet.wireName === answer.packetName)) return null;
	return i18n.t("app:collector.pending");
}

export function useCommandMenus(): CommandMenuState {
	const {track, answerWithoutShowing} = useCollectors();
	const [message, setMessage] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const inFlight = useRef(false);
	const active = useRef(true);

	useEffect(() => {
		active.current = true;
		return (): void => { active.current = false; };
	}, []);

	const open = async (menu: CommandMenu, request?: FromClientPacket, resolve?: MenuResolver): Promise<void> => {
		if (inFlight.current) return;
		inFlight.current = true;
		setPending(true);
		setMessage(null);
		try {
			const answer = await GameClient.request(request ?? makeFromClientPacket(menu.request, {}), ReactionCollectorCreation, [menu.emptyPacket, Blocked, ...menu.outcomePackets ?? []]);
			if (!active.current) return;
			if (answer.kind !== "answer") {
				setMessage(commandMessage(answer, menu));
				return;
			}
			const reactionIndex = resolve?.(answer.packet) ?? null;
			if (reactionIndex === null) track(answer.packet);
			else answerWithoutShowing(answer.packet.id, reactionIndex);
		}
		catch {
			if (active.current) setMessage(i18n.t("app:common.connectionError"));
		}
		finally {
			inFlight.current = false;
			if (active.current) setPending(false);
		}
	};

	return {message, pending, open};
}
