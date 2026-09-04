import {
	describe, expect, it, vi
} from "vitest";
import {
	ContainerBuilder, Message
} from "discord.js";
import { LANGUAGE } from "../../../../Lib/src/Language";
import {
	CommandTournamentAdminMenuPacketRes, CommandTournamentOwnerMenuPacketRes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	TournamentStatuses, type TournamentStatus
} from "../../../../Lib/src/types/Tournament";

const state = vi.hoisted(() => ({
	mainMenu: undefined as unknown,
	menus: undefined as Map<string, unknown> | undefined
}));

vi.mock("../../../src/bot/DiscordCache", () => ({
	DiscordCache: {
		getInteraction: vi.fn(() => ({
			user: { id: "discord-user-id" },
			userLanguage: LANGUAGE.FRENCH
		}))
	}
}));

vi.mock("../../../src/messages/CrowniclesNestedMenus", () => ({
	CrowniclesNestedMenus: class {
		public constructor(mainMenu: unknown, menus: Map<string, unknown>) {
			state.mainMenu = mainMenu;
			state.menus = menus;
		}

		public async send(): Promise<Message> {
			return {
				createReactionCollector: vi.fn(() => ({
					on: vi.fn()
				}))
			} as unknown as Message;
		}
	}
}));

import {
	handleTournamentAdminMenu, handleTournamentOwnerMenu, TOURNAMENT_MENU_IDS
} from "../../../src/commands/tournament/TournamentMenus";

function getContainer(menu: unknown): ContainerBuilder {
	return (menu as { containers: ContainerBuilder[] }).containers[0];
}

function getSectionButtonIds(container: ContainerBuilder): string[] {
	return container.components.flatMap(component => {
		if (!("accessory" in component) || !component.accessory || !("data" in component.accessory)) {
			return [];
		}
		const customId = component.accessory.data.custom_id;
		return typeof customId === "string" ? [customId] : [];
	});
}

function buildTournamentSummary(id: number, status: TournamentStatus): CommandTournamentAdminMenuPacketRes["tournaments"][number] {
	return {
		id,
		status,
		discordChannelId: "tournament-channel",
		registrationEndsAt: Date.now() + 86_400_000,
		combatEndsAt: Date.now() + 172_800_000,
		participantCount: 20
	};
}

describe("Tournament menus", () => {
	it("renders the admin root as a city-style V2 menu", async () => {
		await handleTournamentAdminMenu({
			discord: { interaction: "interaction-id" }
		} as never, {
			tournaments: [buildTournamentSummary(42, TournamentStatuses.REGISTRATION)],
			hasAvailableCode: true
		});

		const container = getContainer(state.mainMenu);
		const buttonIds = getSectionButtonIds(container);
		expect(buttonIds).toContain(TOURNAMENT_MENU_IDS.ADMIN_CREATE);
		expect(buttonIds).toContain(TOURNAMENT_MENU_IDS.ADMIN_CANCEL);
		expect(state.menus?.has(TOURNAMENT_MENU_IDS.ADMIN_CREATE)).toBe(true);
		expect(state.menus?.has(TOURNAMENT_MENU_IDS.ADMIN_CANCEL)).toBe(true);
		expect(container.components.some(component => "accessory" in component)).toBe(true);
	});

	it("renders owner paused tournaments without command parameters", async () => {
		await handleTournamentOwnerMenu({
			discord: { interaction: "interaction-id" }
		} as never, {
			pausedTournaments: [buildTournamentSummary(7, TournamentStatuses.PAUSED)]
		} as CommandTournamentOwnerMenuPacketRes);

		const container = getContainer(state.mainMenu);
		const buttonIds = getSectionButtonIds(container);
		expect(buttonIds).toContain(TOURNAMENT_MENU_IDS.OWNER_RESUME);
		expect(state.menus?.has(TOURNAMENT_MENU_IDS.OWNER_RESUME)).toBe(true);
	});

	it("offers selectable tournament categories and durations in the create wizard", async () => {
		await handleTournamentAdminMenu({
			discord: { interaction: "interaction-id" }
		} as never, {
			tournaments: [],
			hasAvailableCode: true
		});

		const createMenu = state.menus?.get(TOURNAMENT_MENU_IDS.ADMIN_CREATE);
		const container = getContainer(createMenu);
		const json = container.toJSON();
		const serialized = JSON.stringify(json);
		expect(serialized).toContain(TOURNAMENT_MENU_IDS.CREATE_REGISTRATION_PREFIX);
		expect(serialized).toContain(TOURNAMENT_MENU_IDS.CREATE_COMBAT_PREFIX);
		expect(serialized).toContain(TOURNAMENT_MENU_IDS.CREATE_LEVEL_MODE_PREFIX);
		expect(serialized).toContain(TOURNAMENT_MENU_IDS.CREATE_CONFIRM);
		expect(serialized).not.toContain("code");
	});
});
