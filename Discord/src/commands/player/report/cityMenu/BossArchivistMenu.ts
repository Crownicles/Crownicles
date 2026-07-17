import {
	ActionRowBuilder, ButtonBuilder, ContainerBuilder,
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
	FinalPveBossId, PveBossLeaderboardEntry, PveBossPersonalRecord
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
const BOSS_ID_SET = new Set<string>(BOSS_IDS);
const ARCHIVIST_REQUEST_TIMEOUT_MS = 10_000;
const SWIFT_VICTORY_MAX_TURNS = 10;
const LONG_VICTORY_MIN_TURNS = 20;

type ArchivistMenuAction = typeof ReportCityMenuIds[keyof Pick<typeof ReportCityMenuIds,
	"BACK_TO_CITY"
	| "BOSS_ARCHIVIST_MENU"
	| "BOSS_ARCHIVIST_PERSONAL_MENU"
	| "BOSS_ARCHIVIST_LEADERBOARD_MENU">];

type ArchivistButton = {
	id: ArchivistMenuAction;
	label: string;
};

type BossSelection = {
	monsterId: FinalPveBossId;
};

type BossSelectionPrefix = typeof ReportCityMenuIds[
	"BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX" | "BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX"
];

type LeaderboardSelection = BossSelection & {
	classId: number;
};

type LeaderboardSnapshot = LeaderboardSelection & {
	entries: PveBossLeaderboardEntry[];
};

type ArchivistState = {
	selectedBossId?: FinalPveBossId;
	personalRecords?: PveBossPersonalRecord[];
	maximumTierClassIds?: number[];
	pending: boolean;
	requestVersion: number;
};

type ArchivistMenuClick = {
	actionId: string;
	menus: CrowniclesNestedMenus;
};

function parseBossSelection(actionId: string, prefix: BossSelectionPrefix): BossSelection | null {
	const monsterId = actionId.slice(prefix.length);
	return BOSS_ID_SET.has(monsterId) ? { monsterId: monsterId as FinalPveBossId } : null;
}

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

function addBackButton(container: ContainerBuilder, button: ArchivistButton): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(button.id)
				.setLabel(button.label)
				.setEmoji(CrowniclesIcons.city.back)
				.setStyle(ReportCityButtonStyles.BACK)
		)
	);
}

function getBossName(selection: BossSelection, lng: CityMenuParams["interaction"]["userLanguage"]): string {
	return i18n.t(`models:monsters.${selection.monsterId}.name`, { lng });
}

function createArchivistCollector(
	params: CityMenuParams,
	handler: (click: ArchivistMenuClick) => Promise<void>
): CrowniclesNestedMenu["createCollector"] {
	return createCityCollector(params.interaction, params.collectorTime, async (customId, interaction, menus) => {
		await interaction.deferUpdate();
		await handler({
			actionId: customId, menus
		});
	});
}

function finishPendingRequest(state: ArchivistState, requestVersion: number): void {
	if (requestVersion === state.requestVersion) {
		state.pending = false;
	}
}

async function handleRootSelection(
	params: CityMenuParams,
	click: ArchivistMenuClick
): Promise<void> {
	if (click.actionId === ReportCityMenuIds.BACK_TO_CITY) {
		invalidatePendingRequest(params);
		await click.menus.changeToMainMenu();
		return;
	}
	const state = getState(params);
	if (state.personalRecords && state.maximumTierClassIds) {
		await click.menus.changeMenu(click.actionId);
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
				click.menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, buildPersonalMenu(params));
				click.menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params));
				await click.menus.changeMenu(click.actionId);
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
	addBackButton(container, {
		id: ReportCityMenuIds.BACK_TO_CITY,
		label: i18n.t("commands:report.city.buttons.backToCity", { lng })
	});
	return {
		containers: [container],
		createCollector: createArchivistCollector(params, handleRootSelection.bind(null, params))
	};
}

function addBossButtons(container: ContainerBuilder, prefix: BossSelectionPrefix, lng: CityMenuParams["interaction"]["userLanguage"]): void {
	for (const bossId of BOSS_IDS) {
		addCitySection({
			container,
			emote: CrowniclesIcons.monsters[bossId],
			title: getBossName({ monsterId: bossId }, lng),
			customId: `${prefix}${bossId}`,
			buttonLabel: i18n.t("commands:report.city.bossArchivist.examine", { lng }),
			buttonStyle: ReportCityButtonStyles.OPTION
		});
	}
}

function getDominantAction(record: PveBossPersonalRecord): PveBossPersonalRecord["actions"][number] | undefined {
	let dominantAction = record.actions[0];
	for (const action of record.actions.slice(1)) {
		if (action.count > dominantAction.count) {
			dominantAction = action;
		}
	}
	return dominantAction;
}

function buildPersonalRecordText(record: PveBossPersonalRecord, lng: CityMenuParams["interaction"]["userLanguage"]): string {
	const dominantAction = getDominantAction(record);
	return i18n.t("commands:report.city.bossArchivist.personal.record", {
		lng,
		boss: getBossName({ monsterId: record.monsterId }, lng),
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
	click: ArchivistMenuClick
): Promise<void> {
	const selectedBoss = click.actionId.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX)
		? parseBossSelection(click.actionId, ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX)
		: null;
	if (selectedBoss) {
		const selectedRecord = getState(params).personalRecords?.find(item => item.monsterId === selectedBoss.monsterId);
		click.menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, buildPersonalMenu(params, selectedRecord, selectedBoss));
	}
	else if (click.actionId === ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU) {
		click.menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, buildPersonalMenu(params));
	}
	await click.menus.changeMenu(selectedBoss
		? ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU
		: click.actionId);
}

