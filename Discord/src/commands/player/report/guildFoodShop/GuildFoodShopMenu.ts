import {
	CrowniclesNestedMenu, CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder,
	SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { Language } from "../../../../../../Lib/src/Language";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { DiscordMQTT } from "../../../../bot/DiscordMQTT";
import {
	CommandReportFoodShopBuyReq,
	CommandReportFoodShopBuyRes,
	CommandReportGuildDomainDepositTreasuryReq,
	CommandReportGuildDomainDepositTreasuryRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { GuildDomainConstants } from "../../../../../../Lib/src/constants/GuildDomainConstants";
import {
	createCityCollector, createStayInCityButton, handleStayInCityInteraction
} from "../ReportCityMenu";

type FoodShopData = ReactionCollectorCityData["guildFoodShop"] & object & {
	pendingReimburseAmount?: number;
};
type FoodKey = "common" | "carnivorous" | "herbivorous" | "ultimate";

const FOOD_BUY_QUICK_PRESETS = [
	1,
	5,
	10
] as const;

function buildFoodShopBuyButtons(data: FoodShopData, lng: Language): ActionRowBuilder<ButtonBuilder>[] {
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];
	const foodTypes = PetConstants.PET_FOOD_BY_ID;

	for (let i = 0; i < foodTypes.length; i++) {
		const foodType = foodTypes[i];
		const foodKey = foodType.replace("Food", "") as FoodKey;
		const currentStock = data.food[foodKey];
		const cap = data.foodCaps[i];
		const remainingSlots = cap - currentStock;
		const price = GuildDomainConstants.SHOP_PRICES.FOOD[i];
		const maxAffordable = Math.floor(data.treasury / price);
		const maxBuyable = Math.min(remainingSlots, maxAffordable);

		if (maxBuyable <= 0) {
			continue;
		}

		const amounts = [
			...new Set([
				...FOOD_BUY_QUICK_PRESETS.map(preset => Math.min(preset, maxBuyable)),
				maxBuyable
			].filter(a => a > 0))
		];

		const row = new ActionRowBuilder<ButtonBuilder>();
		for (const amount of amounts) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`${ReportCityMenuIds.GUILD_FOOD_SHOP_BUY_PREFIX}${foodType}_${amount}`)
					.setLabel(i18n.t("commands:report.city.guildFoodShop.buyButton", {
						lng,
						amount,
						food: i18n.t(`models:foods.${foodType}`, {
							lng, count: amount
						}),
						cost: price * amount
					}))
					.setStyle(ButtonStyle.Primary)
			);
		}
		rows.push(row);
	}

	return rows;
}

interface FoodShopMenuParams {
	data: FoodShopData;
	lng: Language;
	pseudo: string;
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	nestedMenus: CrowniclesNestedMenus;
	statusMessage?: string;
}

