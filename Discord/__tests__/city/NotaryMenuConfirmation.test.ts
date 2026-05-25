import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { Message, MessageComponentInteraction } from "discord.js";

vi.mock("../../src/utils/DiscordCollectorUtils", () => ({
	DiscordCollectorUtils: {
		sendReaction: vi.fn()
	}
}));

import { LANGUAGE } from "../../../Lib/src/Language";
import {
	ReactionCollectorCityBuyHomeReaction,
	ReactionCollectorCityData
} from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { getManageHomeMenu } from "../../src/commands/player/report/cityMenu/NotaryMenu";
import { ReportCityMenuIds } from "../../src/commands/player/report/ReportCityMenuConstants";
import { CityMenuParams } from "../../src/commands/player/report/ReportCityMenuTypes";
import { CrowniclesNestedMenu } from "../../src/messages/CrowniclesNestedMenus";

type MockCollectorHarness = {
	message: Message;
	collect: (interaction: MessageComponentInteraction) => Promise<void>;
};

type MockButton = {
	interaction: MessageComponentInteraction;
	deferUpdate: ReturnType<typeof vi.fn>;
	deferReply: ReturnType<typeof vi.fn>;
};

type MockNestedMenus = {
	registerMenu: ReturnType<typeof vi.fn>;
	changeMenu: ReturnType<typeof vi.fn>;
	changeToMainMenu: ReturnType<typeof vi.fn>;
};

function createMessageHarness(): MockCollectorHarness {
	let collectHandler: ((interaction: MessageComponentInteraction) => Promise<void>) | undefined;
	const collector = {
		on: vi.fn((event: string, handler: (interaction: MessageComponentInteraction) => Promise<void>) => {
			if (event === "collect") {
				collectHandler = handler;
			}
			return collector;
		})
	};
	const message = {
		createMessageComponentCollector: vi.fn(() => collector)
	} as unknown as Message;
	return {
		message,
		collect: async interaction => {
			if (!collectHandler) {
				throw new Error("Collector was not registered");
			}
			await collectHandler(interaction);
		}
	};
}

function createButton(customId: string): MockButton {
	const deferUpdate = vi.fn().mockResolvedValue(undefined);
	const deferReply = vi.fn().mockResolvedValue(undefined);
	return {
		interaction: {
			customId,
			user: { id: "discord-user-id" },
			deferUpdate,
			deferReply
		} as unknown as MessageComponentInteraction,
		deferUpdate,
		deferReply
	};
}

function createNestedMenus(): MockNestedMenus {
	return {
		registerMenu: vi.fn(),
		changeMenu: vi.fn().mockResolvedValue(undefined),
		changeToMainMenu: vi.fn().mockResolvedValue(undefined)
	};
}

function createPacket(): ReactionCollectorCreationPacket {
	return {
		reactions: [
			{
				type: ReactionCollectorCityBuyHomeReaction.name,
				data: {}
			}
		],
		data: {
			data: {
				home: {
					manage: {
						newPrice: 1200,
						currentMoney: 1500,
						canBuy: true
					}
				},
				apartmentNotary: {
					ownedApartments: []
				}
			} as unknown as ReactionCollectorCityData
		}
	} as unknown as ReactionCollectorCreationPacket;
}

function createMenuParams(packet: ReactionCollectorCreationPacket): CityMenuParams {
	return {
		context: {
			keycloakId: "keycloak-id",
			discord: { interaction: "interaction-id" }
		} as never,
		interaction: {
			user: { id: "discord-user-id" },
			userLanguage: LANGUAGE.FRENCH
		} as never,
		packet,
		collectorTime: 1000,
		pseudo: "Player"
	};
}

describe("notary action confirmations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("opens a confirmation page before sending the buy-home reaction", async () => {
		const packet = createPacket();
		const menu = getManageHomeMenu(createMenuParams(packet));
		const nestedMenus = createNestedMenus();
		const harness = createMessageHarness();
		menu.createCollector!(nestedMenus as never, harness.message);
		const buyButton = createButton(ReportCityMenuIds.BUY_HOME);

		await harness.collect(buyButton.interaction);

		expect(buyButton.deferUpdate).toHaveBeenCalledOnce();
		expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
			ReportCityMenuIds.CITY_CONFIRMATION_MENU,
			expect.objectContaining({ containers: expect.any(Array) })
		);
		expect(nestedMenus.changeMenu).toHaveBeenCalledWith(ReportCityMenuIds.CITY_CONFIRMATION_MENU);
		expect(DiscordCollectorUtils.sendReaction).not.toHaveBeenCalled();
	});

	it("sends the buy-home reaction only after the confirmation button", async () => {
		const packet = createPacket();
		const menu = getManageHomeMenu(createMenuParams(packet));
		const nestedMenus = createNestedMenus();
		const initialHarness = createMessageHarness();
		menu.createCollector!(nestedMenus as never, initialHarness.message);
		await initialHarness.collect(createButton(ReportCityMenuIds.BUY_HOME).interaction);
		const confirmationMenu = nestedMenus.registerMenu.mock.calls[0][1] as CrowniclesNestedMenu;
		const confirmationHarness = createMessageHarness();
		confirmationMenu.createCollector!(nestedMenus as never, confirmationHarness.message);
		const confirmButton = createButton(ReportCityMenuIds.CITY_CONFIRMATION_CONFIRM);

		await confirmationHarness.collect(confirmButton.interaction);

		expect(confirmButton.deferReply).toHaveBeenCalledOnce();
		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledWith(
			packet,
			expect.objectContaining({ keycloakId: "keycloak-id" }),
			"keycloak-id",
			confirmButton.interaction,
			0
		);
	});
});
