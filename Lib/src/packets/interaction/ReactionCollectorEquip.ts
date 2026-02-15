import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { EquipCategoryData } from "../../types/EquipCategoryData";

export class ReactionCollectorEquipData extends ReactionCollectorData {
	categories!: EquipCategoryData[];
}

export class ReactionCollectorEquipCloseReaction extends ReactionCollectorReaction {
}

export type ReactionCollectorEquipPacket = ReactionCollectorCreationPacket<
	ReactionCollectorEquipData,
	ReactionCollectorEquipCloseReaction
>;

export class ReactionCollectorEquip extends ReactionCollector {
	private readonly categories: EquipCategoryData[];

	constructor(categories: EquipCategoryData[]) {
		super();
		this.categories = categories;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorEquipPacket {
		return {
			id,
			endTime,
			reactions: [this.buildReaction(ReactionCollectorEquipCloseReaction, {})],
			data: this.buildData(ReactionCollectorEquipData, {
				categories: this.categories
			}),
			mainPacket: true
		};
	}
}