function buildFoodShopContainer(data: FoodShopData, lng: Language, pseudo: string, statusMessage?: string): ContainerBuilder {
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.guildFoodShop.menuTitle", {
				lng, pseudo, guildName: data.guildName
			})}`
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildFoodShop.menuDescription", { lng })
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildFoodShop.stockInfo", {
				lng,
				common: data.food.common,
				commonCap: data.foodCaps[0],
				herbivorous: data.food.herbivorous,
				herbivorousCap: data.foodCaps[1],
				carnivorous: data.food.carnivorous,
				carnivorousCap: data.foodCaps[2],
				ultimate: data.food.ultimate,
				ultimateCap: data.foodCaps[3],
				playerMoney: data.playerMoney,
				treasury: data.treasury
			})
		)
	);

	if (statusMessage) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(statusMessage)
		);
	}

	const buyRows = buildFoodShopBuyButtons(data, lng);
	if (buyRows.length > 0) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.guildFoodShop.buyLabel", { lng })
			)
		);
		for (const row of buyRows) {
			container.addActionRowComponents(row);
		}
	}
	else {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.guildFoodShop.noFoodAvailable", { lng })
			)
		);
	}

	if (data.pendingReimburseAmount && data.pendingReimburseAmount > 0) {
		const pending = data.pendingReimburseAmount;
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.guildFoodShop.reimbursePrompt", {
					lng, cost: pending, treasury: pending
				})
			)
		);
		container.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`${ReportCityMenuIds.GUILD_FOOD_SHOP_REIMBURSE_PREFIX}${pending}`)
					.setLabel(i18n.t("commands:report.city.guildFoodShop.reimburseAccept", {
						lng, cost: pending, treasury: pending
					}))
					.setStyle(ButtonStyle.Success)
					.setDisabled(data.playerMoney < pending),
				new ButtonBuilder()
					.setCustomId(ReportCityMenuIds.GUILD_FOOD_SHOP_REIMBURSE_DECLINE)
					.setLabel(i18n.t("commands:report.city.guildFoodShop.reimburseDecline", { lng }))
					.setStyle(ButtonStyle.Danger)
			)
		);
	}

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.BACK_TO_CITY)
				.setLabel(i18n.t("commands:report.city.guildFoodShop.leaveShop", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(lng)
		)
	);

	return container;
}

function applyBuyResult(data: FoodShopData, res: CommandReportFoodShopBuyRes): void {
	const foodKey = res.foodType.replace("Food", "") as FoodKey;
	data.food[foodKey] = res.newFoodStock;
	data.treasury = res.newTreasury;
	data.pendingReimburseAmount = res.totalCost;
}

function buildBuySuccessMessage(res: CommandReportFoodShopBuyRes, lng: Language): string {
	return i18n.t("commands:report.city.guildFoodShop.buySuccess", {
		lng,
		amount: res.amountBought,
		food: i18n.t(`models:foods.${res.foodType}`, {
			lng, count: res.amountBought
		}),
		totalCost: res.totalCost
	});
}

function registerFoodShopMenu(params: FoodShopMenuParams): void {
	const {
		data, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus, statusMessage
	} = params;
	const container = buildFoodShopContainer(data, lng, pseudo, statusMessage);

	nestedMenus.registerMenu(ReportCityMenuIds.GUILD_FOOD_SHOP_MENU, {
		containers: [container],
		createCollector: createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, menus) => {
			if (customId === ReportCityMenuIds.BACK_TO_CITY) {
				await buttonInteraction.deferUpdate();
				await menus.changeToMainMenu();
				return;
			}
			if (customId === ReportCityMenuIds.STAY_IN_CITY) {
				await buttonInteraction.deferUpdate();
				handleStayInCityInteraction(packet, context, buttonInteraction);
				return;
			}

			if (customId.startsWith(ReportCityMenuIds.GUILD_FOOD_SHOP_BUY_PREFIX)) {
				await buttonInteraction.deferUpdate();
				await handleFoodShopBuy({
					customId, data, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus: menus
				});
				return;
			}

			if (customId === ReportCityMenuIds.GUILD_FOOD_SHOP_REIMBURSE_DECLINE) {
				await buttonInteraction.deferUpdate();
				data.pendingReimburseAmount = undefined;
				registerFoodShopMenu({
					data,
					lng,
					pseudo,
					context,
					interaction,
					packet,
					collectorTime,
					nestedMenus: menus,
					statusMessage: i18n.t("commands:report.city.guildFoodShop.reimburseDeclined", { lng })
				});
				await menus.changeMenu(ReportCityMenuIds.GUILD_FOOD_SHOP_MENU);
				return;
			}

			if (customId.startsWith(ReportCityMenuIds.GUILD_FOOD_SHOP_REIMBURSE_PREFIX)) {
				await buttonInteraction.deferUpdate();
				const amount = parseInt(customId.replace(ReportCityMenuIds.GUILD_FOOD_SHOP_REIMBURSE_PREFIX, ""), 10);
				await handleReimburse({
					data, amount, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus: menus
				});
			}
		})
	});
}

interface FoodShopBuyContext {
	customId: string;
	data: FoodShopData;
	lng: Language;
	pseudo: string;
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	nestedMenus: CrowniclesNestedMenus;
}

async function handleFoodShopBuy(buyContext: FoodShopBuyContext): Promise<void> {
	const {
		customId, data, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus
	} = buyContext;
	const parts = customId.replace(ReportCityMenuIds.GUILD_FOOD_SHOP_BUY_PREFIX, "").split("_");
	const foodType = parts[0];
	const amount = parseInt(parts[1], 10);

	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		context,
		makePacket(CommandReportFoodShopBuyReq, {
			foodType, amount
		}),
		async (_responseContext, packetName, responsePacket) => {
			const isSuccess = packetName === CommandReportFoodShopBuyRes.name;
			let statusMessage: string;
			if (isSuccess) {
				const res = responsePacket as unknown as CommandReportFoodShopBuyRes;
				applyBuyResult(data, res);
				statusMessage = buildBuySuccessMessage(res, lng);
			}
			else {
				statusMessage = i18n.t("commands:report.city.guildFoodShop.buyError", { lng });
			}
			registerFoodShopMenu({
				data, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus, statusMessage
			});
			await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_FOOD_SHOP_MENU);
		}
	);
}

interface ReimburseContext {
	data: FoodShopData;
	amount: number;
	lng: Language;
	pseudo: string;
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	nestedMenus: CrowniclesNestedMenus;
}

async function handleReimburse(reimburseContext: ReimburseContext): Promise<void> {
	const {
		data, amount, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus
	} = reimburseContext;

	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		context,
		makePacket(CommandReportGuildDomainDepositTreasuryReq, {
			amount, isReimburse: true
		}),
		async (_responseContext, packetName, responsePacket) => {
			const isSuccess = packetName === CommandReportGuildDomainDepositTreasuryRes.name;
			let statusMessage: string;
			if (isSuccess) {
				const res = responsePacket as unknown as CommandReportGuildDomainDepositTreasuryRes;
				data.playerMoney = res.newPlayerMoney;
				data.treasury = res.newTreasury;
				data.pendingReimburseAmount = undefined;
				statusMessage = i18n.t("commands:report.city.guildFoodShop.reimburseSuccess", {
					lng, amount, treasury: res.treasuryDeposited
				});
			}
			else {
				statusMessage = i18n.t("commands:report.city.guildFoodShop.reimburseError", { lng });
			}
			registerFoodShopMenu({
				data, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus, statusMessage
			});
			await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_FOOD_SHOP_MENU);
		}
	);
}

export interface GuildFoodShopMenuOptions {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	pseudo: string;
}

export function getGuildFoodShopMenu(options: GuildFoodShopMenuOptions): CrowniclesNestedMenu {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = options;
	const data = (packet.data.data as ReactionCollectorCityData).guildFoodShop! as FoodShopData;
	const lng = interaction.userLanguage;
	const container = buildFoodShopContainer(data, lng, pseudo);

	return {
		containers: [container],
		createCollector: createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
			if (customId === ReportCityMenuIds.BACK_TO_CITY) {
				await nestedMenus.changeToMainMenu();
				return;
			}
			if (customId === ReportCityMenuIds.STAY_IN_CITY) {
				handleStayInCityInteraction(packet, context, buttonInteraction);
				return;
			}

			if (customId.startsWith(ReportCityMenuIds.GUILD_FOOD_SHOP_BUY_PREFIX)) {
				await handleFoodShopBuy({
					customId, data, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus
				});
				return;
			}

			if (customId === ReportCityMenuIds.GUILD_FOOD_SHOP_REIMBURSE_DECLINE) {
				data.pendingReimburseAmount = undefined;
				registerFoodShopMenu({
					data,
					lng,
					pseudo,
					context,
					interaction,
					packet,
					collectorTime,
					nestedMenus,
					statusMessage: i18n.t("commands:report.city.guildFoodShop.reimburseDeclined", { lng })
				});
				await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_FOOD_SHOP_MENU);
				return;
			}

			if (customId.startsWith(ReportCityMenuIds.GUILD_FOOD_SHOP_REIMBURSE_PREFIX)) {
				const amount = parseInt(customId.replace(ReportCityMenuIds.GUILD_FOOD_SHOP_REIMBURSE_PREFIX, ""), 10);
				await handleReimburse({
					data, amount, lng, pseudo, context, interaction, packet, collectorTime, nestedMenus
				});
			}
		})
	};
}
