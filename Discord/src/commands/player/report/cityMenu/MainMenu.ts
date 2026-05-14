import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	MessageComponentInteraction, SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityData,
	ReactionCollectorCityShopReaction,
	ReactionCollectorExitCityReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	ReactionCollectorCreationPacket,
	ReactionCollectorRefuseReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import {
	asMilliseconds, millisecondsToSeconds
} from "../../../../../../Lib/src/utils/TimeUtils";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import i18n from "../../../../translations/i18n";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { HomeMenuIds } from "../home";
import {
	addCitySection,
	createCityCollector,
	shouldShowManageHomeMenu
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { ManageHomeData } from "../ReportCityMenuTypes";

function getManageHomeMenuOptionDescription(manage: ManageHomeData, lng: Language): string {
	if (manage.newPrice) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionNew", { lng });
	}
	if (manage.upgrade) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionUpgrade", { lng });
	}
	if (manage.movePrice) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionMove", { lng });
	}
	if (manage.isMaxLevel) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionMaxLevel", { lng });
	}
	if (manage.requiredPlayerLevelForUpgrade) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionLevelRequired", {
			lng,
			level: manage.requiredPlayerLevelForUpgrade
		});
	}
	return i18n.t("commands:report.city.homes.manageHomeDescriptionUnavailable", { lng });
}

function shouldShowHomeSection(data: ReactionCollectorCityData): boolean {
	return Boolean(data.home.owned) || shouldShowManageHomeMenu(data);
}

function addHomeSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!shouldShowHomeSection(data)) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	if (data.home.owned) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.home[data.home.owned.level],
			title: i18n.t("commands:report.city.homes.goToOwnedHome", { lng }),
			description: i18n.t("commands:report.city.homes.goToOwnedHomeDescription", { lng }),
			customId: HomeMenuIds.HOME_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.goHome", { lng }),
			buttonStyle: ButtonStyle.Primary
		});
	}

	if (shouldShowManageHomeMenu(data)) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.manageHome,
			title: i18n.t("commands:report.city.homes.manageHome", { lng }),
			description: data.home.manage ? getManageHomeMenuOptionDescription(data.home.manage, lng) : undefined,
			customId: HomeMenuIds.MANAGE_HOME_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.seeNotary", { lng })
		});
	}
}

function addServicesSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.blacksmith && !data.enchanter) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	if (data.blacksmith) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.blacksmith.menu,
			title: i18n.t("commands:report.city.blacksmith.menuLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.menuDescription", { lng }),
			customId: ReportCityMenuIds.BLACKSMITH_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.enterForge", { lng })
		});
	}

	if (data.enchanter) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.enchanter,
			title: i18n.t("commands:report.city.reactions.enchanter.label", { lng }),
			description: i18n.t("commands:report.city.reactions.enchanter.description", { lng }),
			customId: ReportCityMenuIds.ENCHANTER_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.talkToEnchanter", { lng })
		});
	}
}

function addShopsSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.shops || data.shops.length === 0) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	for (const shop of data.shops) {
		const shopEmoji = CrowniclesIcons.city.shops[shop.shopId] ?? CrowniclesIcons.city.shops.generalShop;
		addCitySection({
			container,
			emote: shopEmoji,
			title: i18n.t(`commands:report.city.shops.${shop.shopId}.label`, { lng }),
			description: shop.isEmpty
				? i18n.t("commands:report.city.shopEmptyDescription", { lng })
				: i18n.t(`commands:report.city.shops.${shop.shopId}.description`, { lng }),
			customId: `${ReportCityMenuIds.CITY_SHOP_PREFIX}${shop.shopId}`,
			buttonLabel: i18n.t("commands:report.city.buttons.browseShop", { lng }),
			disabled: shop.isEmpty
		});
	}
}

function addInnsSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.inns || data.inns.length === 0) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	for (const inn of data.inns) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.inn,
			title: i18n.t("commands:report.city.reactions.inn.label", {
				lng, innId: inn.innId
			}),
			description: i18n.t("commands:report.city.reactions.inn.description", { lng }),
			customId: `${ReportCityMenuIds.MAIN_MENU_INN_PREFIX}${inn.innId}`,
			buttonLabel: i18n.t("commands:report.city.buttons.sitDown", { lng })
		});
	}
}

function addGuildDomainSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.guildDomain?.isInCity) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	addCitySection({
		container,
		emote: CrowniclesIcons.city.guildDomain.menu,
		title: i18n.t("commands:report.city.guildDomain.label", { lng }),
		description: i18n.t("commands:report.city.guildDomain.description", {
			lng,
			guildName: data.guildDomain.guildName
		}),
		customId: ReportCityMenuIds.GUILD_DOMAIN_MENU,
		buttonLabel: i18n.t("commands:report.city.buttons.visitDomain", { lng }),
		buttonStyle: ButtonStyle.Primary
	});
}

function addGuildFoodShopSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.guildFoodShop) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	addCitySection({
		container,
		emote: CrowniclesIcons.expedition.food,
		title: i18n.t("commands:report.city.guildFoodShop.label", { lng }),
		description: i18n.t("commands:report.city.guildFoodShop.description", {
			lng,
			guildName: data.guildFoodShop.guildName
		}),
		customId: ReportCityMenuIds.GUILD_FOOD_SHOP_MENU,
		buttonLabel: i18n.t("commands:report.city.buttons.visitFoodShop", { lng }),
		buttonStyle: ButtonStyle.Secondary
	});
}

function addExitStayButtons(container: ContainerBuilder, packet: ReactionCollectorCreationPacket, lng: Language): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	const actionRow = new ActionRowBuilder<ButtonBuilder>();

	const reactionButtonMap: Record<string, () => ButtonBuilder> = {
		[ReactionCollectorExitCityReaction.name]: () => new ButtonBuilder()
			.setCustomId(ReportCityMenuIds.MAIN_MENU_EXIT_CITY)
			.setLabel(i18n.t("commands:report.city.reactions.exit.label", { lng }))
			.setEmoji(CrowniclesIcons.city.exit)
			.setStyle(ButtonStyle.Danger),
		[ReactionCollectorRefuseReaction.name]: () => new ButtonBuilder()
			.setCustomId(ReportCityMenuIds.MAIN_MENU_STAY_CITY)
			.setLabel(i18n.t("commands:report.city.reactions.stay.label", { lng }))
			.setEmoji(CrowniclesIcons.city.stay)
			.setStyle(ButtonStyle.Secondary)
	};

	for (const reaction of packet.reactions) {
		const buttonFactory = reactionButtonMap[reaction.type];
		if (buttonFactory) {
			actionRow.addComponents(buttonFactory());
		}
	}

	container.addActionRowComponents(actionRow);
}

async function handleMainMenuSelection(
	selectedValue: string,
	nestedMenus: CrowniclesNestedMenus,
	componentInteraction: MessageComponentInteraction,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<void> {
	// Simple navigation routes
	const navigationRoutes: Record<string, string> = {
		[ReportCityMenuIds.ENCHANTER_MENU]: ReportCityMenuIds.ENCHANTER_MENU,
		[HomeMenuIds.HOME_MENU]: HomeMenuIds.HOME_MENU,
		[HomeMenuIds.MANAGE_HOME_MENU]: HomeMenuIds.MANAGE_HOME_MENU,
		[ReportCityMenuIds.BLACKSMITH_MENU]: ReportCityMenuIds.BLACKSMITH_MENU,
		[ReportCityMenuIds.GUILD_DOMAIN_MENU]: ReportCityMenuIds.GUILD_DOMAIN_MENU,
		[ReportCityMenuIds.GUILD_FOOD_SHOP_MENU]: ReportCityMenuIds.GUILD_FOOD_SHOP_MENU
	};

	if (navigationRoutes[selectedValue]) {
		await nestedMenus.changeMenu(navigationRoutes[selectedValue]);
		return;
	}

	if (selectedValue.startsWith(ReportCityMenuIds.CITY_SHOP_PREFIX)) {
		const shopId = selectedValue.replace(ReportCityMenuIds.CITY_SHOP_PREFIX, "");
		const reactionIndex = packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorCityShopReaction.name
				&& (reaction.data as ReactionCollectorCityShopReaction).shopId === shopId
		);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, reactionIndex);
		}
		return;
	}

	if (selectedValue.startsWith(ReportCityMenuIds.MAIN_MENU_INN_PREFIX)) {
		const innId = selectedValue.replace(ReportCityMenuIds.MAIN_MENU_INN_PREFIX, "");
		await nestedMenus.changeMenu(`${ReportCityMenuIds.INN_PREFIX}${innId}`);
		return;
	}

	// Reaction-based actions
	const reactionRoutes: Record<string, string> = {
		[ReportCityMenuIds.MAIN_MENU_EXIT_CITY]: ReactionCollectorExitCityReaction.name,
		[ReportCityMenuIds.MAIN_MENU_STAY_CITY]: ReactionCollectorRefuseReaction.name
	};

	if (reactionRoutes[selectedValue]) {
		const reactionIndex = packet.reactions.findIndex(reaction => reaction.type === reactionRoutes[selectedValue]);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, reactionIndex);
		}
	}
}

function createMainMenuCollector(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await buttonInteraction.deferUpdate();
		await handleMainMenuSelection(customId, nestedMenus, buttonInteraction, context, packet);
	});
}

export function getMainMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;

	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.title", {
				lng, pseudo
			})}`
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.description", {
				lng,
				mapLocationId: data.mapLocationId,
				mapTypeId: data.mapTypeId,
				enterCityTimestamp: millisecondsToSeconds(asMilliseconds(data.enterCityTimestamp))
			})
		)
	);

	addHomeSection(container, data, lng);
	addServicesSection(container, data, lng);
	addShopsSection(container, data, lng);
	addInnsSection(container, data, lng);
	addGuildDomainSection(container, data, lng);
	addGuildFoodShopSection(container, data, lng);
	addExitStayButtons(container, packet, lng);

	return {
		containers: [container],
		createCollector: createMainMenuCollector(context, interaction, packet, collectorTime)
	};
}
