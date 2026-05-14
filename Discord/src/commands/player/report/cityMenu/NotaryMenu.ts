import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	ReactionCollectorCityBuyHomeReaction,
	ReactionCollectorCityData,
	ReactionCollectorCityMoveHomeReaction,
	ReactionCollectorCityUpgradeHomeReaction,
	ReactionCollectorGuildDomainNotaryReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import {
	ChestSlotsPerCategory, HomeFeatures
} from "../../../../../../Lib/src/types/HomeFeatures";
import { ItemRarity } from "../../../../../../Lib/src/constants/ItemConstants";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import {
	addCitySection,
	createCityCollector,
	createStayInCityButton,
	handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import {
	CityCollectorHandlerParams, CityMenuParams, ManageHomeData
} from "../ReportCityMenuTypes";

type ManageHomeCollectorParams = Omit<CityMenuParams, "pseudo">;

function hasSlotsChanged(oldSlots: ChestSlotsPerCategory, newSlots: ChestSlotsPerCategory): boolean {
	return oldSlots.weapon !== newSlots.weapon
		|| oldSlots.armor !== newSlots.armor
		|| oldSlots.object !== newSlots.object
		|| oldSlots.potion !== newSlots.potion;
}

function totalSlots(slots: ChestSlotsPerCategory): number {
	return slots.weapon + slots.armor + slots.object + slots.potion;
}

interface UpgradeCheck {
	hasChanged: (oldF: HomeFeatures, newF: HomeFeatures) => boolean;
	isNew: (oldF: HomeFeatures) => boolean;
	newKey: string;
	upgradeKey: string;
}

const UPGRADE_CHECKS: UpgradeCheck[] = [
	{
		hasChanged: (o, n): boolean => hasSlotsChanged(o.chestSlots, n.chestSlots),
		isNew: (o): boolean => totalSlots(o.chestSlots) === 0,
		newKey: "chest",
		upgradeKey: "biggerChest"
	},
	{
		hasChanged: (o, n): boolean => hasSlotsChanged(o.inventoryBonus, n.inventoryBonus),
		isNew: (): boolean => false,
		newKey: "inventoryBonus",
		upgradeKey: "inventoryBonus"
	},
	{
		hasChanged: (o, n): boolean => o.upgradeItemMaximumRarity !== n.upgradeItemMaximumRarity,
		isNew: (o): boolean => o.upgradeItemMaximumRarity === ItemRarity.BASIC,
		newKey: "upgradeItemStation",
		upgradeKey: "betterUpgradeItemStation"
	},
	{
		hasChanged: (o, n): boolean => o.bedHealthRegeneration !== n.bedHealthRegeneration,
		isNew: (): boolean => false,
		newKey: "betterBed",
		upgradeKey: "betterBed"
	},
	{
		hasChanged: (o, n): boolean => o.gardenPlots !== n.gardenPlots,
		isNew: (o): boolean => o.gardenPlots === 0,
		newKey: "garden",
		upgradeKey: "biggerGarden"
	},
	{
		hasChanged: (o, n): boolean => o.gardenEarthQuality !== n.gardenEarthQuality,
		isNew: (): boolean => false,
		newKey: "betterGardenEarth",
		upgradeKey: "betterGardenEarth"
	},
	{
		hasChanged: (o, n): boolean => o.cookingSlots !== n.cookingSlots,
		isNew: (o): boolean => o.cookingSlots === 0,
		newKey: "cookingStation",
		upgradeKey: "betterCookingStation"
	}
];

const formatHomeUpgradeChanges = (oldFeatures: HomeFeatures, newFeatures: HomeFeatures, lng: Language): string => {
	const changes: string[] = [];

	for (const check of UPGRADE_CHECKS) {
		if (check.hasChanged(oldFeatures, newFeatures)) {
			const key = check.isNew(oldFeatures) ? check.newKey : check.upgradeKey;
			changes.push(i18n.t(`commands:report.city.homes.upgradeChanges.${key}`, { lng }));
		}
	}

	return changes.map(change => `- ${change}`).join("\n");
};

function buildSimpleCostNotaryDescription(
	cost: number, currentMoney: number, lng: Language, noMoneyKey: string, enoughMoneyKey: string
): string {
	if (cost > currentMoney) {
		return i18n.t(noMoneyKey, {
			lng, cost, missingMoney: cost - currentMoney
		});
	}
	return i18n.t(enoughMoneyKey, {
		lng, cost
	});
}

function buildNotaryNewHomeDescription(data: ManageHomeData, lng: Language): string {
	return buildSimpleCostNotaryDescription(
		data.newPrice!,
		data.currentMoney,
		lng,
		"commands:report.city.homes.notaryNewHomeNoMoney",
		"commands:report.city.homes.notaryNewHomeEnoughMoney"
	);
}

function buildNotaryUpgradeDescription(data: ManageHomeData, lng: Language): string {
	const upgrade = data.upgrade!;
	if (upgrade.price > data.currentMoney) {
		return i18n.t("commands:report.city.homes.notaryUpgradeHomeNoMoney", {
			lng,
			cost: upgrade.price,
			missingMoney: upgrade.price - data.currentMoney
		});
	}
	const upgradeChanges = formatHomeUpgradeChanges(upgrade.oldFeatures, upgrade.newFeatures, lng);
	return i18n.t("commands:report.city.homes.notaryUpgradeHomeEnoughMoney", {
		lng,
		cost: upgrade.price,
		upgradeChanges
	});
}

function buildNotaryMoveDescription(data: ManageHomeData, lng: Language): string {
	return buildSimpleCostNotaryDescription(
		data.movePrice!,
		data.currentMoney,
		lng,
		"commands:report.city.homes.notaryMoveHomeNoMoney",
		"commands:report.city.homes.notaryMoveHomeEnoughMoney"
	);
}

type NotaryDescriptionBuilder = {
	matches: (data: ManageHomeData) => boolean;
	build: (data: ManageHomeData, lng: Language) => string;
};

const NOTARY_DESCRIPTION_BUILDERS: NotaryDescriptionBuilder[] = [
	{
		matches: (d): boolean => Boolean(d.newPrice), build: buildNotaryNewHomeDescription
	},
	{
		matches: (d): boolean => Boolean(d.upgrade), build: buildNotaryUpgradeDescription
	},
	{
		matches: (d): boolean => Boolean(d.movePrice), build: buildNotaryMoveDescription
	},
	{
		matches: (d): boolean => Boolean(d.requiredPlayerLevelForUpgrade),
		build: (d, lng): string => i18n.t("commands:report.city.homes.notaryLevelRequired", {
			lng, level: d.requiredPlayerLevelForUpgrade
		})
	},
	{
		matches: (d): boolean => Boolean(d.isMaxLevel),
		build: (_d, lng): string => i18n.t("commands:report.city.homes.notaryMaxLevel", { lng })
	}
];

/**
 * Build the notary description text based on available home actions
 */
function buildNotaryDescription(data: ManageHomeData, lng: Language): string {
	const builder = NOTARY_DESCRIPTION_BUILDERS.find(b => b.matches(data));
	if (!builder) {
		console.warn("Manage home menu opened without any available action");
		return "";
	}
	return builder.build(data, lng);
}

type NotaryActionConfig = {
	matches: (data: ManageHomeData) => boolean;
	titleKey: string;
	customId: string;
};

const NOTARY_ACTION_CONFIGS: NotaryActionConfig[] = [
	{
		matches: (d): boolean => Boolean(d.newPrice) && d.newPrice! <= d.currentMoney,
		titleKey: "commands:report.city.homes.buyHome",
		customId: ReportCityMenuIds.BUY_HOME
	},
	{
		matches: (d): boolean => Boolean(d.upgrade) && d.upgrade!.price <= d.currentMoney,
		titleKey: "commands:report.city.homes.upgradeHome",
		customId: ReportCityMenuIds.UPGRADE_HOME
	},
	{
		matches: (d): boolean => Boolean(d.movePrice) && d.movePrice! <= d.currentMoney,
		titleKey: "commands:report.city.homes.moveHome",
		customId: ReportCityMenuIds.MOVE_HOME
	}
];

/**
 * Add the appropriate action button to the notary container
 */
function addNotaryActionButton(container: ContainerBuilder, data: ManageHomeData, lng: Language): void {
	const action = NOTARY_ACTION_CONFIGS.find(c => c.matches(data));
	if (!action) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	addCitySection({
		container,
		emote: CrowniclesIcons.collectors.accept,
		title: i18n.t(action.titleKey, { lng }),
		customId: action.customId,
		buttonLabel: i18n.t("commands:report.city.buttons.confirm", { lng }),
		buttonStyle: ButtonStyle.Success
	});
}

function addPersonalNotarySection(container: ContainerBuilder, homeData: ManageHomeData | undefined, lng: Language): void {
	if (!homeData) {
		return;
	}
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`${i18n.t("commands:report.city.homes.notaryIntroduction", { lng })}\n\n${buildNotaryDescription(homeData, lng)}`
		)
	);
	addNotaryActionButton(container, homeData, lng);
}

