import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	ReactionCollectorApartmentBuyReaction,
	ReactionCollectorApartmentClaimRentReaction,
	ReactionCollectorCityBuyHomeReaction,
	ReactionCollectorCityData,
	ReactionCollectorCityMoveHomeReaction,
	ReactionCollectorCityUpgradeHomeReaction,
	ReactionCollectorGuildDomainNotaryReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { StringUtils } from "../../../../utils/StringUtils";
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
import {
	ReportCityMenuIds, buildApartmentClaimRentId, parseApartmentClaimRentId
} from "../ReportCityMenuConstants";
import {
	CityCollectorHandlerParams, CityMenuParams, ManageHomeData
} from "../ReportCityMenuTypes";
import { HomeMenuIds } from "../home/HomeMenuConstants";
import { openCityConfirmation } from "../confirmation/CityConfirmationMenu";

type ManageHomeCollectorParams = CityMenuParams;

type NotaryCollectorHandlerParams = CityCollectorHandlerParams & Pick<CityMenuParams, "collectorTime" | "interaction" | "pseudo">;

type NotaryConfirmationDetails = {
	description: string;
	confirmLabel: string;
	reactionType: string;
};

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

type SimpleCostNotaryParams = {
	cost: number;
	currentMoney: number;
	canAfford: boolean;
	lng: Language;
	noMoneyKey: string;
	enoughMoneyKey: string;
};

function buildSimpleCostNotaryDescription(params: SimpleCostNotaryParams): string {
	const {
		cost, currentMoney, canAfford, lng, noMoneyKey, enoughMoneyKey
	} = params;
	if (!canAfford) {
		return i18n.t(noMoneyKey, {
			lng, cost, missingMoney: cost - currentMoney
		});
	}
	return i18n.t(enoughMoneyKey, {
		lng, cost
	});
}

type SimpleCostDescriptionSpec = {
	matches: (d: ManageHomeData) => boolean;
	cost: (d: ManageHomeData) => number;
	canAfford: (d: ManageHomeData) => boolean;
	noMoneyKey: string;
	enoughMoneyKey: string;
};

const SIMPLE_COST_DESCRIPTIONS: SimpleCostDescriptionSpec[] = [
	{
		matches: d => Boolean(d.newPrice),
		cost: d => d.newPrice!,
		canAfford: d => Boolean(d.canBuy),
		noMoneyKey: "commands:report.city.homes.notaryNewHomeNoMoney",
		enoughMoneyKey: "commands:report.city.homes.notaryNewHomeEnoughMoney"
	},
	{
		matches: d => Boolean(d.movePrice),
		cost: d => d.movePrice!,
		canAfford: d => Boolean(d.canMove),
		noMoneyKey: "commands:report.city.homes.notaryMoveHomeNoMoney",
		enoughMoneyKey: "commands:report.city.homes.notaryMoveHomeEnoughMoney"
	}
];

