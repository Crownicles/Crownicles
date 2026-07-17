import {
	ActionRowBuilder, ButtonBuilder, ContainerBuilder, MessageComponentInteraction,
	SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	CommandReportBossLeaderboardReq, CommandReportBossLeaderboardRes,
	CommandReportBossPersonalRecordsReq, CommandReportBossPersonalRecordsRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { makePacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	PveBossLeaderboardEntry, PveBossPersonalRecord
} from "../../../../../../Lib/src/types/PveBossRecord";
import { KeycloakUtils } from "../../../../../../Lib/src/keycloak/KeycloakUtils";
import { DiscordMQTT } from "../../../../bot/DiscordMQTT";
import { keycloakConfig } from "../../../../bot/CrowniclesShard";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import {
	escapeUsername, StringUtils
} from "../../../../utils/StringUtils";
import i18n from "../../../../translations/i18n";
import {
	addCitySection, createCityCollector
} from "../ReportCityMenu";
import {
	ReportCityButtonStyles, ReportCityMenuIds
} from "../ReportCityMenuConstants";
import { CityMenuParams } from "../ReportCityMenuTypes";

const BOSS_IDS = Object.values(FightConstants.FINAL_BOSS_MONSTER_IDS);
const ARCHIVIST_REQUEST_TIMEOUT_MS = 10_000;
const SWIFT_VICTORY_MAX_TURNS = 10;
const LONG_VICTORY_MIN_TURNS = 20;

type ArchivistState = {
	selectedBossId?: string;
	personalRecords?: PveBossPersonalRecord[];
	maximumTierClassIds?: number[];
	pending: boolean;
	requestVersion: number;
};

const states = new WeakMap<object, ArchivistState>();

function getState(params: CityMenuParams): ArchivistState {
	let state = states.get(params.packet);
	if (!state) {
		state = {
			pending: false, requestVersion: 0
		};
		states.set(params.packet, state);
	}
	return state;
}

function createRequestContext(params: CityMenuParams): CityMenuParams["context"] {
	return {
		...params.context,
		...params.context.discord ? { discord: { ...params.context.discord } } : {},
		packetId: undefined
	};
}

function invalidatePendingRequest(params: CityMenuParams): void {
	const state = getState(params);
	state.requestVersion++;
	state.pending = false;
}

function addBackButton(container: ContainerBuilder, customId: string, label: string): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(customId)
				.setLabel(label)
				.setEmoji(CrowniclesIcons.city.back)
				.setStyle(ReportCityButtonStyles.BACK)
		)
	);
}

function getBossName(monsterId: string, lng: CityMenuParams["interaction"]["userLanguage"]): string {
	return i18n.t(`models:monsters.${monsterId}.name`, { lng });
}

function createArchivistCollector(
	params: CityMenuParams,
	handler: (customId: string, interaction: MessageComponentInteraction, menus: CrowniclesNestedMenus) => Promise<void>
): CrowniclesNestedMenu["createCollector"] {
	return createCityCollector(params.interaction, params.collectorTime, async (customId, interaction, menus) => {
		await interaction.deferUpdate();
		await handler(customId, interaction, menus);
	});
}

function finishPendingRequest(state: ArchivistState, requestVersion: number): void {
	if (requestVersion === state.requestVersion) {
		state.pending = false;
	}
}

async function handleRootSelection(
	params: CityMenuParams,
	customId: string,
	_interaction: MessageComponentInteraction,
	menus: CrowniclesNestedMenus
): Promise<void> {
	if (customId === ReportCityMenuIds.BACK_TO_CITY) {
		invalidatePendingRequest(params);
		await menus.changeToMainMenu();
		return;
	}
	const state = getState(params);
	if (state.personalRecords && state.maximumTierClassIds) {
		await menus.changeMenu(customId);
		return;
	}
	if (state.pending) {
		return;
	}
	state.pending = true;
	const requestVersion = ++state.requestVersion;
	try {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			createRequestContext(params),
			makePacket(CommandReportBossPersonalRecordsReq, {}),
			async (_context, packetName, responsePacket) => {
				if (requestVersion !== state.requestVersion) {
					return;
				}
				state.pending = false;
				if (packetName !== CommandReportBossPersonalRecordsRes.name) {
					return;
				}
				const response = responsePacket as CommandReportBossPersonalRecordsRes;
				state.personalRecords = response.personalRecords;
				state.maximumTierClassIds = response.maximumTierClassIds;
				menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, buildPersonalMenu(params));
				menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params));
				await menus.changeMenu(customId);
			},
			{
				timeoutMs: ARCHIVIST_REQUEST_TIMEOUT_MS,
				onTimeout: () => finishPendingRequest(state, requestVersion)
			}
		);
	}
	catch {
		finishPendingRequest(state, requestVersion);
	}
}

