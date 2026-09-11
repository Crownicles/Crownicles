import {useEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {EquipReq} from "ws-packets/src/fromClient/EquipReq";
import {EquipActionReq} from "ws-packets/src/fromClient/EquipActionReq";
import {EquipActionRes} from "ws-packets/src/fromServer/equip/EquipActionRes";
import {EquipNoItemRes} from "ws-packets/src/fromServer/equip/EquipNoItemRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Blocked} from "ws-packets/src/fromServer/common/Blocked";
import {EquipCategoryData} from "ws-packets/src/objects/EquipCategoryData";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type EquipmentActions = {
	categories: EquipCategoryData[];
	pending: boolean;
	error: string | null;
	submit: (action: EquipActionReq) => Promise<void>;
};

export function requestEquipment(): Promise<GameAnswer<ReactionCollectorCreation>> {
	return GameClient.request(makeFromClientPacket(EquipReq, {}), ReactionCollectorCreation, [EquipNoItemRes, Blocked]);
}

export function useEquipmentActions(initialCategories: EquipCategoryData[]): EquipmentActions {
	const queryClient = useQueryClient();
	const [categories, setCategories] = useState(initialCategories);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inFlight = useRef(false);
	const active = useRef(true);

	useEffect(() => {
		active.current = true;
		return (): void => { active.current = false; };
	}, []);

	const submit = async (action: EquipActionReq): Promise<void> => {
		if (inFlight.current) return;
		inFlight.current = true;
		setPending(true);
		setError(null);
		try {
			const answer = await GameClient.request(action, EquipActionRes, [Blocked]);
			if (!active.current) return;
			if (answer.kind !== "answer") {
				setError("app:common.connectionError");
				return;
			}
			if (!answer.packet.success) {
				setError(`app:equipment.errors.${answer.packet.error ?? "invalid"}`);
				return;
			}
			setCategories(answer.packet.categories);
			await Promise.all([GAME_ENTITIES.INVENTORY, GAME_ENTITIES.PROFILE].map(entity =>
				queryClient.invalidateQueries({queryKey: gameKey(entity)})));
		}
		catch {
			if (active.current) setError("app:common.connectionError");
		}
		finally {
			inFlight.current = false;
			if (active.current) setPending(false);
		}
	};

	return {categories, pending, error, submit};
}
