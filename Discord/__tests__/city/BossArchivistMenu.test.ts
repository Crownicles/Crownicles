import {
	describe, expect, it, vi
} from "vitest";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { LANGUAGE } from "../../../Lib/src/Language";
import { ReactionCollectorCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CommandReportBossPersonalRecordsRes } from "../../../Lib/src/packets/commands/CommandReportPacket";
import { getBossArchivistMenus } from "../../src/commands/player/report/cityMenu/BossArchivistMenu";
import { ReportCityMenuIds } from "../../src/commands/player/report/ReportCityMenuConstants";
import { CityMenuParams } from "../../src/commands/player/report/ReportCityMenuTypes";
import { DiscordMQTT } from "../../src/bot/DiscordMQTT";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { ButtonStyle } from "discord.js";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";

vi.mock("../../src/bot/DiscordMQTT", () => ({
	DiscordMQTT: {
		asyncPacketSender: { sendPacketAndHandleResponse: vi.fn() }
	}
}));

vi.mock("../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {}
}));

vi.mock("../../../Lib/src/keycloak/KeycloakUtils", () => ({
	KeycloakUtils: { getUsersFromIds: vi.fn() }
}));

function createParams(): CityMenuParams {
	return {
		context: {
			keycloakId: "player-id",
			packetId: "city-packet-id",
			discord: { interaction: "interaction-id" }
		} as never,
		interaction: {
			user: { id: "discord-id" },
			userLanguage: LANGUAGE.FRENCH
		} as never,
		packet: {
			data: {
				data: { bossArchivist: true } as ReactionCollectorCityData
			}
		} as ReactionCollectorCreationPacket,
		collectorTime: 60_000,
		pseudo: "Archiviste"
	};
}

function getCustomIds(menu: ReturnType<typeof getBossArchivistMenus> extends Map<string, infer Menu> ? Menu : never): string[] {
	if (!("containers" in menu)) {
		return [];
	}
	return menu.containers.flatMap(container => container.components.flatMap(component => {
		const sectionButton = "accessory" in component && component.accessory && "data" in component.accessory
			? component.accessory.data.custom_id
			: undefined;
		const rowButtons = "components" in component
			? component.components.map(child => "data" in child ? child.data.custom_id : undefined)
			: [];
		return [sectionButton, ...rowButtons].filter((customId): customId is string => typeof customId === "string");
	}));
}

function getClassSections(menu: ReturnType<typeof getBossArchivistMenus> extends Map<string, infer Menu> ? Menu : never): {
	customId: string;
	style: number;
	content: string;
}[] {
	if (!("containers" in menu)) {
		return [];
	}
	return menu.containers.flatMap(container => container.components.flatMap(component => {
		if (!("accessory" in component) || !component.accessory || !("data" in component.accessory)) {
			return [];
		}
		const customId = component.accessory.data.custom_id;
		if (!customId?.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX)) {
			return [];
		}
		const content = "components" in component && component.components[0] && "data" in component.components[0]
			? component.components[0].data.content
			: undefined;
		return typeof content === "string" && typeof component.accessory.data.style === "number"
			? [{
				customId, style: component.accessory.data.style, content
			}]
			: [];
	}));
}

function getTextContents(menu: ReturnType<typeof getBossArchivistMenus> extends Map<string, infer Menu> ? Menu : never): string[] {
	if (!("containers" in menu)) {
		return [];
	}
	return menu.containers.flatMap(container => container.components.flatMap(component => {
		if ("data" in component && typeof component.data.content === "string") {
			return [component.data.content];
		}
		if ("components" in component) {
			return component.components.flatMap(child => "data" in child && typeof child.data.content === "string"
				? [child.data.content]
				: []);
		}
		return [];
	}));
}

async function collectMenuAction(
	menu: ReturnType<typeof getBossArchivistMenus> extends Map<string, infer Menu> ? Menu : never,
	customId: string,
	menus: ReturnType<typeof getBossArchivistMenus>
): Promise<void> {
	let collect: ((interaction: unknown) => Promise<void>) | undefined;
	menu.createCollector!({
		registerMenu: vi.fn((id, registeredMenu) => menus.set(id, registeredMenu)),
		changeMenu: vi.fn(),
		changeToMainMenu: vi.fn()
	} as never, {
		createMessageComponentCollector: vi.fn(() => ({
			on: vi.fn((_event, handler) => {
				collect = handler;
			})
		}))
	} as never);
	await collect!({
		customId,
		user: { id: "discord-id" },
		deferUpdate: vi.fn()
	});
}