function buildRootMenu(params: CityMenuParams): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		StringUtils.formatHeader(i18n.t("commands:report.city.bossArchivist.title", {
			lng, pseudo: params.pseudo
		}))
	));
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		i18n.t("commands:report.city.bossArchivist.introduction", { lng })
	));
	addCitySection({
		container,
		emote: CrowniclesIcons.city.bossArchivist,
		title: i18n.t("commands:report.city.bossArchivist.personal.title", { lng }),
		description: i18n.t("commands:report.city.bossArchivist.personal.description", { lng }),
		customId: ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU,
		buttonLabel: i18n.t("commands:report.city.bossArchivist.personal.button", { lng }),
		buttonStyle: ReportCityButtonStyles.OPTION
	});
	addCitySection({
		container,
		emote: CrowniclesIcons.city.bossArchivist,
		title: i18n.t("commands:report.city.bossArchivist.leaderboard.title", { lng }),
		description: i18n.t("commands:report.city.bossArchivist.leaderboard.description", { lng }),
		customId: ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU,
		buttonLabel: i18n.t("commands:report.city.bossArchivist.leaderboard.button", { lng }),
		buttonStyle: ReportCityButtonStyles.OPTION
	});
	addBackButton(container, ReportCityMenuIds.BACK_TO_CITY, i18n.t("commands:report.city.buttons.backToCity", { lng }));
	return {
		containers: [container],
		createCollector: createArchivistCollector(params, handleRootSelection.bind(null, params))
	};
}

function addBossButtons(container: ContainerBuilder, prefix: string, lng: CityMenuParams["interaction"]["userLanguage"]): void {
	for (const bossId of BOSS_IDS) {
		addCitySection({
			container,
			emote: CrowniclesIcons.monsters[bossId],
			title: getBossName(bossId, lng),
			customId: `${prefix}${bossId}`,
			buttonLabel: i18n.t("commands:report.city.bossArchivist.examine", { lng }),
			buttonStyle: ReportCityButtonStyles.OPTION
		});
	}
}

function getDominantAction(record: PveBossPersonalRecord): PveBossPersonalRecord["actions"][number] | undefined {
	return record.actions.reduce<PveBossPersonalRecord["actions"][number] | undefined>(
		(best, action) => !best || action.count > best.count ? action : best,
		undefined
	);
}

function buildPersonalRecordText(record: PveBossPersonalRecord, lng: CityMenuParams["interaction"]["userLanguage"]): string {
	const dominantAction = getDominantAction(record);
	return i18n.t("commands:report.city.bossArchivist.personal.record", {
		lng,
		boss: getBossName(record.monsterId, lng),
		level: record.monsterLevel,
		turns: record.turns,
		date: record.date,
		class: DisplayUtils.getClassDisplay(record.classId, lng),
		action: dominantAction
			? i18n.t(`models:fight_actions.${dominantAction.actionId}.name`, {
				lng, count: dominantAction.count
			})
			: i18n.t("commands:report.city.bossArchivist.personal.unknownAction", { lng }),
		actionCount: dominantAction?.count ?? 0,
		context: record.turns <= SWIFT_VICTORY_MAX_TURNS
			? "swift"
			: record.turns >= LONG_VICTORY_MIN_TURNS ? "long" : "standard",
		monsterId: record.monsterId
	});
}

