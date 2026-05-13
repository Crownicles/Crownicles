import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	MessageComponentInteraction, SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityBuyHomeReaction,
	ReactionCollectorCityData,
	ReactionCollectorCityMoveHomeReaction,
	ReactionCollectorCityUpgradeHomeReaction,
	ReactionCollectorGuildDomainNotaryReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
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
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import i18n from "../../../../translations/i18n";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import {
	addCitySection,
	createCityCollector,
	createStayInCityButton,
	handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";

type ManageHomeData = NonNullable<ReactionCollectorCityData["home"]["manage"]>;

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

/**
 * Build the notary description text based on available home actions
 */
function buildNotaryDescription(data: ManageHomeData, lng: Language): string {
	if (data.newPrice) {
		return data.newPrice > data.currentMoney
			? i18n.t("commands:report.city.homes.notaryNewHomeNoMoney", {
				lng,
				cost: data.newPrice,
				missingMoney: data.newPrice - data.currentMoney
			})
			: i18n.t("commands:report.city.homes.notaryNewHomeEnoughMoney", {
				lng,
				cost: data.newPrice
			});
	}
	if (data.upgrade) {
		if (data.upgrade.price > data.currentMoney) {
			return i18n.t("commands:report.city.homes.notaryUpgradeHomeNoMoney", {
				lng,
				cost: data.upgrade.price,
				missingMoney: data.upgrade.price - data.currentMoney
			});
		}
		const upgradeChanges = formatHomeUpgradeChanges(data.upgrade.oldFeatures, data.upgrade.newFeatures, lng);
		return i18n.t("commands:report.city.homes.notaryUpgradeHomeEnoughMoney", {
			lng,
			cost: data.upgrade.price,
			upgradeChanges
		});
	}
	if (data.movePrice) {
		return data.movePrice > data.currentMoney
			? i18n.t("commands:report.city.homes.notaryMoveHomeNoMoney", {
				lng,
				cost: data.movePrice,
				missingMoney: data.movePrice - data.currentMoney
			})
			: i18n.t("commands:report.city.homes.notaryMoveHomeEnoughMoney", {
				lng,
				cost: data.movePrice
			});
	}
	if (data.requiredPlayerLevelForUpgrade) {
		return i18n.t("commands:report.city.homes.notaryLevelRequired", {
			lng,
			level: data.requiredPlayerLevelForUpgrade
		});
	}
	if (data.isMaxLevel) {
		return i18n.t("commands:report.city.homes.notaryMaxLevel", { lng });
	}
	console.warn("Manage home menu opened without any available action");
	return "";
}

/**
 * Add the appropriate action button to the notary container
 */
function addNotaryActionButton(container: ContainerBuilder, data: ManageHomeData, lng: Language): void {
	if (data.newPrice && data.newPrice <= data.currentMoney) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			emote: CrowniclesIcons.collectors.accept,
			title: i18n.t("commands:report.city.homes.buyHome", { lng }),
			customId: ReportCityMenuIds.BUY_HOME,
			buttonLabel: i18n.t("commands:report.city.buttons.confirm", { lng }),
			buttonStyle: ButtonStyle.Success
		});
	}
	else if (data.upgrade && data.upgrade.price <= data.currentMoney) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			emote: CrowniclesIcons.collectors.accept,
			title: i18n.t("commands:report.city.homes.upgradeHome", { lng }),
			customId: ReportCityMenuIds.UPGRADE_HOME,
			buttonLabel: i18n.t("commands:report.city.buttons.confirm", { lng }),
			buttonStyle: ButtonStyle.Success
		});
	}
	else if (data.movePrice && data.movePrice <= data.currentMoney) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			emote: CrowniclesIcons.collectors.accept,
			title: i18n.t("commands:report.city.homes.moveHome", { lng }),
			customId: ReportCityMenuIds.MOVE_HOME,
			buttonLabel: i18n.t("commands:report.city.buttons.confirm", { lng }),
			buttonStyle: ButtonStyle.Success
		});
	}
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

/**
 * Handle a manage home menu selection.
 */
async function sendReactionByType(
	buttonInteraction: MessageComponentInteraction,
	packet: ReactionCollectorCreationPacket,
	context: PacketContext,
	reactionType: string
): Promise<void> {
	await buttonInteraction.deferReply();
	const reactionIndex = packet.reactions.findIndex(reaction => reaction.type === reactionType);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
	}
}

async function handleManageHomeCollectorInteraction(
	selectedValue: string,
	buttonInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<void> {
	const homeActionRoutes: Record<string, string> = {
		[ReportCityMenuIds.BUY_HOME]: ReactionCollectorCityBuyHomeReaction.name,
		[ReportCityMenuIds.UPGRADE_HOME]: ReactionCollectorCityUpgradeHomeReaction.name,
		[ReportCityMenuIds.MOVE_HOME]: ReactionCollectorCityMoveHomeReaction.name,
		[ReportCityMenuIds.GUILD_DOMAIN_CONFIRM]: ReactionCollectorGuildDomainNotaryReaction.name
	};

	if (homeActionRoutes[selectedValue]) {
		await sendReactionByType(buttonInteraction, packet, context, homeActionRoutes[selectedValue]);
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
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleManageHomeCollectorInteraction(customId, buttonInteraction, nestedMenus, context, packet);
	});
}

export function getManageHomeMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const cityData = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.homes.notaryTitle", {
				lng, pseudo
			})}`
		)
	);

	addPersonalNotarySection(container, cityData.home.manage, lng);
	addGuildNotarySection(container, cityData.guildDomainNotary, lng);
	addNotaryNavigation(container, lng);

	return {
		containers: [container],
		createCollector: createManageHomeMenuCollector(context, interaction, packet, collectorTime)
	};
}