function buildNotaryUpgradeDescription(data: ManageHomeData, lng: Language): string {
	const upgrade = data.upgrade!;
	if (!data.canUpgrade) {
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

function buildNotaryDescriptionFromSpec(spec: SimpleCostDescriptionSpec, data: ManageHomeData, lng: Language): string {
	return buildSimpleCostNotaryDescription({
		cost: spec.cost(data),
		currentMoney: data.currentMoney,
		canAfford: spec.canAfford(data),
		lng,
		noMoneyKey: spec.noMoneyKey,
		enoughMoneyKey: spec.enoughMoneyKey
	});
}

type NotaryDescriptionBuilder = {
	matches: (data: ManageHomeData) => boolean;
	build: (data: ManageHomeData, lng: Language) => string;
};

const NOTARY_DESCRIPTION_BUILDERS: NotaryDescriptionBuilder[] = [
	...SIMPLE_COST_DESCRIPTIONS.map((spec): NotaryDescriptionBuilder => ({
		matches: spec.matches,
		build: (d, lng): string => buildNotaryDescriptionFromSpec(spec, d, lng)
	})),
	{
		matches: (d): boolean => Boolean(d.upgrade), build: buildNotaryUpgradeDescription
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
		matches: (d): boolean => Boolean(d.canBuy),
		titleKey: "commands:report.city.homes.buyHome",
		customId: ReportCityMenuIds.BUY_HOME
	},
	{
		matches: (d): boolean => Boolean(d.canUpgrade),
		titleKey: "commands:report.city.homes.upgradeHome",
		customId: ReportCityMenuIds.UPGRADE_HOME
	},
	{
		matches: (d): boolean => Boolean(d.canMove),
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

	if (!guildNotaryData.canAfford) {
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

type ApartmentNotaryData = NonNullable<ReactionCollectorCityData["apartmentNotary"]>;
type ForSaleData = NonNullable<ApartmentNotaryData["forSale"]>;
type OwnedApartmentData = ApartmentNotaryData["ownedApartments"][number];

function renderForSale(container: ContainerBuilder, forSale: ForSaleData, lng: Language): void {
	const price = forSale.price;
	if (!forSale.canAfford) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.homes.apartmentNotary.buyNotEnoughMoney", {
					lng, cost: price, missingMoney: forSale.missingMoney
				})
			)
		);
		return;
	}
	addCitySection({
		container,
		text: i18n.t("commands:report.city.homes.apartmentNotary.forSaleDescription", {
			lng, price
		}),
		emoji: CrowniclesIcons.city.apartmentNotary.buy,
		customId: ReportCityMenuIds.APARTMENT_BUY,
		buttonLabel: i18n.t("commands:report.city.homes.apartmentNotary.buyButtonLabel", { lng }),
		buttonStyle: ButtonStyle.Success
	});
}

function renderOwnedApartment(container: ContainerBuilder, apt: OwnedApartmentData, lng: Language): void {
	const lineKey = apt.isRented
		? "commands:report.city.homes.apartmentNotary.ownedLineRented"
		: "commands:report.city.homes.apartmentNotary.ownedLineEmpty";
	const lineText = i18n.t(lineKey, {
		lng,
		mapLocationId: apt.mapLocationId,
		rent: apt.accumulatedRent
	});
	const buttonLabel = i18n.t("commands:report.city.homes.apartmentNotary.claimButtonLabel", { lng });
	addCitySection({
		container,
		text: lineText,
		emoji: apt.isRented
			? CrowniclesIcons.city.apartmentNotary.statusRented
			: CrowniclesIcons.city.apartmentNotary.statusEmpty,
		customId: buildApartmentClaimRentId(apt.apartmentId),
		buttonLabel,
		buttonStyle: apt.canClaim ? ButtonStyle.Success : ButtonStyle.Secondary,
		disabled: !apt.canClaim
	});
}

function addApartmentNotarySection(container: ContainerBuilder, apartmentData: ApartmentNotaryData, lng: Language): void {
	const hasForSale = Boolean(apartmentData.forSale);
	const hasOwned = apartmentData.ownedApartments.length > 0;
	if (!hasForSale && !hasOwned) {
		return;
	}

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.homes.apartmentNotary.sectionTitle", { lng })
		)
	);

	if (apartmentData.forSale) {
		renderForSale(container, apartmentData.forSale, lng);
	}

	if (hasOwned) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.homes.apartmentNotary.ownedHeader", {
					lng, count: apartmentData.ownedApartments.length
				})
			)
		);
		for (const apt of apartmentData.ownedApartments) {
			renderOwnedApartment(container, apt, lng);
		}
	}
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

const NOTARY_CONFIRMATION_ACTIONS = new Set<string>([
	ReportCityMenuIds.BUY_HOME,
	ReportCityMenuIds.UPGRADE_HOME,
	ReportCityMenuIds.MOVE_HOME,
	ReportCityMenuIds.GUILD_DOMAIN_CONFIRM,
	ReportCityMenuIds.APARTMENT_BUY
]);

type SimpleHomeConfirmationSpec = {
	selectedValue: string;
	cost: (d: ManageHomeData) => number | undefined;
	descriptionKey: string;
	confirmLabelKey: string;
	reactionType: string;
};