async function handlePersonalSelection(
	params: CityMenuParams,
	customId: string,
	_interaction: MessageComponentInteraction,
	menus: CrowniclesNestedMenus
): Promise<void> {
	if (customId.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX)) {
		const bossId = customId.slice(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX.length);
		const selectedRecord = getState(params).personalRecords?.find(item => item.monsterId === bossId);
		menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, buildPersonalMenu(params, selectedRecord, bossId));
	}
	else if (customId === ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU) {
		menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, buildPersonalMenu(params));
	}
	await menus.changeMenu(customId.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX)
		? ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU
		: customId);
}

function buildPersonalMenu(params: CityMenuParams, record?: PveBossPersonalRecord, selectedBossId?: string): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		StringUtils.formatHeader(i18n.t("commands:report.city.bossArchivist.personal.title", { lng }))
	));
	if (selectedBossId) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			record
				? buildPersonalRecordText(record, lng)
				: i18n.t("commands:report.city.bossArchivist.personal.noRecord", {
					lng, boss: getBossName(selectedBossId, lng)
				})
		));
		addBackButton(container, ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, i18n.t("commands:report.city.bossArchivist.backToBosses", { lng }));
	}
	else {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.bossArchivist.personal.chooseBoss", { lng })
		));
		addBossButtons(container, ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX, lng);
		addBackButton(container, ReportCityMenuIds.BOSS_ARCHIVIST_MENU, i18n.t("commands:report.city.buttons.back", { lng }));
	}
	return {
		containers: [container],
		createCollector: createArchivistCollector(params, handlePersonalSelection.bind(null, params))
	};
}

async function requestLeaderboard(
	params: CityMenuParams,
	menus: CrowniclesNestedMenus,
	state: ArchivistState,
	classId: number
): Promise<void> {
	state.pending = true;
	const requestVersion = ++state.requestVersion;
	try {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			createRequestContext(params),
			makePacket(CommandReportBossLeaderboardReq, {
				monsterId: state.selectedBossId!, classId
			}),
			async (_context, packetName, responsePacket) => {
				if (requestVersion !== state.requestVersion) {
					return;
				}
				state.pending = false;
				if (packetName !== CommandReportBossLeaderboardRes.name) {
					return;
				}
				const response = responsePacket as CommandReportBossLeaderboardRes;
				const leaderboardMenu = await buildLeaderboardMenu(params, response.entries, response.monsterId, response.classId);
				if (requestVersion !== state.requestVersion) {
					return;
				}
				menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, leaderboardMenu);
				await menus.changeMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU);
			},
			{
				timeoutMs: ARCHIVIST_REQUEST_TIMEOUT_MS,
				onTimeout: () => finishPendingRequest(state, requestVersion)
			}
		);
	}
	catch {
		finishPendingRequest(state, requestVersion);
	}
}

async function handleLeaderboardSelection(
	params: CityMenuParams,
	customId: string,
	_interaction: MessageComponentInteraction,
	menus: CrowniclesNestedMenus
): Promise<void> {
	const state = getState(params);
	if (customId.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX)) {
		state.selectedBossId = customId.slice(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX.length);
		menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params));
		await menus.changeMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU);
		return;
	}
	if (customId.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX)) {
		if (!state.pending && state.selectedBossId) {
			await requestLeaderboard(params, menus, state, Number(customId.slice(ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX.length)));
		}
		return;
	}
	invalidatePendingRequest(params);
	state.selectedBossId = undefined;
	menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params));
	await menus.changeMenu(customId);
}

