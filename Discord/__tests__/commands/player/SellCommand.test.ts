import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {},
	shardId: 0
}));

vi.mock("../../../src/bot/DiscordCache");

vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: {
		sendPacketToBackend: vi.fn()
	}
}));

import { ReactionCollector } from "discord.js";
import { DiscordCache } from "../../../src/bot/DiscordCache";
import { handleSellReactionCollector } from "../../../src/commands/player/SellCommand";
import {
	ReactionCollectorSellItemReaction, ReactionCollectorSellPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSell";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	deferredReply, fakeCollectorMessage, wait
} from "../../bot/fakeCollectorMessage";

const DEADLINE_MS = 100;

const USER_ID = "user";

const context = {
	discord: {
		interaction: "sell-interaction",
		language: "fr",
		user: USER_ID
	},
	keycloakId: "keycloak"
} as PacketContext;

const user = {
	id: USER_ID,
	displayName: "Tester",
	displayAvatarURL: (): string => "https://example.com/avatar.png"
};

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
	beforeEach(() => {
		vi.mocked(DiscordCache.getInteraction).mockReset();
	});

	it("ends the confirmation of a single sellable item at Core's deadline even when Core's stop packet is lost", async () => {
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			userLanguage: "fr",
			user,
			editReply: (): Promise<unknown> => Promise.resolve(fakeCollectorMessage())
		} as never);

		const collectors = await handleSellReactionCollector(context, sellPacket(1));
		expect(collectors).toHaveLength(1);
		expect(collectors![0].ended).toBe(false);

		await wait(DEADLINE_MS * 2);

		expect(collectors![0].ended).toBe(true);
	});

	it("does not keep the confirmation of a single sellable item open past Core's deadline when Discord replies late", async () => {
		const reply = deferredReply();
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			userLanguage: "fr",
			user,
			editReply: reply.editReply
		} as never);

		const pendingCollectors = handleSellReactionCollector(context, sellPacket(1));
		await wait(DEADLINE_MS * 1.5);
		reply.resolve();
		const collectors = await pendingCollectors;

		await wait(DEADLINE_MS / 5);

		expect(collectors![0].ended).toBe(true);
	});

	it("stops the confirmation displayed after the selection of an item already ended", async () => {
		const selectionCollectors: ReactionCollector[] = [];
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			userLanguage: "fr",
			user,
			editReply: (): Promise<unknown> => Promise.resolve(fakeCollectorMessage(selectionCollectors))
		} as never);
		const [selectCollector] = (await handleSellReactionCollector(context, sellPacket(2)))!;

		const confirmationCollectors: ReactionCollector[] = [];
		const confirmationReply = deferredReply(confirmationCollectors);
		const selectInteraction = {
			user,
			values: ["0"],
			deferReply: (): Promise<void> => Promise.resolve(),
			editReply: confirmationReply.editReply
		};
		selectCollector.emit("collect", selectInteraction, user);
		await wait(0);

		selectCollector.stop();
		await wait(0);
		confirmationReply.resolve();
		await wait(0);

		expect(confirmationCollectors).toHaveLength(1);
		expect(confirmationCollectors[0].ended).toBe(true);
	});
});
