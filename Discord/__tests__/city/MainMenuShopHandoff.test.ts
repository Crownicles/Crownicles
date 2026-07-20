import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { Message, MessageComponentInteraction } from "discord.js";

vi.mock("../../src/utils/DiscordCollectorUtils", () => ({
	DiscordCollectorUtils: {
		sendReaction: vi.fn()
	},
	disableRows: vi.fn()
}));

import { LANGUAGE } from "../../../Lib/src/Language";
import { CITY_SERVICES } from "../../../Lib/src/constants/CityServiceConstants";
import {
	ReactionCollectorCityData,
	ReactionCollectorCityShopReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { getMainMenu } from "../../src/commands/player/report/cityMenu/MainMenu";
import { ReportCityMenuIds } from "../../src/commands/player/report/ReportCityMenuConstants";
import { CityMenuParams } from "../../src/commands/player/report/ReportCityMenuTypes";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenus
} from "../../src/messages/CrowniclesNestedMenus";

function createPacket(): ReactionCollectorCreationPacket {
	return {
		id: "city-collector-id",
		reactions: [{
			type: ReactionCollectorCityShopReaction.name,
			data: { shopId: "generalShop" }
		}],
		data: {
			data: {
				mapLocationId: 1,
				mapTypeId: 0,
				availableServices: [],
				home: {},
				apartmentNotary: { ownedApartments: [] },
				shops: [{
					shopId: "generalShop",
					isEmpty: false
				}]
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

describe("city shop message handoff", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("hands the city message off after sending the shop reaction", async () => {
		const packet = createPacket();
		const menu = getMainMenu(createMenuParams(packet));
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
		const nestedMenus = { beginMessageHandoff: vi.fn().mockReturnValue(true) };
		menu.createCollector!(nestedMenus as never, message);
		const buttonInteraction = {
			customId: `${ReportCityMenuIds.CITY_SHOP_PREFIX}generalShop`,
			user: { id: "discord-user-id" },
			deferUpdate: vi.fn().mockResolvedValue(undefined)
		} as unknown as MessageComponentInteraction;

		await collectHandler!(buttonInteraction);

		expect(buttonInteraction.deferUpdate).toHaveBeenCalledOnce();
		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledWith(
			packet,
			expect.objectContaining({ keycloakId: "keycloak-id" }),
			"keycloak-id",
			buttonInteraction,
			0
		);
		expect(nestedMenus.beginMessageHandoff).toHaveBeenCalledOnce();
	});

	it("does not edit the city message when its collector stops after the handoff", async () => {
		const collector = { stop: vi.fn() };
		const message = {
			edit: vi.fn(),
			createMessageComponentCollector: vi.fn(() => collector)
		} as unknown as Message;
		const menu = {
			containers: [],
			createCollector: vi.fn(() => collector)
		} as CrowniclesNestedMenu;
		const nestedMenus = new CrowniclesNestedMenus(menu, new Map());
		await nestedMenus.send({ editReply: vi.fn().mockResolvedValue(message) } as never);

		expect(nestedMenus.beginMessageHandoff()).toBe(true);
		expect(collector.stop).not.toHaveBeenCalled();
		nestedMenus.confirmMessageHandoff();
		await nestedMenus.stopCurrentCollector();

		expect(collector.stop).toHaveBeenCalledOnce();
		expect(message.edit).not.toHaveBeenCalled();
	});

	it("disables the city message when an unconfirmed handoff expires", async () => {
		const collector = { stop: vi.fn() };
		const message = {
			edit: vi.fn().mockResolvedValue(undefined),
			createMessageComponentCollector: vi.fn(() => collector)
		} as unknown as Message;
		const menu = {
			containers: [],
			createCollector: vi.fn(() => collector)
		} as CrowniclesNestedMenu;
		const nestedMenus = new CrowniclesNestedMenus(menu, new Map());
		await nestedMenus.send({ editReply: vi.fn().mockResolvedValue(message) } as never);

		expect(nestedMenus.beginMessageHandoff()).toBe(true);
		await nestedMenus.stopCurrentCollector();

		expect(message.edit).toHaveBeenCalledOnce();
	});
});

describe("city services", () => {
	it("renders services from availableServices instead of their payload", () => {
		const packet = createPacket();
		const data = packet.data.data as ReactionCollectorCityData;
		data.availableServices = [CITY_SERVICES.BOSS_ARCHIVIST];
		data.blacksmith = {
			upgradeableItems: [],
			disenchantableItems: [],
			playerMoney: 0
		};

		const menu = getMainMenu(createMenuParams(packet));
		const customIds = menu.containers!.flatMap(container => container.components.flatMap(component =>
			"accessory" in component && component.accessory && "data" in component.accessory
				? [component.accessory.data.custom_id]
				: []));

		expect(customIds).toContain(ReportCityMenuIds.BOSS_ARCHIVIST_MENU);
		expect(customIds).not.toContain(ReportCityMenuIds.BLACKSMITH_MENU);
	});
});