function buildLeaderboardSelectionMenu(params: CityMenuParams): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const state = getState(params);
	const selectedBossId = state.selectedBossId;
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		StringUtils.formatHeader(i18n.t("commands:report.city.bossArchivist.leaderboard.title", { lng }))
	));
	if (!selectedBossId) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.bossArchivist.leaderboard.chooseBoss", { lng })
		));
		addBossButtons(container, ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX, lng);
		addBackButton(container, ReportCityMenuIds.BOSS_ARCHIVIST_MENU, i18n.t("commands:report.city.buttons.back", { lng }));
	}
	else {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.bossArchivist.leaderboard.chooseClass", {
				lng, boss: getBossName(selectedBossId, lng)
			})
		));
		for (const classId of state.maximumTierClassIds ?? []) {
			addCitySection({
				container,
				emote: CrowniclesIcons.classes[classId],
				title: i18n.t(`models:classes.${classId}`, { lng }),
				customId: `${ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX}${classId}`,
				buttonLabel: i18n.t("commands:report.city.bossArchivist.leaderboard.show", { lng }),
				buttonStyle: ReportCityButtonStyles.OPTION
			});
		}
		addBackButton(container, ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, i18n.t("commands:report.city.bossArchivist.backToBosses", { lng }));
	}
	return {
		containers: [container],
		createCollector: createArchivistCollector(params, handleLeaderboardSelection.bind(null, params))
	};
}

async function formatLeaderboardEntries(entries: PveBossLeaderboardEntry[], lng: CityMenuParams["interaction"]["userLanguage"]): Promise<string> {
	if (entries.length === 0) {
		return i18n.t("commands:report.city.bossArchivist.leaderboard.empty", { lng });
	}
	const usersRequest = await KeycloakUtils.getUsersFromIds(keycloakConfig, entries.map(entry => entry.playerKeycloakId));
	const unknownPlayer = i18n.t("error:unknownPlayer", { lng });
	const pseudos = usersRequest.isError
		? entries.map(() => unknownPlayer)
		: usersRequest.payload.users.map(user => user?.attributes.gameUsername?.[0]
			? escapeUsername(user.attributes.gameUsername[0])
			: unknownPlayer);
	return entries.map((entry, index) => i18n.t("commands:report.city.bossArchivist.leaderboard.entry", {
		lng,
		badge: getLeaderboardBadge(index + 1),
		position: index + 1,
		pseudo: pseudos[index] ?? unknownPlayer,
		level: entry.monsterLevel,
		turns: entry.turns
	})).join("\n");
}

function getLeaderboardBadge(position: number): string {
	switch (position) {
		case 1:
			return CrowniclesIcons.top.badges.first;
		case 2:
			return CrowniclesIcons.top.badges.second;
		case 3:
			return CrowniclesIcons.top.badges.third;
		case 4:
			return CrowniclesIcons.top.badges.fourth;
		case 5:
			return CrowniclesIcons.top.badges.fifth;
		default:
			return CrowniclesIcons.top.badges.default;
	}
}

async function buildLeaderboardMenu(
	params: CityMenuParams,
	entries: PveBossLeaderboardEntry[],
	monsterId: string,
	classId: number
): Promise<CrowniclesNestedMenu> {
	const lng = params.interaction.userLanguage;
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		StringUtils.formatHeader(i18n.t("commands:report.city.bossArchivist.leaderboard.resultTitle", {
			lng, boss: getBossName(monsterId, lng)
		}))
	));
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		i18n.t("commands:report.city.bossArchivist.leaderboard.classHeader", {
			lng, class: DisplayUtils.getClassDisplay(classId, lng)
		})
	));
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await formatLeaderboardEntries(entries, lng)));
	addBackButton(container, ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, i18n.t("commands:report.city.bossArchivist.leaderboard.changeSelection", { lng }));
	return {
		containers: [container],
		createCollector: createArchivistCollector(params, handleLeaderboardResultSelection.bind(null, params))
	};
}

async function handleLeaderboardResultSelection(
	params: CityMenuParams,
	customId: string,
	_interaction: MessageComponentInteraction,
	menus: CrowniclesNestedMenus
): Promise<void> {
	invalidatePendingRequest(params);
	getState(params).selectedBossId = undefined;
	menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params));
	await menus.changeMenu(customId);
}

export function getBossArchivistMenus(params: CityMenuParams): Map<string, CrowniclesNestedMenu> {
	return new Map([
		[ReportCityMenuIds.BOSS_ARCHIVIST_MENU, buildRootMenu(params)],
		[ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, buildPersonalMenu(params)],
		[ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params)]
	]);
}
