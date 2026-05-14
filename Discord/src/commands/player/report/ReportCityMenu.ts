import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../messages/CrowniclesNestedMenus";
import i18n from "../../../translations/i18n";
import { DisplayUtils } from "../../../utils/DisplayUtils";
import { CrowniclesInteraction } from "../../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	MessageComponentInteraction, SectionBuilder,
	TextDisplayBuilder
} from "discord.js";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import {
	ReactionCollectorCreationPacket,
	ReactionCollectorRefuseReaction
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { sendInteractionNotForYou } from "../../../utils/ErrorUtils";
import { DiscordCollectorUtils } from "../../../utils/DiscordCollectorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../../packetHandlers/handlers/ReactionCollectorHandlers";
import { PacketUtils } from "../../../utils/PacketUtils";
import { ReactionCollectorResetTimerPacketReq } from "../../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { Language } from "../../../../../Lib/src/Language";
import {
	getHomeMenu, getHomeSubMenus, HomeMenuIds
} from "./home";
import { HomeMenuParams } from "./home/HomeMenuTypes";
import { getBlacksmithMenus } from "./blacksmith/BlacksmithMenu";
import { ReportCityMenuIds } from "./ReportCityMenuConstants";
import {
	getGuildDomainMenu, getGuildDomainSubMenus
} from "./guildDomain/GuildDomainMenu";
import { getGuildFoodShopMenu } from "./guildFoodShop/GuildFoodShopMenu";
import { getMainMenu } from "./cityMenu/MainMenu";
import { getInnMenu } from "./cityMenu/InnMenu";
import { getEnchanterMenu } from "./cityMenu/EnchanterMenu";
import { getManageHomeMenu } from "./cityMenu/NotaryMenu";

type CityCollectorHandler = (
	customId: string,
	buttonInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus
) => Promise<void>;

/**
 * Creates a standard collector factory for city sub-menus.
 * Handles user ID validation and routes button interactions to the provided handler.
 */
export function createCityCollector(
	interaction: CrowniclesInteraction,
	collectorTime: number,
	handler: CityCollectorHandler
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const lng = interaction.userLanguage;

	return (nestedMenus, message) => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });

		collector.on("collect", async (buttonInteraction: MessageComponentInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			await handler(buttonInteraction.customId, buttonInteraction, nestedMenus);
		});

		return collector;
	};
}

type AddCitySectionBaseParams = {
	container: ContainerBuilder;
	customId: string;
	buttonLabel: string;
	buttonStyle?: ButtonStyle;
	disabled?: boolean;
};

type AddCitySectionWithTitle = AddCitySectionBaseParams & {
	emote: string;
	title: string;
	description?: string;
};

type AddCitySectionWithText = AddCitySectionBaseParams & {
	text: string;
	emoji?: string;
};

export type AddCitySectionParams = AddCitySectionWithTitle | AddCitySectionWithText;

export function addCitySection(params: AddCitySectionParams): void {
	let text: string;
	let emoji: string | undefined;

	if ("title" in params) {
		text = params.description
			? `${params.emote} **${params.title}**\n${params.description}`
			: `${params.emote} **${params.title}**`;
		emoji = params.emote;
	}
	else {
		text = params.text;
		emoji = params.emoji;
	}

	const button = new ButtonBuilder()
		.setCustomId(params.customId)
		.setLabel(params.buttonLabel)
		.setStyle(params.buttonStyle ?? ButtonStyle.Secondary)
		.setDisabled(params.disabled ?? false);

	if (emoji) {
		button.setEmoji(emoji);
	}

	params.container.addSectionComponents(
		new SectionBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
			.setButtonAccessory(button)
	);
}

/**
 * Create a "stay in city" button for use in sub-menu action rows
 */
export function createStayInCityButton(lng: Language): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(ReportCityMenuIds.STAY_IN_CITY)
		.setLabel(i18n.t("commands:report.city.reactions.stay.label", { lng }))
		.setEmoji(CrowniclesIcons.city.stay)
		.setStyle(ButtonStyle.Secondary);
}

/**
 * Handle the "stay in city" button click from any sub-menu.
 * Sends the refuse reaction to end the city interaction.
 */