type GuildNotaryData = NonNullable<ReactionCollectorCityData["guildDomainNotary"]>;

function buildGuildNotaryConfirmLabel(guildNotaryData: GuildNotaryData, lng: Language): string {
	const actionLabel = guildNotaryData.hasDomain
		? i18n.t("commands:report.city.guildDomain.confirmRelocate", { lng })
		: i18n.t("commands:report.city.guildDomain.confirmPurchase", { lng });
	if (guildNotaryData.cost > 0) {
		return i18n.t("commands:report.city.guildDomain.notaryConfirmLabel", {
			lng, cost: guildNotaryData.cost
		});
	}
	return actionLabel;
}

function addGuildNotarySection(container: ContainerBuilder, guildNotaryData: GuildNotaryData | undefined, lng: Language): void {
	if (!guildNotaryData?.isChief) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	const descriptionKey = guildNotaryData.hasDomain
		? "commands:report.city.guildDomain.notaryRelocateDescription"
		: "commands:report.city.guildDomain.notaryPurchaseDescription";

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t(descriptionKey, {
				lng,
				cost: guildNotaryData.cost,
				treasury: guildNotaryData.treasury
			})
		)
	);

	if (guildNotaryData.treasury < guildNotaryData.cost) {
		return;
	}
	const actionLabel = guildNotaryData.hasDomain
		? i18n.t("commands:report.city.guildDomain.confirmRelocate", { lng })
		: i18n.t("commands:report.city.guildDomain.confirmPurchase", { lng });
	addCitySection({
		container,
		text: buildGuildNotaryConfirmLabel(guildNotaryData, lng),
		emoji: CrowniclesIcons.city.guildDomainNotary,
		customId: ReportCityMenuIds.GUILD_DOMAIN_CONFIRM,
		buttonLabel: actionLabel,
		buttonStyle: ButtonStyle.Success
	});
}

