import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle,
	parseEmoji
} from "discord.js";
import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandEquipPacketReq, CommandEquipActionReq, CommandEquipActionRes, EquipCategoryData
} from "../../../../Lib/src/packets/commands/CommandEquipPacket";
import {
	CrowniclesNestedMenus, CrowniclesNestedMenu, CrowniclesNestedMenuCollector
} from "../../messages/CrowniclesNestedMenus";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { DiscordConstants } from "../../DiscordConstants";
import { DiscordMQTT } from "../../bot/DiscordMQTT";
import { PacketUtils } from "../../utils/PacketUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorEquipData, ReactionCollectorEquipCloseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorEquip";
import {
	ReactionCollectorResetTimerPacketReq
} from "../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { ItemWithDetails } from "../../../../Lib/src/types/ItemWithDetails";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { Language } from "../../../../Lib/src/Language";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";

/*
 * =============================================
 * Constants
 * =============================================
 */

const CATEGORY_INFO = [
	{
		category: ItemCategory.WEAPON, translationKey: "weapons", emoji: "⚔️"
	},
	{
		category: ItemCategory.ARMOR, translationKey: "armors", emoji: "🛡️"
	},
	{
		category: ItemCategory.POTION, translationKey: "potions", emoji: "🧪"
	},
	{
		category: ItemCategory.OBJECT, translationKey: "objects", emoji: "📦"
	}
];

const EQUIP_MENU_IDS = {
	MAIN: "EQUIP_MAIN",
	CATEGORY_PREFIX: "EQUIP_CAT_",
	CATEGORY_DETAIL_PREFIX: "EQUIP_DETAIL_",
	EQUIP_PREFIX: "EQUIP_ITEM_",
	DEPOSIT_PREFIX: "EQUIP_DEPOSIT_",
	BACK_TO_CATEGORIES: "EQUIP_BACK_CATS",
	CLOSE: "EQUIP_CLOSE"
} as const;

/*
 * =============================================
 * Context for the equip menu
 * =============================================
 */

interface EquipMenuContext {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	lng: Language;
	pseudo: string;
	collectorTime: number;
	collectorId: string;
	categories: EquipCategoryData[];
	packet: ReactionCollectorCreationPacket;
	closeReactionIndex: number;
}

/*
 * =============================================
 * Slash command setup
 * =============================================
 */

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandEquipPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandEquipPacketReq, {});
}

/*
 * =============================================
 * Item display helpers
 * =============================================
 */

function withUnlimitedMaxValue(details: ItemWithDetails, category: ItemCategory): ItemWithDetails {
	if (category === ItemCategory.WEAPON || category === ItemCategory.ARMOR) {
		const mainDetails = details as MainItemDetails;
		return {
			...mainDetails,
			attack: {
				...mainDetails.attack, maxValue: Infinity
			},
			defense: {
				...mainDetails.defense, maxValue: Infinity
			},
			speed: {
				...mainDetails.speed, maxValue: Infinity
			}
		};
	}
	return details;
}

/*
 * =============================================
 * Main menu builder
 * =============================================
 */

function buildMainMenu(ctx: EquipMenuContext): CrowniclesNestedMenu {
	const buttons: ButtonBuilder[] = [];

	for (let i = 0; i < CATEGORY_INFO.length; i++) {
		const catInfo = CATEGORY_INFO[i];
		const categoryData = ctx.categories.find(c => c.category === catInfo.category);
		if (!categoryData) {
			continue;
		}

		const itemCount = (categoryData.equippedItem ? 1 : 0) + categoryData.reserveItems.length;
		buttons.push(
			new ButtonBuilder()
				.setCustomId(`${EQUIP_MENU_IDS.CATEGORY_PREFIX}${i}`)
				.setLabel(`${i18n.t(`commands:equip.categories.${catInfo.translationKey}`, { lng: ctx.lng })} (${itemCount})`)
				.setEmoji(catInfo.emoji)
				.setStyle(ButtonStyle.Primary)
		);
	}

	buttons.push(
		new ButtonBuilder()
			.setCustomId(EQUIP_MENU_IDS.CLOSE)
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setStyle(ButtonStyle.Secondary)
	);

	return {
		embed: new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:equip.title", {
				lng: ctx.lng, pseudo: ctx.pseudo
			}), ctx.interaction.user)
			.setDescription(i18n.t("commands:equip.mainDescription", { lng: ctx.lng })),
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });
			collector.on("collect", async interaction => {
				if (interaction.user.id !== ctx.interaction.user.id) {
					const { sendInteractionNotForYou } = await import("../../utils/ErrorUtils");
					await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
					return;
				}

				if (!interaction.isButton()) {
					return;
				}

				const value = interaction.customId;

				if (value === EQUIP_MENU_IDS.CLOSE) {
					await interaction.deferUpdate();
					DiscordCollectorUtils.sendReaction(
						ctx.packet, ctx.context, ctx.context.keycloakId!, interaction, ctx.closeReactionIndex
					);
					return;
				}

				if (value.startsWith(EQUIP_MENU_IDS.CATEGORY_PREFIX)) {
					const categoryIndex = parseInt(value.replace(EQUIP_MENU_IDS.CATEGORY_PREFIX, ""), 10);
					if (!Number.isNaN(categoryIndex)) {
						await interaction.deferUpdate();
						await registerCategoryMenu(ctx, categoryIndex, nestedMenus);
						await nestedMenus.changeMenu(`${EQUIP_MENU_IDS.CATEGORY_DETAIL_PREFIX}${categoryIndex}`);
					}
				}
			});
			return collector;
		}
	};
}

