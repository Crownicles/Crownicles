import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {},
	shardId: 0
}));

vi.mock("../../../src/bot/DiscordCache");

vi.mock("../../../src/utils/DisplayUtils", () => ({
	DisplayUtils: {
		getSimpleItemDisplay: (): string => "item"
	}
}));

import { DiscordCache } from "../../../src/bot/DiscordCache";
import { handleSellReactionCollector } from "../../../src/commands/player/SellCommand";
import {
	ReactionCollectorSellItemReaction, ReactionCollectorSellPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSell";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	fakeCollectorMessage, wait
} from "../../bot/fakeCollectorMessage";

const DEADLINE_MS = 100;

const context = {
	discord: {
		interaction: "sell-interaction",
		language: "fr",
		user: "user"
	},
	keycloakId: "keycloak"
} as PacketContext;

function sellPacket(itemsCount: number): ReactionCollectorSellPacket {
	const itemReactions = Array.from({ length: itemsCount }, (_, slot) => ({
		type: ReactionCollectorSellItemReaction.name,
		data: {
			item: {
				id: 1, category: ItemCategory.OBJECT
			},
			slot,
			price: 10
		}
	}));
	return {
		id: "sell-collector",
		endTime: Date.now() + DEADLINE_MS,
		reactions: [
			...itemReactions,
			{
				type: ReactionCollectorRefuseReaction.name,
				data: {}
			}
		],
		data: {
			type: "ReactionCollectorSellData",
			data: {}
		}
	} as ReactionCollectorSellPacket;
}

describe("handleSellReactionCollector", () => {
	it("ends the confirmation of a single sellable item at Core's deadline even when Core's stop packet is lost", async () => {
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			userLanguage: "fr",
			user: {
				displayName: "Tester",
				displayAvatarURL: (): string => "https://example.com/avatar.png"
			},
			editReply: (): Promise<unknown> => Promise.resolve(fakeCollectorMessage())
		} as never);

		const collectors = await handleSellReactionCollector(context, sellPacket(1));
		expect(collectors).toHaveLength(1);
		expect(collectors![0].ended).toBe(false);

		await wait(DEADLINE_MS * 2);

		expect(collectors![0].ended).toBe(true);
	});
});