function addNotaryNavigation(container: ContainerBuilder, lng: Language): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.BACK_TO_CITY)
				.setLabel(i18n.t("commands:report.city.homes.leaveNotary", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(lng)
		)
	);
}

const NOTARY_REACTION_ROUTES: Record<string, string> = {
	[ReportCityMenuIds.BUY_HOME]: ReactionCollectorCityBuyHomeReaction.name,
	[ReportCityMenuIds.UPGRADE_HOME]: ReactionCollectorCityUpgradeHomeReaction.name,
	[ReportCityMenuIds.MOVE_HOME]: ReactionCollectorCityMoveHomeReaction.name,
	[ReportCityMenuIds.GUILD_DOMAIN_CONFIRM]: ReactionCollectorGuildDomainNotaryReaction.name
};

async function sendReactionByType(params: CityCollectorHandlerParams, reactionType: string): Promise<void> {
	await params.buttonInteraction.deferReply();
	const reactionIndex = params.packet.reactions.findIndex(reaction => reaction.type === reactionType);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(params.packet, params.context, params.context.keycloakId!, params.buttonInteraction, reactionIndex);
	}
}

async function handleManageHomeCollectorInteraction(params: CityCollectorHandlerParams): Promise<void> {
	const {
		selectedValue, buttonInteraction, nestedMenus, context, packet
	} = params;

	if (NOTARY_REACTION_ROUTES[selectedValue]) {
		await sendReactionByType(params, NOTARY_REACTION_ROUTES[selectedValue]);
		return;
	}

	if (selectedValue === ReportCityMenuIds.BACK_TO_CITY) {
		await buttonInteraction.deferUpdate();
		await nestedMenus.changeToMainMenu();
		return;
	}

	if (selectedValue === ReportCityMenuIds.STAY_IN_CITY) {
		await buttonInteraction.deferUpdate();
		handleStayInCityInteraction(packet, context, buttonInteraction);
	}
}

/**
 * Create the collector for the manage home sub-menu.
 */
function createManageHomeMenuCollector(
	params: ManageHomeCollectorParams
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const {
		context, interaction, packet, collectorTime
	} = params;
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleManageHomeCollectorInteraction({
			selectedValue: customId, buttonInteraction, nestedMenus, context, packet
		});
	});
}

export function getManageHomeMenu(params: CityMenuParams): CrowniclesNestedMenu {
	const cityData = params.packet.data.data as ReactionCollectorCityData;
	const lng = params.interaction.userLanguage;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.homes.notaryTitle", {
				lng, pseudo: params.pseudo
			})}`
		)
	);

	addPersonalNotarySection(container, cityData.home.manage, lng);
	addGuildNotarySection(container, cityData.guildDomainNotary, lng);
	addNotaryNavigation(container, lng);

	return {
		containers: [container],
		createCollector: createManageHomeMenuCollector({
			context: params.context,
			interaction: params.interaction,
			packet: params.packet,
			collectorTime: params.collectorTime
		})
	};
}
