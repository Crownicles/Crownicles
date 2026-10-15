import { EquipCategoryData } from "../../../objects/EquipCategoryData";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		equip: {
			categories: EquipCategoryData[];
		};
	}

	interface ReactionCollectorReactionPayloads {
		equipClose: Record<string, never>;
	}
}

export const EQUIP_DATA_KINDS = { COLLECTOR: "equip" } as const satisfies Record<string, ReactionCollectorDataKind>;

export const EQUIP_REACTION_KINDS = { CLOSE: "equipClose" } as const satisfies Record<string, ReactionCollectorReactionKind>;