function buildPersonalMenu(params: CityMenuParams, record?: PveBossPersonalRecord, selectedBoss?: BossSelection): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		StringUtils.formatHeader(i18n.t("commands:report.city.bossArchivist.personal.title", { lng }))
	));
	if (selectedBoss) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			record
				? buildPersonalRecordText(record, lng)
				: i18n.t("commands:report.city.bossArchivist.personal.noRecord", {
					lng, boss: getBossName(selectedBoss, lng)
				})
		));
		addBackButton(container, {
			id: ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU,
			label: i18n.t("commands:report.city.bossArchivist.backToBosses", { lng })
		});
	}
	else {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.bossArchivist.personal.chooseBoss", { lng })
		));
		addBossButtons(container, ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_BOSS_PREFIX, lng);
		addBackButton(container, {
			id: ReportCityMenuIds.BOSS_ARCHIVIST_MENU,
			label: i18n.t("commands:report.city.buttons.back", { lng })
		});
	}
	return {
		containers: [container],
		createCollector: createArchivistCollector(params, handlePersonalSelection.bind(null, params))
	};
}

async function requestLeaderboard(
	params: CityMenuParams,
	selection: LeaderboardSelection,
	state: ArchivistState,
	menus: CrowniclesNestedMenus
): Promise<void> {
	state.pending = true;
	const requestVersion = ++state.requestVersion;
	try {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			createRequestContext(params),
			makePacket(CommandReportBossLeaderboardReq, {
				monsterId: selection.monsterId,
				classId: selection.classId
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
				const leaderboardMenu = await buildLeaderboardMenu(params, {
					entries: response.entries,
					monsterId: response.monsterId,
					classId: response.classId
				});
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
	click: ArchivistMenuClick
): Promise<void> {
	const state = getState(params);
	const selectedBoss = click.actionId.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX)
		? parseBossSelection(click.actionId, ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_BOSS_PREFIX)
		: null;
	if (selectedBoss) {
		state.selectedBossId = selectedBoss.monsterId;
		click.menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params));
		await click.menus.changeMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU);
		return;
	}
	if (click.actionId.startsWith(ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX)) {
		if (!state.pending && state.selectedBossId) {
			await requestLeaderboard(
				params,
				{
					monsterId: state.selectedBossId,
					classId: Number(click.actionId.slice(ReportCityMenuIds.BOSS_ARCHIVIST_CLASS_PREFIX.length))
				},
				state,
				click.menus
			);
		}
		return;
	}
	invalidatePendingRequest(params);
	state.selectedBossId = undefined;
	click.menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params));
	await click.menus.changeMenu(click.actionId);
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
		addBackButton(container, {
			id: ReportCityMenuIds.BOSS_ARCHIVIST_MENU,
			label: i18n.t("commands:report.city.buttons.back", { lng })
		});
	}
	else {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.bossArchivist.leaderboard.chooseClass", {
				lng, boss: getBossName({ monsterId: selectedBossId }, lng)
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
		addBackButton(container, {
			id: ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU,
			label: i18n.t("commands:report.city.bossArchivist.backToBosses", { lng })
		});
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
	snapshot: LeaderboardSnapshot
): Promise<CrowniclesNestedMenu> {
	const lng = params.interaction.userLanguage;
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		StringUtils.formatHeader(i18n.t("commands:report.city.bossArchivist.leaderboard.resultTitle", {
			lng, boss: getBossName(snapshot, lng)
		}))
	));
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
		i18n.t("commands:report.city.bossArchivist.leaderboard.classHeader", {
			lng, class: DisplayUtils.getClassDisplay(snapshot.classId, lng)
		})
	));
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await formatLeaderboardEntries(snapshot.entries, lng)));
	addBackButton(container, {
		id: ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU,
		label: i18n.t("commands:report.city.bossArchivist.leaderboard.changeSelection", { lng })
	});
	return {
		containers: [container],
		createCollector: createArchivistCollector(params, handleLeaderboardResultSelection.bind(null, params))
	};
}

async function handleLeaderboardResultSelection(
	params: CityMenuParams,
	click: ArchivistMenuClick
): Promise<void> {
	invalidatePendingRequest(params);
	getState(params).selectedBossId = undefined;
	click.menus.registerMenu(ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params));
	await click.menus.changeMenu(click.actionId);
}

export function getBossArchivistMenus(params: CityMenuParams): Map<string, CrowniclesNestedMenu> {
	return new Map([
		[ReportCityMenuIds.BOSS_ARCHIVIST_MENU, buildRootMenu(params)],
		[ReportCityMenuIds.BOSS_ARCHIVIST_PERSONAL_MENU, buildPersonalMenu(params)],
		[ReportCityMenuIds.BOSS_ARCHIVIST_LEADERBOARD_MENU, buildLeaderboardSelectionMenu(params)]
	]);
}
