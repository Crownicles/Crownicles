import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", () => ({
	crowniclesClient: {}
}));
vi.mock("../../src/bot/DiscordCache", () => ({
	DiscordCache: {
		getInteraction: vi.fn(() => ({
			userLanguage: "fr",
			user: { displayAvatarURL: (): string => "https://avatar" }
		}))
	}
}));
vi.mock("../../src/translations/i18n", () => ({
	default: { t: (key: string): string => key }
}));
vi.mock("../../src/utils/DisplayUtils", () => ({
	DisplayUtils: { getEscapedUsername: vi.fn().mockResolvedValue("Tester") }
}));
vi.mock("../../src/utils/DiscordCollectorUtils", () => ({
	DiscordCollectorUtils: { sendReaction: vi.fn() },
	disableRows: vi.fn()
}));
vi.mock("../../src/utils/ErrorUtils", () => ({
	sendInteractionNotForYou: vi.fn()
}));
vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: { warn: vi.fn() }
}));

import { Message } from "discord.js";
import { CrowniclesActionChooseCachedMessage } from "../../src/messages/CrowniclesActionChooseCachedMessage";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { ReactionCollectorFightChooseActionPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";

type CollectHandler = (interaction: unknown) => Promise<void>;

const PLAYER_ID = "player-discord-id";

const context = {
	keycloakId: "player-keycloak-id",
	discord: {
		interaction: "interaction-id",
		user: PLAYER_ID,
		channel: "channel-id",
		language: "fr"
	}
} as PacketContext;

const packet = {
	id: "collector-id",
	endTime: Date.now() + 60_000,
	data: { data: { fighterKeycloakId: "player-keycloak-id" } },
	reactions: [
		{
			type: "fightAction",
			data: { id: "simpleAttack" }
		},
		{
			type: "fightAction",
			data: { id: "quickAttack" }
		}
	]
} as unknown as ReactionCollectorFightChooseActionPacket;

async function openActionChoice(): Promise<CollectHandler> {
	let collectHandler: CollectHandler | undefined;
	const collector = {
		on: vi.fn((event: string, handler: CollectHandler) => {
			if (event === "collect") {
				collectHandler = handler;
			}
			return collector;
		})
	};
	const cachedMessage = new CrowniclesActionChooseCachedMessage("interaction-id");
	vi.spyOn(cachedMessage, "post").mockResolvedValue({
		createMessageComponentCollector: vi.fn(() => collector)
	} as unknown as Message);

	await cachedMessage.update(packet, context);
	return collectHandler!;
}

function click(customId: string, update: () => Promise<void>): {
	customId: string; update: () => Promise<void>; deferUpdate: ReturnType<typeof vi.fn>;
} {
	return {
		customId,
		user: { id: PLAYER_ID },
		createdTimestamp: Date.now() - 4000,
		update,
		deferUpdate: vi.fn().mockResolvedValue(undefined)
	} as never;
}

describe("CrowniclesActionChooseCachedMessage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends the chosen action even when the click can no longer be acknowledged (#4877)", async () => {
		const collect = await openActionChoice();

		await collect(click("quickAttack", vi.fn().mockRejectedValue(new Error("Unknown interaction"))));

		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledOnce();
		expect(vi.mocked(DiscordCollectorUtils.sendReaction).mock.calls[0][4]).toBe(1);
	});

	it("only sends the first action when several clicks are queued", async () => {
		const collect = await openActionChoice();
		const secondClick = click("simpleAttack", vi.fn().mockResolvedValue(undefined));

		await collect(click("quickAttack", vi.fn().mockResolvedValue(undefined)));
		await collect(secondClick);

		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledOnce();
		expect(vi.mocked(DiscordCollectorUtils.sendReaction).mock.calls[0][4]).toBe(1);
		expect(secondClick.deferUpdate).toHaveBeenCalledOnce();
	});
});
