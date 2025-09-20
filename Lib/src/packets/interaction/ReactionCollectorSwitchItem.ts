import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

export class ReactionCollectorSwitchItemData extends ReactionCollectorData {
}

export class ReactionCollectorSwitchItemReaction extends ReactionCollectorReaction {
	itemIndex!: number;

	item!: ItemWithDetails;
}

export class ReactionCollectorSwitchItemCloseReaction extends ReactionCollectorReaction {
}

export class ReactionCollectorSwitchItem extends ReactionCollector {
	private readonly itemList: ItemWithDetails[];

	constructor(itemList: ItemWithDetails[]) {
		super();
		this.itemList = itemList;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		const reactions: {
			type: string;
			data: ReactionCollectorReaction;
		}[] = this.itemList.map((item, itemIndex) => this.buildReaction(ReactionCollectorSwitchItemReaction, {
			itemIndex,
			item
		}));

		reactions.push(this.buildReaction(ReactionCollectorSwitchItemCloseReaction, {}));

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorSwitchItemData, {}),
			mainPacket: true
		};
	}
}
