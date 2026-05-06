import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
	ContainerBuilder, Message,
	SeparatorBuilder, SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import i18n from "../../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	CrowniclesNestedMenuCollector, CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { createStayInCityButton } from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { Language } from "../../../../../../Lib/src/Language";
import {
	GuildBuilding, GuildDomainConstants
} from "../../../../../../Lib/src/constants/GuildDomainConstants";

export type GuildDomainData = ReactionCollectorCityData["guildDomain"] & object;

export interface GuildDomainMenuContext {
	data: GuildDomainData;
	lng: Language;
	pseudo: string;
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
}

export const BUILDING_MENU_IDS: Record<GuildBuilding, string> = {
	[GuildBuilding.SHOP]: ReportCityMenuIds.GUILD_DOMAIN_SHOP_MENU,
	[GuildBuilding.SHELTER]: ReportCityMenuIds.GUILD_DOMAIN_SHELTER_MENU,
	[GuildBuilding.PANTRY]: ReportCityMenuIds.GUILD_DOMAIN_PANTRY_MENU,
	[GuildBuilding.TRAINING_GROUND]: ReportCityMenuIds.GUILD_DOMAIN_TRAINING_MENU
};

export const BUILDING_ICONS: Record<GuildBuilding, string> = {
	[GuildBuilding.SHOP]: CrowniclesIcons.city.guildDomain.shop,
	[GuildBuilding.SHELTER]: CrowniclesIcons.city.guildDomain.shelter,
	[GuildBuilding.PANTRY]: CrowniclesIcons.city.guildDomain.pantry,
	[GuildBuilding.TRAINING_GROUND]: CrowniclesIcons.city.guildDomain.trainingGround
};

type BuildingLevelField = "shopLevel" | "shelterLevel" | "pantryLevel" | "trainingGroundLevel";

const BUILDING_LEVEL_FIELDS: Record<GuildBuilding, BuildingLevelField> = {
	[GuildBuilding.SHOP]: "shopLevel",
	[GuildBuilding.SHELTER]: "shelterLevel",
	[GuildBuilding.PANTRY]: "pantryLevel",
	[GuildBuilding.TRAINING_GROUND]: "trainingGroundLevel"
};

export function getBuildingLevel(data: GuildDomainData, building: GuildBuilding): number {
	return data[BUILDING_LEVEL_FIELDS[building]];
}

export function setBuildingLevel(data: GuildDomainData, building: GuildBuilding, level: number): void {
	data[BUILDING_LEVEL_FIELDS[building]] = level;
}

/**
 * Food keys aligned with PetConstants.PET_FOOD_BY_ID order: [common, herbivorous, carnivorous, ultimate]
 */
export const FOOD_KEYS: readonly ("common" | "herbivorous" | "carnivorous" | "ultimate")[] = [
	"common",
	"herbivorous",
	"carnivorous",
	"ultimate"
] as const;

export function createDomainCollector(
	ctx: GuildDomainMenuContext,
	handler: (customId: string, buttonInteraction: ButtonInteraction, nestedMenus: CrowniclesNestedMenus) => Promise<void>
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });

		collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== ctx.interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, ctx.lng);
				return;
			}

			await handler(buttonInteraction.customId, buttonInteraction, nestedMenus);
		});

		return collector;
	};
}

export function addDomainNavigation(container: ContainerBuilder, ctx: GuildDomainMenuContext, backLabel: string, backId: string): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(backId)
				.setLabel(backLabel)
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(ctx.lng)
		)
	);
}

export function addStatusMessage(container: ContainerBuilder, statusMessage?: string): void {
	if (statusMessage) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(statusMessage)
		);
	}
}

interface UpgradeTextArgs {
	lng: Language;
	currentLevel: number;
	upgradeCost: number;
	requiredGuildLevel: number | null;
	meetsLevel: boolean;
	canAfford: boolean;
}

function buildUpgradeText(args: UpgradeTextArgs): string {
	const {
		lng, currentLevel, upgradeCost, requiredGuildLevel, meetsLevel, canAfford
	} = args;
	let upgradeText = i18n.t("commands:report.city.guildDomain.buildingUpgrade", {
		lng, nextLevel: currentLevel + 1, cost: upgradeCost
	});
	if (!meetsLevel && requiredGuildLevel !== null) {
		upgradeText += i18n.t("commands:report.city.guildDomain.buildingUpgradeBlocked", {
			lng, required: requiredGuildLevel
		});
	}
	else if (!canAfford) {
		upgradeText += i18n.t("commands:report.city.guildDomain.buildingUpgradeTreasuryLow", { lng });
	}
	return upgradeText;
}

export function addUpgradeSection(container: ContainerBuilder, building: GuildBuilding, ctx: GuildDomainMenuContext): void {
	const {
		data, lng
	} = ctx;
	if (!data.isChief && !data.isElder) {
		return;
	}

	const currentLevel = getBuildingLevel(data, building);
	const upgradeCost = GuildDomainConstants.getBuildingUpgradeCost(building, currentLevel);

	if (upgradeCost === null) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.guildDomain.buildingMaxLevel", { lng })
			)
		);
		return;
	}

	const requiredGuildLevel = GuildDomainConstants.getBuildingRequiredGuildLevel(building, currentLevel);
	const canAfford = data.treasury >= upgradeCost;
	const meetsLevel = requiredGuildLevel === null || data.guildLevel >= requiredGuildLevel;

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(buildUpgradeText({
			lng, currentLevel, upgradeCost, requiredGuildLevel, meetsLevel, canAfford
		}))
	);

	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_UPGRADE_PREFIX}${building}`)
				.setLabel(i18n.t(`commands:report.city.guildDomain.upgradeBuilding.${building}`, {
					lng,
					cost: upgradeCost,
					level: currentLevel + 1
				}))
				.setStyle(ButtonStyle.Primary)
				.setDisabled(!canAfford || !meetsLevel)
		)
	);
}

export function getBuildingSummary(building: GuildBuilding, level: number, lng: Language): string {
	switch (building) {
		case GuildBuilding.SHOP:
			return level === 0
				? i18n.t("commands:report.city.guildDomain.buildingSummary.shop.locked", { lng })
				: i18n.t("commands:report.city.guildDomain.buildingSummary.shop.built", { lng });
		case GuildBuilding.SHELTER:
			return i18n.t("commands:report.city.guildDomain.buildingSummary.shelter", {
				lng,
				slots: GuildDomainConstants.getShelterSlots(level)
			});
		case GuildBuilding.PANTRY:
			return i18n.t("commands:report.city.guildDomain.buildingSummary.pantry", { lng });
		case GuildBuilding.TRAINING_GROUND: {
			const love = GuildDomainConstants.getTrainingLovePerDay(level);
			return love === 0
				? i18n.t("commands:report.city.guildDomain.buildingSummary.trainingGround.inactive", { lng })
				: i18n.t("commands:report.city.guildDomain.buildingSummary.trainingGround.active", {
					lng, love
				});
		}
		default:
			return "";
	}
}