export function handleStayInCityInteraction(
	packet: ReactionCollectorCreationPacket,
	context: PacketContext,
	componentInteraction: MessageComponentInteraction | null
): void {
	const reactionIndex = packet.reactions.findIndex(
		reaction => reaction.type === ReactionCollectorRefuseReaction.name
	);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, reactionIndex);
	}
}

/**
 * Whether the manage home (notary) menu should be displayed.
 */
export function shouldShowManageHomeMenu(cityData: ReactionCollectorCityData): boolean {
	return Boolean(cityData.home.manage) || Boolean(cityData.guildDomainNotary?.isChief);
}

/**
 * Build the city sub-menus (inns, enchanter, home, manage home)
 */
function addGuildDomainSubMenus(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.guildDomain?.isInCity) {
		return;
	}
	menus.set(ReportCityMenuIds.GUILD_DOMAIN_MENU, getGuildDomainMenu(params));
	for (const [key, menu] of getGuildDomainSubMenus(params)) {
		menus.set(key, menu);
	}
}

function addInnSubMenus(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	for (const inn of cityData.inns || []) {
		menus.set(`${ReportCityMenuIds.INN_PREFIX}${inn.innId}`, getInnMenu(params.context, params.interaction, params.packet, inn.innId, params.collectorTime, params.pseudo));
	}
}

function addEnchanterSubMenu(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.enchanter) {
		return;
	}
	menus.set(ReportCityMenuIds.ENCHANTER_MENU, getEnchanterMenu(params.context, params.interaction, params.packet, params.collectorTime, params.pseudo));
}

function addBlacksmithSubMenus(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.blacksmith) {
		return;
	}
	for (const [key, menu] of getBlacksmithMenus(params)) {
		menus.set(key, menu);
	}
}

function addHomeSubMenus(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.home.owned) {
		return;
	}
	menus.set(HomeMenuIds.HOME_MENU, getHomeMenu(params));
	for (const [key, menu] of getHomeSubMenus(params)) {
		menus.set(key, menu);
	}
}

function addManageHomeSubMenu(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!shouldShowManageHomeMenu(cityData)) {
		return;
	}
	menus.set(HomeMenuIds.MANAGE_HOME_MENU, getManageHomeMenu(params.context, params.interaction, params.packet, params.collectorTime, params.pseudo));
}

function addGuildFoodShopSubMenu(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.guildFoodShop) {
		return;
	}
	menus.set(ReportCityMenuIds.GUILD_FOOD_SHOP_MENU, getGuildFoodShopMenu(params));
}

function buildCitySubMenus(params: HomeMenuParams): Map<string, CrowniclesNestedMenu> {
	const menus = new Map<string, CrowniclesNestedMenu>();
	const cityData = params.packet.data.data as ReactionCollectorCityData;

	addInnSubMenus(menus, params, cityData);
	addEnchanterSubMenu(menus, params, cityData);
	addBlacksmithSubMenus(menus, params, cityData);
	addHomeSubMenus(menus, params, cityData);
	addManageHomeSubMenu(menus, params, cityData);
	addGuildDomainSubMenus(menus, params, cityData);
	addGuildFoodShopSubMenu(menus, params, cityData);

	return menus;
}

export class ReportCityMenu {
	public static async handleCityCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			throw new Error("Interaction not found");
		}
		const collectorTime = packet.endTime - Date.now();
		const pseudo = await DisplayUtils.getEscapedUsername(context.keycloakId!, interaction.userLanguage);
		const menuParams = {
			context, interaction, packet, collectorTime, pseudo
		};

		const menus = buildCitySubMenus(menuParams);

		const nestedMenus = new CrowniclesNestedMenus(
			getMainMenu(context, interaction, packet, collectorTime, pseudo),
			menus,
			() => {
				PacketUtils.sendPacketToBackend(context, makePacket(ReactionCollectorResetTimerPacketReq, { reactionCollectorId: packet.id }));
			}
		);
		const msg = await nestedMenus.send(interaction);

		// Auto-navigate to initial menu if specified (e.g., after chest deposit/withdraw)
		const cityData = packet.data.data as ReactionCollectorCityData;
		if (cityData.initialMenu && menus.has(cityData.initialMenu)) {
			await nestedMenus.changeMenu(cityData.initialMenu);
		}

		const dummyCollector = msg.createReactionCollector();
		dummyCollector.on("end", async () => {
			await nestedMenus.stopCurrentCollector();
		});

		return [dummyCollector];
	}
}