const SIMPLE_HOME_CONFIRMATIONS: SimpleHomeConfirmationSpec[] = [
	{
		selectedValue: ReportCityMenuIds.BUY_HOME,
		cost: d => d.newPrice,
		descriptionKey: "commands:report.city.homes.notaryConfirmBuyHome",
		confirmLabelKey: "commands:report.city.homes.buyHome",
		reactionType: ReactionCollectorCityBuyHomeReaction.name
	},
	{
		selectedValue: ReportCityMenuIds.MOVE_HOME,
		cost: d => d.movePrice,
		descriptionKey: "commands:report.city.homes.notaryConfirmMoveHome",
		confirmLabelKey: "commands:report.city.homes.moveHome",
		reactionType: ReactionCollectorCityMoveHomeReaction.name
	}
];

function buildSimpleHomeConfirmation(spec: SimpleHomeConfirmationSpec, homeData: ManageHomeData, lng: Language): NotaryConfirmationDetails | null {
	const cost = spec.cost(homeData);
	if (cost === undefined) {
		return null;
	}
	return {
		description: i18n.t(spec.descriptionKey, {
			lng, cost
		}),
		confirmLabel: i18n.t(spec.confirmLabelKey, { lng }),
		reactionType: spec.reactionType
	};
}

function buildHomeUpgradeConfirmation(homeData: ManageHomeData, lng: Language): NotaryConfirmationDetails | null {
	if (!homeData.upgrade) {
		return null;
	}
	return {
		description: i18n.t("commands:report.city.homes.notaryConfirmUpgradeHome", {
			lng,
			cost: homeData.upgrade.price,
			upgradeChanges: formatHomeUpgradeChanges(homeData.upgrade.oldFeatures, homeData.upgrade.newFeatures, lng)
		}),
		confirmLabel: i18n.t("commands:report.city.homes.upgradeHome", { lng }),
		reactionType: ReactionCollectorCityUpgradeHomeReaction.name
	};
}

function buildHomeConfirmation(
	selectedValue: string,
	homeData: ManageHomeData | undefined,
	lng: Language
): NotaryConfirmationDetails | null {
	if (!homeData) {
		return null;
	}
	const spec = SIMPLE_HOME_CONFIRMATIONS.find(s => s.selectedValue === selectedValue);
	if (spec) {
		return buildSimpleHomeConfirmation(spec, homeData, lng);
	}
	if (selectedValue === ReportCityMenuIds.UPGRADE_HOME) {
		return buildHomeUpgradeConfirmation(homeData, lng);
	}
	return null;
}

function buildGuildDomainConfirmation(
	guildNotaryData: GuildNotaryData | undefined,
	lng: Language
): NotaryConfirmationDetails | null {
	if (!guildNotaryData?.canAfford) {
		return null;
	}
	const descriptionKey = guildNotaryData.hasDomain
		? "commands:report.city.guildDomain.notaryConfirmRelocateDescription"
		: "commands:report.city.guildDomain.notaryConfirmPurchaseDescription";
	const labelKey = guildNotaryData.hasDomain
		? "commands:report.city.guildDomain.confirmRelocate"
		: "commands:report.city.guildDomain.confirmPurchase";
	return {
		description: i18n.t(descriptionKey, {
			lng,
			cost: guildNotaryData.cost,
			treasury: guildNotaryData.treasury
		}),
		confirmLabel: i18n.t(labelKey, { lng }),
		reactionType: ReactionCollectorGuildDomainNotaryReaction.name
	};
}

function buildApartmentBuyConfirmation(
	forSale: ForSaleData | undefined,
	lng: Language
): NotaryConfirmationDetails | null {
	if (!forSale?.canAfford) {
		return null;
	}
	return {
		description: i18n.t("commands:report.city.homes.apartmentNotary.buyConfirmDescription", {
			lng,
			price: forSale.price
		}),
		confirmLabel: i18n.t("commands:report.city.homes.apartmentNotary.buyButtonLabel", { lng }),
		reactionType: ReactionCollectorApartmentBuyReaction.name
	};
}

