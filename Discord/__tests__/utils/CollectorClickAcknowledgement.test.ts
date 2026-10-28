import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {},
	shardId: 0
}));
vi.mock("../../src/bot/DiscordCache", () => ({
	DiscordCache: {
		getInteraction: vi.fn(() => ({
			userLanguage: "fr",
			user: {
				displayName: "Tester",
				displayAvatarURL: (): string => "https://avatar"
			},
			followUp: vi.fn()
		})),
		cacheButtonInteraction: vi.fn(),
		cacheStringSelectMenuInteraction: vi.fn()
	}
}));
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));
vi.mock("../../src/utils/ErrorUtils", () => ({
	sendInteractionNotForYou: vi.fn(),
	SendManner: {}
}));
vi.mock("../../src/bot/DiscordMQTT", () => ({
	DiscordMQTT: {}
}));
vi.mock("../../src/translations/i18n", () => ({
	default: { t: (key: string): string => key }
}));
vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: { warn: vi.fn() }
}));

import {
	ButtonInteraction, DiscordAPIError, Message, MessageComponentInteraction, RESTJSONErrorCodes
} from "discord.js";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { createConfirmationCollector } from "../../src/utils/ReportConfirmationCollector";
import { PacketUtils } from "../../src/utils/PacketUtils";
import { DiscordCache } from "../../src/bot/DiscordCache";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";

type CollectHandler = (interaction: unknown) => Promise<void>;

const PLAYER_ID = "player-discord-id";

const context = {
	keycloakId: "player-keycloak-id",
	discord: {
		interaction: "command-interaction-id",
		user: PLAYER_ID,
		channel: "channel-id",
		language: "fr"
	}
} as PacketContext;

const packet = {
	id: "collector-id",
	endTime: Date.now() + 60_000,
	reactions: [],
	data: { data: {} }
} as unknown as ReactionCollectorCreationPacket;

function unknownInteractionError(): DiscordAPIError {
	return new DiscordAPIError(
		{
			message: "Unknown interaction",
			code: RESTJSONErrorCodes.UnknownInteraction
		},
		RESTJSONErrorCodes.UnknownInteraction,
		404,
		"POST",
		"https://discord.com/api/v10/interactions/id/token/callback",
		{}
	);
}

function buttonClick(customId: string, acknowledgement: () => Promise<unknown>, calls: string[] = []): ButtonInteraction {
	return {
		id: `${customId}-click-id`,
		customId,
		user: { id: PLAYER_ID },
		createdTimestamp: Date.now() - 4000,
		isButton: (): boolean => true,
		isStringSelectMenu: (): boolean => false,
		deferReply: vi.fn(() => {
			calls.push("deferReply");
			return acknowledgement();
		})
	} as unknown as ButtonInteraction;
}

function sentDiscordContext(): PacketContext["discord"] {
	const [sentContext] = vi.mocked(PacketUtils.sendPacketToBackend).mock.calls[0];
	return sentContext.discord;
}

async function openConfirmation(calls: string[]): Promise<CollectHandler> {
	let collectHandler: CollectHandler | undefined;
	const collector = {
		on: vi.fn((event: string, handler: CollectHandler) => {
			if (event === "collect") {
				collectHandler = handler;
			}
			return collector;
		})
	};
	const message = {
		id: "confirmation-message-id",
		edit: vi.fn(() => {
			calls.push("edit");
			return Promise.resolve();
		}),
		createMessageComponentCollector: vi.fn(() => collector)
	};
	vi.mocked(DiscordCache.getInteraction).mockReturnValueOnce({
		userLanguage: "fr",
		user: {
			displayName: "Tester",
			displayAvatarURL: (): string => "https://avatar"
		},
		followUp: vi.fn().mockResolvedValue(message)
	} as never);

	await createConfirmationCollector(context, packet, {
		titleKey: "commands:report.useTokensConfirmTitle",
		descriptionKey: "commands:report.useTokensConfirmDescription",
		descriptionParams: {}
	});
	return collectHandler!;
}

describe("collector click acknowledgement (#5059)", () => {
	beforeEach(() => {
		vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
		vi.mocked(DiscordCache.cacheButtonInteraction).mockClear();
	});

	it("forwards the confirmation click to Core even when Discord rejects its acknowledgement", async () => {
		const collect = await openConfirmation([]);

		await expect(collect(buttonClick("accept", () => Promise.reject(unknownInteractionError())))).resolves.toBeUndefined();

		expect(PacketUtils.sendPacketToBackend).toHaveBeenCalledOnce();
		const [, reactPacket] = vi.mocked(PacketUtils.sendPacketToBackend).mock.calls[0];
		expect(reactPacket).toMatchObject({
			id: "collector-id",
			reactionIndex: 0
		});
	});

	it("acknowledges the click before disabling the buttons, so the edit cannot consume the acknowledgement window", async () => {
		const calls: string[] = [];
		const collect = await openConfirmation(calls);

		await collect(buttonClick("refuse", () => Promise.resolve(), calls));

		expect(calls).toEqual(["deferReply", "edit"]);
		const [, reactPacket] = vi.mocked(PacketUtils.sendPacketToBackend).mock.calls[0];
		expect(reactPacket).toMatchObject({ reactionIndex: 1 });
	});

	it("answers Core's response through the command interaction when the click expired", async () => {
		const click = buttonClick("accept", () => Promise.reject(unknownInteractionError()));

		expect(await DiscordCollectorUtils.acknowledgeComponent(click, click.deferReply())).toBe(false);
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, click, 0);

		expect(DiscordCache.cacheButtonInteraction).not.toHaveBeenCalled();
		expect(sentDiscordContext()).toMatchObject({
			interaction: "command-interaction-id",
			buttonInteraction: undefined
		});
	});

	it("keeps answering Core's response through the click when it was acknowledged", async () => {
		const click = buttonClick("accept", () => Promise.resolve());

		expect(await DiscordCollectorUtils.acknowledgeComponent(click, click.deferReply())).toBe(true);
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, click, 0);

		expect(DiscordCache.cacheButtonInteraction).toHaveBeenCalledWith(click);
		expect(sentDiscordContext()).toMatchObject({ buttonInteraction: click.id });
	});

	it("displays the new view through a message edit when the update of an expired click is rejected", async () => {
		const message = { edit: vi.fn().mockResolvedValue(undefined) };
		const click = {
			customId: "shop-buy",
			createdTimestamp: Date.now() - 4000,
			update: vi.fn().mockRejectedValue(unknownInteractionError()),
			message
		} as unknown as MessageComponentInteraction;

		expect(await DiscordCollectorUtils.updateComponentMessage(click, { components: [] })).toBe(false);
		expect(message.edit).toHaveBeenCalledWith({ components: [] });
	});

	it("does not let a failed cosmetic edit interrupt the click", async () => {
		const message = {
			id: "message-id",
			edit: vi.fn().mockRejectedValue(new Error("Missing Access"))
		} as unknown as Message;

		await expect(DiscordCollectorUtils.editWithoutBlocking(message, { components: [] })).resolves.toBeUndefined();
	});
});
