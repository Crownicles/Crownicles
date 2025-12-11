import {
	ReactionCollector, ReactionCollectorCreationPacket, ReactionCollectorData, ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import {
	MainItemDisplayPacket, SupportItemDisplayPacket
} from "../commands/CommandInventoryPacket";

export class ReactionCollectorDeposeItemData extends ReactionCollectorData {
}

export class ReactionCollectorDeposeItemReaction extends ReactionCollectorReaction {
	itemIndex!: number;

	item!: MainItemDisplayPacket | SupportItemDisplayPacket;
}

export class ReactionCollectorDeposeItemCloseReaction extends ReactionCollectorReaction {
}

type DeposeItemReaction =
	| ReactionCollectorDeposeItemReaction
	| ReactionCollectorDeposeItemCloseReaction;

export type ReactionCollectorDeposeItemPacket = ReactionCollectorCreationPacket<
	ReactionCollectorDeposeItemData,
	DeposeItemReaction
>;

export class ReactionCollectorDeposeItem extends ReactionCollector {
	private readonly itemList: (MainItemDisplayPacket | SupportItemDisplayPacket)[];

	constructor(itemList: (MainItemDisplayPacket | SupportItemDisplayPacket)[]) {
		super();
		this.itemList = itemList;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorDeposeItemPacket {
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