/*
 * =============================================
 * Category detail menu builder
 * =============================================
 */

function registerCategoryMenu(
	ctx: EquipMenuContext,
	categoryIndex: number,
	nestedMenus: CrowniclesNestedMenus
): void {
	const catInfo = CATEGORY_INFO[categoryIndex];
	const categoryData = ctx.categories.find(c => c.category === catInfo.category);
	if (!categoryData) {
		return;
	}

	const menuId = `${EQUIP_MENU_IDS.CATEGORY_DETAIL_PREFIX}${categoryIndex}`;
	let choiceIndex = 0;
	const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

	let description = i18n.t("commands:equip.categoryHeader", {
		lng: ctx.lng,
		category: i18n.t(`commands:equip.categories.${catInfo.translationKey}`, { lng: ctx.lng })
	});

	// Equipped item section
	description += `\n\n${i18n.t("commands:equip.equippedSection", { lng: ctx.lng })}`;
	if (categoryData.equippedItem) {
		const details = withUnlimitedMaxValue(categoryData.equippedItem.details, catInfo.category);
		const itemDisplay = DisplayUtils.getItemDisplayWithStats(details, ctx.lng);
		description += `\n${DiscordConstants.CHOICE_EMOTES[choiceIndex]} - ${itemDisplay}`;

		// Deposit button — only if there's room in reserve
		const canDeposit = categoryData.reserveItems.length < categoryData.maxReserveSlots;
		const button = new ButtonBuilder()
			.setEmoji(parseEmoji(DiscordConstants.CHOICE_EMOTES[choiceIndex])!)
			.setCustomId(`${EQUIP_MENU_IDS.DEPOSIT_PREFIX}${catInfo.category}`)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(!canDeposit);

		rows[rows.length - 1].addComponents(button);
		choiceIndex++;

		if (!canDeposit) {
			description += ` *(${i18n.t("commands:equip.reserveFull", { lng: ctx.lng })})*`;
		}
	}
	else {
		description += `\n*${i18n.t("commands:equip.noEquippedItem", { lng: ctx.lng })}*`;
	}

	// Reserve items section
	description += `\n\n${i18n.t("commands:equip.reserveSection", {
		lng: ctx.lng,
		count: categoryData.reserveItems.length,
		max: categoryData.maxReserveSlots
	})}`;

	for (const item of categoryData.reserveItems) {
		if (choiceIndex >= DiscordConstants.CHOICE_EMOTES.length) {
			break;
		}

		const details = withUnlimitedMaxValue(item.details, catInfo.category);
		const itemDisplay = DisplayUtils.getItemDisplayWithStats(details, ctx.lng);
		description += `\n${DiscordConstants.CHOICE_EMOTES[choiceIndex]} - ${itemDisplay}`;

		const button = new ButtonBuilder()
			.setEmoji(parseEmoji(DiscordConstants.CHOICE_EMOTES[choiceIndex])!)
			.setCustomId(`${EQUIP_MENU_IDS.EQUIP_PREFIX}${catInfo.category}_${item.slot}`)
			.setStyle(ButtonStyle.Secondary);

		if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
			rows.push(new ActionRowBuilder<ButtonBuilder>());
		}
		rows[rows.length - 1].addComponents(button);
		choiceIndex++;
	}

	if (categoryData.reserveItems.length === 0) {
		description += `\n*${i18n.t("commands:equip.noReserveItems", { lng: ctx.lng })}*`;
	}

	// Back button
	const backButton = new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
		.setCustomId(EQUIP_MENU_IDS.BACK_TO_CATEGORIES)
		.setStyle(ButtonStyle.Secondary);

	if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
		rows.push(new ActionRowBuilder<ButtonBuilder>());
	}
	rows[rows.length - 1].addComponents(backButton);

	nestedMenus.registerMenu(menuId, {
		embed: new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:equip.title", {
				lng: ctx.lng, pseudo: ctx.pseudo
			}), ctx.interaction.user)
			.setDescription(description),
		components: rows,
		createCollector: (menus, message) => {
			const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });
			collector.on("collect", async interaction => {
				if (interaction.user.id !== ctx.interaction.user.id) {
					const { sendInteractionNotForYou } = await import("../../utils/ErrorUtils");
					await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
					return;
				}

				if (!interaction.isButton()) {
					return;
				}

				const value = interaction.customId;

				if (value === EQUIP_MENU_IDS.BACK_TO_CATEGORIES) {
					await interaction.deferUpdate();
					refreshMainMenu(ctx, menus);
					await menus.changeToMainMenu();
					return;
				}

				if (value.startsWith(EQUIP_MENU_IDS.EQUIP_PREFIX)) {
					const parts = value.replace(EQUIP_MENU_IDS.EQUIP_PREFIX, "").split("_");
					const category = parseInt(parts[0], 10) as ItemCategory;
					const slot = parseInt(parts[1], 10);
					await interaction.deferUpdate();
					await sendEquipAction({
						ctx, action: "equip", itemCategory: category, slot, categoryIndex, nestedMenus: menus
					});
					return;
				}

				if (value.startsWith(EQUIP_MENU_IDS.DEPOSIT_PREFIX)) {
					const category = parseInt(value.replace(EQUIP_MENU_IDS.DEPOSIT_PREFIX, ""), 10) as ItemCategory;
					await interaction.deferUpdate();
					await sendEquipAction({
						ctx, action: "deposit", itemCategory: category, slot: 0, categoryIndex, nestedMenus: menus
					});
				}
			});
			return collector;
		}
	});
}

