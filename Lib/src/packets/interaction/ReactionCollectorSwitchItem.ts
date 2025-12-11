import {
	ReactionCollector, ReactionCollectorCreationPacket, ReactionCollectorData, ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import {
	MainItemDisplayPacket, SupportItemDisplayPacket
} from "../commands/CommandInventoryPacket";

export class ReactionCollectorSwitchItemData extends ReactionCollectorData {
}

export class ReactionCollectorSwitchItemReaction extends ReactionCollectorReaction {
	itemIndex!: number;

	item!: MainItemDisplayPacket | SupportItemDisplayPacket;
}

export class ReactionCollectorSwitchItemCloseReaction extends ReactionCollectorReaction {
}

type SwitchItemReaction = ReactionCollectorSwitchItemReaction | ReactionCollectorSwitchItemCloseReaction;
export type ReactionCollectorSwitchItemPacket = ReactionCollectorCreationPacket<
	ReactionCollectorSwitchItemData,
	SwitchItemReaction
>;

export class ReactionCollectorSwitchItem extends ReactionCollector {
	private readonly itemList: (MainItemDisplayPacket | SupportItemDisplayPacket)[];

	constructor(itemList: (MainItemDisplayPacket | SupportItemDisplayPacket)[]) {
		super();
		this.itemList = itemList;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorSwitchItemPacket {
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
