import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	ItemCategory, ItemConstants
} from "../../constants/ItemConstants";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ReactionCollectorBuyCategorySlotBuySuccess extends CrowniclesPacket {
}

export class ReactionCollectorBuyCategorySlotData extends ReactionCollectorData {
}

export class ReactionCollectorBuyCategorySlotReaction extends ReactionCollectorReaction {
	categoryId!: ItemCategory;

	maxSlots!: number;

	remaining!: number;
}

export class ReactionCollectorBuyCategorySlotCancelReaction extends ReactionCollectorData {
}

type BuyCategorySlotReaction = ReactionCollectorBuyCategorySlotReaction | ReactionCollectorBuyCategorySlotCancelReaction;
export type ReactionCollectorBuyCategorySlotPacket = ReactionCollectorCreationPacket<
	ReactionCollectorBuyCategorySlotData,
	BuyCategorySlotReaction
>;

export class ReactionCollectorBuyCategorySlot extends ReactionCollector {
	private readonly availableCategories!: number[];

	private readonly price!: number;

	constructor(availableCategories: number[]) {
		super();
		this.availableCategories = availableCategories;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorBuyCategorySlotPacket {
		const reactions = [];
		const categoriesCount = Object.keys(ItemCategory).length;
		for (let i = 0; i < categoriesCount; ++i) {
			if (this.availableCategories[i] > 0) {
				reactions.push(this.buildReaction(ReactionCollectorBuyCategorySlotReaction, {
					categoryId: i,
					maxSlots: ItemConstants.SLOTS.LIMITS[i] - 1,
					remaining: this.availableCategories[i]
				}));
			}
		}
		reactions.push(this.buildReaction(ReactionCollectorBuyCategorySlotCancelReaction, {}));

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorBuyCategorySlotData, {
				price: this.price
			})
		};
	}
}