function buildNotaryConfirmationDetails(params: NotaryCollectorHandlerParams): NotaryConfirmationDetails | null {
	const cityData = params.packet.data.data as ReactionCollectorCityData;
	const lng = params.interaction.userLanguage;
	if (params.selectedValue === ReportCityMenuIds.GUILD_DOMAIN_CONFIRM) {
		return buildGuildDomainConfirmation(cityData.guildDomainNotary, lng);
	}
	if (params.selectedValue === ReportCityMenuIds.APARTMENT_BUY) {
		return buildApartmentBuyConfirmation(cityData.apartmentNotary.forSale, lng);
	}
	return buildHomeConfirmation(params.selectedValue, cityData.home.manage, lng);
}

async function showNotaryConfirmation(params: NotaryCollectorHandlerParams, details: NotaryConfirmationDetails): Promise<void> {
	await openCityConfirmation(params.nestedMenus, {
		interaction: params.interaction,
		collectorTime: params.collectorTime,
		lng: params.interaction.userLanguage,
		pseudo: params.pseudo
	}, {
		description: details.description,
		confirmLabel: details.confirmLabel,
		backMenuId: HomeMenuIds.MANAGE_HOME_MENU,
		confirmAck: "reply",
		onConfirm: async action => {
			await sendReactionByType({
				...params,
				buttonInteraction: action.buttonInteraction,
				nestedMenus: action.nestedMenus
			}, details.reactionType);
		}
	});
}

function sendReactionByType(params: CityCollectorHandlerParams, reactionType: string): void {
	const reactionIndex = params.packet.reactions.findIndex(reaction => reaction.type === reactionType);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(params.packet, params.context, params.context.keycloakId!, params.buttonInteraction, reactionIndex);
	}
}

async function handleApartmentClaimRent(
	params: NotaryCollectorHandlerParams,
	selectedValue: string
): Promise<void> {
	const {
		buttonInteraction, context, packet
	} = params;
	const apartmentId = parseApartmentClaimRentId(selectedValue);
	if (apartmentId === null) {
		await buttonInteraction.deferUpdate();
		return;
	}
	await buttonInteraction.deferReply();
	const reactionIndex = packet.reactions.findIndex(
		reaction => reaction.type === ReactionCollectorApartmentClaimRentReaction.name
			&& (reaction.data as ReactionCollectorApartmentClaimRentReaction).apartmentId === apartmentId
	);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
	}
}

async function handleNotaryConfirmationRequest(params: NotaryCollectorHandlerParams): Promise<void> {
	await params.buttonInteraction.deferUpdate();
	const confirmationDetails = buildNotaryConfirmationDetails(params);
	if (confirmationDetails) {
		await showNotaryConfirmation(params, confirmationDetails);
	}
}

async function handleManageHomeCollectorInteraction(params: NotaryCollectorHandlerParams): Promise<void> {
	const {
		selectedValue, buttonInteraction, nestedMenus, context, packet
	} = params;

	if (selectedValue.startsWith(ReportCityMenuIds.APARTMENT_CLAIM_RENT_PREFIX)) {
		await handleApartmentClaimRent(params, selectedValue);
		return;
	}

	if (NOTARY_CONFIRMATION_ACTIONS.has(selectedValue)) {
		await handleNotaryConfirmationRequest(params);
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
		context, interaction, packet, collectorTime, pseudo
	} = params;
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleManageHomeCollectorInteraction({
			selectedValue: customId, buttonInteraction, nestedMenus, context, packet, interaction, collectorTime, pseudo
		});
	});
}

export function getManageHomeMenu(params: CityMenuParams): CrowniclesNestedMenu {
	const cityData = params.packet.data.data as ReactionCollectorCityData;
	const lng = params.interaction.userLanguage;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			StringUtils.formatHeader(i18n.t("commands:report.city.homes.notaryTitle", {
				lng, pseudo: params.pseudo
			}))
		)
	);

	addPersonalNotarySection(container, cityData.home.manage, lng);
	addGuildNotarySection(container, cityData.guildDomainNotary, lng);
	addApartmentNotarySection(container, cityData.apartmentNotary, lng);
	addNotaryNavigation(container, lng);

	return {
		containers: [container],
		createCollector: createManageHomeMenuCollector({
			context: params.context,
			interaction: params.interaction,
			packet: params.packet,
			collectorTime: params.collectorTime,
			pseudo: params.pseudo
		})
	};
}
