import {
	useEffect, useRef, useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EquipActionReq } from "ws-packets/src/fromClient/EquipActionReq";
import { EquipActionRes } from "ws-packets/src/fromServer/equip/EquipActionRes";
import { Blocked } from "ws-packets/src/fromServer/common/Blocked";
import { EquipCategoryData } from "ws-packets/src/objects/EquipCategoryData";
import { GameClient } from "@/src/networking/GameClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

type EquipmentActions = {
	categories: EquipCategoryData[];
	pending: boolean;
	error: string | null;

	/** Resolves with the translation key of the refusal, or null once the item moved. */
	submit: (action: EquipActionReq) => Promise<string | null>;
};

export function useEquipmentActions(initialCategories: EquipCategoryData[]): EquipmentActions {
	const queryClient = useQueryClient();
	const [categories, setCategories] = useState(initialCategories);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inFlight = useRef(false);
	const active = useRef(true);

	useEffect(() => {
		active.current = true;
		return (): void => {
			active.current = false;
		};
	}, []);

	const fail = (key: string): string => {
		if (active.current) {
			setError(key);
		}
		return key;
	};

	const submit = async (action: EquipActionReq): Promise<string | null> => {
		if (inFlight.current) {
			return null;
		}
		inFlight.current = true;
		setPending(true);
		setError(null);
		try {
			const answer = await GameClient.request(action, EquipActionRes, [Blocked]);
			if (answer.kind !== "answer") {
				return fail("app:common.connectionError");
			}
			if (!answer.packet.success) {
				return fail(`app:equipment.errors.${answer.packet.error ?? "invalid"}`);
			}
			if (!active.current) {
				return null;
			}
			setCategories(answer.packet.categories);
			await Promise.all([GAME_ENTITIES.INVENTORY, GAME_ENTITIES.PROFILE].map(entity =>
				queryClient.invalidateQueries({ queryKey: gameKey(entity) })));
			return null;
		}
		catch {
			return fail("app:common.connectionError");
		}
		finally {
			inFlight.current = false;
			if (active.current) {
				setPending(false);
			}
		}
	};

	return {
		categories, pending, error, submit
	};
}
