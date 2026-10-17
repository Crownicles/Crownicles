import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { EventEmitter } from "node:events";

vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		isInitialized: vi.fn(() => true)
	}
}));

vi.mock("../../../Discord/src/translations/i18n", () => ({
	// The command module builds its slash command at import time, which requires valid names
	default: { t: vi.fn((key: string) => key.startsWith("discordBuilder:") ? "pettransfer" : key) }
}));

vi.mock("../../../Discord/src/utils/DisplayUtils", () => ({
	DisplayUtils: new Proxy({}, {
		get: (): (() => string) => (): string => "pet"
	})
}));

vi.mock("../../../Discord/src/bot/DiscordCache", () => ({
	DiscordCache: { getInteraction: vi.fn() }
}));

vi.mock("../../../Discord/src/utils/ErrorUtils", () => ({
	sendInteractionNotForYou: vi.fn()
}));

vi.mock("../../../Discord/src/utils/DiscordCollectorUtils", () => ({
	DiscordCollectorUtils: { sendReaction: vi.fn() },
	disableRows: vi.fn()
}));

import { handlePetTransferReactionCollector } from "../../src/commands/pet/PetTransferCommand";
import { DiscordCache } from "../../src/bot/DiscordCache";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import {
	ReactionCollectorPetTransfer,
	ReactionCollectorPetTransferDepositReaction,
	ReactionCollectorPetTransferPacket,
	ReactionCollectorPetTransferSwitchReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorPetTransfer";
import { ReactionCollectorRefuseReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { OwnedPet } from "../../../Lib/src/types/OwnedPet";

const USER_ID = "user-id";
const SHELTER_PET_ENTITY_ID = 5;
const SWITCH_REACTION_INDEX = 1;
const COLLECTOR_DURATION_MS = 60_000;

const pet: OwnedPet = {
	nickname: "Rex", typeId: 1, sex: "m", rarity: 1, loveLevel: 1, force: 1, feedDelay: 0
};

function createPacket(): ReactionCollectorPetTransferPacket {
	return new ReactionCollectorPetTransfer(
		pet,
		[{
			petEntityId: SHELTER_PET_ENTITY_ID, pet
		}],
		[
			makePacket(ReactionCollectorPetTransferDepositReaction, {}),
			makePacket(ReactionCollectorPetTransferSwitchReaction, { petEntityId: SHELTER_PET_ENTITY_ID }),
			makePacket(ReactionCollectorRefuseReaction, {})
		]
	).creationPacket("collector-id", Date.now() + COLLECTOR_DURATION_MS);
}

function createComponentInteraction(customId: string, values?: string[]): Record<string, unknown> {
	return {
		customId,
		values,
		user: { id: USER_ID },
		isStringSelectMenu: (): boolean => values !== undefined,
		update: vi.fn().mockResolvedValue(undefined),
		deferReply: vi.fn().mockResolvedValue(undefined),
		deferUpdate: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined)
	};
}

async function collect(collector: EventEmitter, interaction: Record<string, unknown>): Promise<void> {
	collector.emit("collect", interaction);
	await new Promise(resolve => setImmediate(resolve));
}

describe("PetTransferCommand collector", () => {
	let collector: EventEmitter;

	beforeEach(async () => {
		vi.mocked(DiscordCollectorUtils.sendReaction).mockClear();
		collector = new EventEmitter();
		const message = {
			createMessageComponentCollector: (): EventEmitter => collector,
			edit: vi.fn()
		};
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			userLanguage: "fr",
			user: {
				id: USER_ID, displayName: "Player", displayAvatarURL: (): string => "https://example.com/avatar.png"
			},
			editReply: vi.fn().mockResolvedValue(message)
		} as never);

		const context = {
			keycloakId: "keycloak-id",
			discord: {
				interaction: "interaction-id", user: USER_ID
			}
		} as PacketContext;
		await handlePetTransferReactionCollector(context, createPacket());
	});

	it("opens the switch menu again when a stale main menu button is clicked twice", async () => {
		const firstClick = createComponentInteraction("switch");
		const secondClick = createComponentInteraction("switch");

		await collect(collector, firstClick);
		await collect(collector, secondClick);

		expect(firstClick.update).toHaveBeenCalledOnce();
		expect(secondClick.update).toHaveBeenCalledOnce();
		expect(DiscordCollectorUtils.sendReaction).not.toHaveBeenCalled();
	});

	it("sends the selected shelter pet reaction from the switch menu", async () => {
		const selection = createComponentInteraction("switchSelect", [SWITCH_REACTION_INDEX.toString()]);

		await collect(collector, createComponentInteraction("switch"));
		await collect(collector, selection);

		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			"keycloak-id",
			selection,
			SWITCH_REACTION_INDEX
		);
		expect(selection.editReply).toHaveBeenCalledOnce();
	});
});
