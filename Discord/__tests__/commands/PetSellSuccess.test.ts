import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: { warn: vi.fn() }
}));

vi.mock("../../src/translations/i18n", () => ({
	// The command module builds its slash command at import time, which requires valid names
	default: {
		t: vi.fn((key: string, params?: { pseudo?: string }) => {
			if (key.startsWith("discordBuilder:")) {
				return "petsell";
			}
			return params?.pseudo ? `${key} ${params.pseudo}` : key;
		})
	}
}));

vi.mock("../../src/utils/DisplayUtils", () => ({
	DisplayUtils: new Proxy({}, {
		get: (): (() => string) => (): string => "pet"
	})
}));

vi.mock("../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {},
	shardId: 0
}));

vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import { ButtonInteraction } from "discord.js";
import { DiscordCache } from "../../src/bot/DiscordCache";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { PacketUtils } from "../../src/utils/PacketUtils";
import { handlePetSellSuccess } from "../../src/commands/pet/PetSellCommand";
import { CrowniclesInteraction } from "../../src/messages/CrowniclesInteraction";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CommandPetSellSuccessPacket } from "../../../Lib/src/packets/commands/CommandPetSellPacket";

function discordUser(name: string): object {
	return {
		id: `${name}-discord-id`,
		displayName: name,
		displayAvatarURL: (): string => `https://avatar/${name}`
	};
}

const seller = discordUser("Seller");
const buyer = discordUser("Buyer");

const sellerContext = {
	keycloakId: "seller-keycloak-id",
	discord: {
		interaction: "pet-sell-command-id",
		user: "Seller-discord-id",
		channel: "channel-id",
		language: "fr"
	}
} as PacketContext;

const collectorPacket = {
	id: "pet-sell-collector",
	endTime: Date.now() + 60_000,
	reactions: [],
	data: { data: {} }
} as unknown as ReactionCollectorCreationPacket;

function buyerClick(): ButtonInteraction {
	return {
		id: "buyer-click-id",
		customId: "accept",
		user: buyer,
		createdTimestamp: Date.now() - 4000,
		deferred: false,
		replied: false,
		isButton: (): boolean => true,
		isStringSelectMenu: (): boolean => false
	} as unknown as ButtonInteraction;
}

describe("response to a pet sale whose click expired (#5059)", () => {
	beforeEach(() => {
		vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
	});

	it("is displayed as a follow-up of the command, credited to the buyer rather than the seller", async () => {
		const command = {
			id: sellerContext.discord!.interaction,
			userLanguage: "fr",
			user: seller,
			followUp: vi.fn().mockResolvedValue(undefined)
		};
		DiscordCache.cacheInteraction(command as unknown as CrowniclesInteraction);

		const click = buyerClick();
		await DiscordCollectorUtils.acknowledgeComponent(click, Promise.reject(new Error("Unknown interaction")));
		DiscordCollectorUtils.sendReaction(collectorPacket, sellerContext, "buyer-keycloak-id", click, 0);
		const [responseContext] = vi.mocked(PacketUtils.sendPacketToBackend).mock.calls[0];

		await handlePetSellSuccess(responseContext, {
			pet: {},
			treasuryEarned: 0,
			guildName: "guild"
		} as unknown as CommandPetSellSuccessPacket);

		expect(command.followUp).toHaveBeenCalledOnce();
		const [{ embeds: [embed] }] = command.followUp.mock.calls[0];
		expect(embed.data.author).toEqual({
			name: "commands:petSell.successTitle Buyer",
			icon_url: "https://avatar/Buyer"
		});
	});
});