describe("BossArchivistMenu", () => {
	it("lists every final boss in the personal records menu", () => {
		const menu = getBossArchivistMenus(createParams()).get(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU)!;
		const customIds = getCustomIds(menu);

		for (const bossId of Object.values(FightConstants.FINAL_BOSS_MONSTER_IDS)) {
			expect(customIds).toContain(`${ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX}${bossId}`);
		}
	});

	it("uses only the maximum-tier class ids supplied by Core", async () => {
		const params = createParams();
		const menus = getBossArchivistMenus(params);
		vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse).mockImplementation(
			async (requestContext, _packet, callback) => {
				expect(requestContext).not.toBe(params.context);
				expect(requestContext.packetId).toBeUndefined();
				expect(requestContext.discord).not.toBe(params.context.discord);
				await callback({} as never, CommandReportBossPersonalRecordsRes.name, {
					personalRecords: [],
					maximumTierClassIds: [18, 19, 20, 21, 22, 23, 24]
				} as CommandReportBossPersonalRecordsRes);
			}
		);
		await collectMenuAction(
			menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_MENU)!,
			ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU,
			menus
		);
		const bossMenu = menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU)!;
		await collectMenuAction(
			bossMenu,
			`${ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX}${FightConstants.FINAL_BOSS_MONSTER_IDS.MAGMA_TITAN}`,
			menus
		);

		const classMenu = menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU)!;
		const customIds = getCustomIds(classMenu);
		expect(customIds.filter(id => id.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX))).toEqual(
			[18, 19, 20, 21, 22, 23, 24].map(classId => `${ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX}${classId}`)
		);
		const classSections = getClassSections(classMenu);
		expect(classSections).toHaveLength(7);
		for (const section of classSections) {
			const classId = Number(section.customId.slice(ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX.length));
			const classEmoji = CrowniclesIcons.classes[classId];
			expect(section.style).toBe(ButtonStyle.Secondary);
			expect(section.content.match(new RegExp(classEmoji, "gu"))).toHaveLength(1);
		}
	});

	it("ignores a leaderboard whose usernames resolve after navigating back", async () => {
		const params = createParams();
		const menus = getBossArchivistMenus(params);
		let leaderboardCallback: ((context: never, name: string, packet: unknown) => Promise<void>) | undefined;
		vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse)
			.mockImplementationOnce(async (_context, _packet, callback) => {
				await callback({} as never, CommandReportBossPersonalRecordsRes.name, {
					personalRecords: [], maximumTierClassIds: [18]
				} as CommandReportBossPersonalRecordsRes);
			})
			.mockImplementationOnce(async (_context, _packet, callback) => {
				leaderboardCallback = callback as typeof leaderboardCallback;
			});
		let resolveUsers: ((value: unknown) => void) | undefined;
		vi.mocked(KeycloakUtils.getUsersFromIds).mockReturnValue(new Promise(resolve => {
			resolveUsers = resolve;
		}) as never);

		await collectMenuAction(
			menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_MENU)!,
			ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU,
			menus
		);
		await collectMenuAction(
			menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU)!,
			`${ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX}${FightConstants.FINAL_BOSS_MONSTER_IDS.MAGMA_TITAN}`,
			menus
		);
		const classMenu = menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU)!;
		const classSelection = collectMenuAction(
			classMenu,
			`${ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX}18`,
			menus
		);
		await vi.waitFor(() => {
			expect(leaderboardCallback).toBeTypeOf("function");
		});
		const responseHandling = leaderboardCallback!({} as never, "CommandReportBossLeaderboardRes", {
			monsterId: FightConstants.FINAL_BOSS_MONSTER_IDS.MAGMA_TITAN,
			classId: 18,
			entries: [{
				playerKeycloakId: "player-a",
				monsterId: FightConstants.FINAL_BOSS_MONSTER_IDS.MAGMA_TITAN,
				monsterLevel: 100,
				classId: 18,
				turns: 10,
				date: 1_000
			}]
		});
		await collectMenuAction(classMenu, ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, menus);
		resolveUsers!({
			isError: false,
			payload: { users: [{ attributes: { gameUsername: ["Player A"] } }] }
		});
		await Promise.all([classSelection, responseHandling]);

		const currentMenu = menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU)!;
		expect(getCustomIds(currentMenu)).toContain(
			`${ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX}${FightConstants.FINAL_BOSS_MONSTER_IDS.MAGMA_TITAN}`
		);
	});

	it("renders leaderboard entries with the general top badges and compact rows", async () => {
		const params = createParams();
		const menus = getBossArchivistMenus(params);
		const playerIds = ["first", "second", "third", "fourth", "fifth"];
		vi.mocked(KeycloakUtils.getUsersFromIds).mockResolvedValue({
			isError: false,
			status: 200,
			payload: {
				users: playerIds.map(id => ({ attributes: { gameUsername: [id] } }))
			}
		} as never);
		vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse)
			.mockImplementationOnce(async (_context, _packet, callback) => {
				await callback({} as never, CommandReportBossPersonalRecordsRes.name, {
					personalRecords: [], maximumTierClassIds: [18]
				} as CommandReportBossPersonalRecordsRes);
			})
			.mockImplementationOnce(async (_context, _packet, callback) => {
				await callback({} as never, "CommandReportBossLeaderboardRes", {
					monsterId: FightConstants.FINAL_BOSS_MONSTER_IDS.MAGMA_TITAN,
					classId: 18,
					entries: playerIds.map((playerKeycloakId, index) => ({
						playerKeycloakId,
						monsterId: FightConstants.FINAL_BOSS_MONSTER_IDS.MAGMA_TITAN,
						monsterLevel: 150 - index,
						classId: 18,
						turns: 20 + index,
						date: 1_000 + index
					}))
				});
			});

		await collectMenuAction(
			menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_MENU)!,
			ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU,
			menus
		);
		await collectMenuAction(
			menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU)!,
			`${ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX}${FightConstants.FINAL_BOSS_MONSTER_IDS.MAGMA_TITAN}`,
			menus
		);
		await collectMenuAction(
			menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU)!,
			`${ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX}18`,
			menus
		);

		const text = getTextContents(menus.get(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU)!).join("\n");
		expect(text).toContain("**Classe :**");
		expect(text).not.toContain("Classe étudiée");
		expect(text).toContain("🥇 **first** | Niveau **150** | **20** tours");
		expect(text).toContain("🥈 **second** | Niveau **149** | **21** tours");
		expect(text).toContain("🥉 **third** | Niveau **148** | **22** tours");
		expect(text).toContain("🏅 **fourth** | Niveau **147** | **23** tours");
		expect(text).toContain("🏅 **fifth** | Niveau **146** | **24** tours");
	});
});