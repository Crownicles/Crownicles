import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

export class ReactionCollectorDeposeItemData extends ReactionCollectorData {
}

export class ReactionCollectorDeposeItemReaction extends ReactionCollectorReaction {
	itemIndex!: number;

	item!: ItemWithDetails;
}

export class ReactionCollectorDeposeItemCloseReaction extends ReactionCollectorReaction {
}

export class ReactionCollectorDeposeItem extends ReactionCollector {
	private readonly itemList: ItemWithDetails[];

	constructor(itemList: ItemWithDetails[]) {
		super();
		this.itemList = itemList;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		const reactions: {
			type: string;
			data: ReactionCollectorReaction;
		}[] = this.itemList.map((item, itemIndex) => this.buildReaction(ReactionCollectorDeposeItemReaction, {
			itemIndex,
			item
		}));

		reactions.push(this.buildReaction(ReactionCollectorDeposeItemCloseReaction, {}));

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorDeposeItemData, {}),
			mainPacket: true
		};
	}
}