/*
 * =============================================
 * AsyncPacketSender for actions
 * =============================================
 */

interface EquipActionParams {
	ctx: EquipMenuContext;
	action: string;
	itemCategory: ItemCategory;
	slot: number;
	categoryIndex: number;
	nestedMenus: CrowniclesNestedMenus;
}

async function sendEquipAction({
	ctx,
	action,
	itemCategory,
	slot,
	categoryIndex,
	nestedMenus
}: EquipActionParams): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		makePacket(CommandEquipActionReq, {
			action, itemCategory, slot
		}),
		async (_responseContext, _packetName, responsePacket) => {
			const response = responsePacket as unknown as CommandEquipActionRes;

			if (!response.success) {
				return;
			}

			// Update categories in context
			ctx.categories = response.categories;

			// Refresh the main menu (category buttons with updated counts)
			refreshMainMenu(ctx, nestedMenus);

			// Refresh the category detail view
			registerCategoryMenu(ctx, categoryIndex, nestedMenus);
			await nestedMenus.changeMenu(`${EQUIP_MENU_IDS.CATEGORY_DETAIL_PREFIX}${categoryIndex}`);
		}
	);
}

/*
 * =============================================
 * Menu refresh helpers
 * =============================================
 */

function refreshMainMenu(ctx: EquipMenuContext, nestedMenus: CrowniclesNestedMenus): void {
	const mainMenu = buildMainMenu(ctx);

	/*
	 * Re-register the main menu by accessing it through changeToMainMenu's internal state
	 * We need to rebuild and re-register instead
	 */
	nestedMenus.registerMenu(EQUIP_MENU_IDS.MAIN, mainMenu);
}

/*
 * =============================================
 * Collector entry point
 * =============================================
 */

export async function equipCollector(
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}

	const collectorTime = packet.endTime - Date.now();
	const pseudo = await DisplayUtils.getEscapedUsername(context.keycloakId!, interaction.userLanguage);
	const equipData = packet.data.data as ReactionCollectorEquipData;
	const closeReactionIndex = packet.reactions.findIndex(
		reaction => reaction.type === ReactionCollectorEquipCloseReaction.name
	);

	const ctx: EquipMenuContext = {
		context,
		interaction,
		lng: interaction.userLanguage,
		pseudo,
		collectorTime,
		collectorId: packet.id,
		categories: equipData.categories,
		packet,
		closeReactionIndex
	};

	const mainMenu = buildMainMenu(ctx);
	const menus = new Map<string, CrowniclesNestedMenu>();

	const nestedMenus = new CrowniclesNestedMenus(
		mainMenu,
		menus,
		() => {
			PacketUtils.sendPacketToBackend(context, makePacket(
				ReactionCollectorResetTimerPacketReq,
				{ reactionCollectorId: packet.id }
			));
		}
	);

	const msg = await nestedMenus.send(interaction);

	// Dummy collector to sync lifecycle with backend
	const dummyCollector = msg.createReactionCollector();
	dummyCollector.on("end", async () => {
		await nestedMenus.stopCurrentCollector();
		await interaction.followUp({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("commands:equip.closeTitle", {
						lng: ctx.lng, pseudo
					}), interaction.user)
					.setDescription(i18n.t("commands:equip.closeDescription", { lng: ctx.lng }))
			]
		});
	});

	return [dummyCollector];
}

/*
 * =============================================
 * Command export
 * =============================================
 */

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("equip"),
	getPacket,
	mainGuildCommand: false
};
