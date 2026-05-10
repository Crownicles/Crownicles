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
import { PetFood } from "../../../../../../Lib/src/constants/PetConstants";
import {
	createCityCollector, createStayInCityButton, handleStayInCityInteraction
} from "../ReportCityMenu";
import {
	buildShopBody, buildShopQuantityContainer, buildShopReimburseContainer
} from "../guildDomain/GuildDomainViews";
import {
	FoodShopUIContext, FoodKey, PET_FOOD_TO_KEY
} from "../guildDomain/GuildDomainShared";

import {
	finishReportWithErrorEmbed, finishReportWithMessage
} from "../ReportFlowHelpers";

type CityCollectorFactory = ReturnType<typeof createCityCollector>;

type FoodShopData = ReactionCollectorCityData["guildFoodShop"] & object & {
	pendingReimburseAmount?: number;

	/** Recap of the food purchase that triggered the pending reimbursement (used to build a final summary message) */
	pendingPurchaseRecap?: string;
};

interface FoodShopMenuContext {
	data: FoodShopData;
	lng: Language;
	pseudo: string;
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
}

function toUIContext(ctx: FoodShopMenuContext): FoodShopUIContext {
	return {
		data: ctx.data,
		lng: ctx.lng
	};
}

/**
 * Build the standalone food shop main container.
 * Visually mirrors the guild domain shop submenu (description + stock + food choice buttons),
 * but without the treasury deposit button. Adds a city navigation footer.
 */
function buildFoodShopMainContainer(ctx: FoodShopMenuContext): ContainerBuilder {
	const {
		data, lng, pseudo
	} = ctx;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.guildFoodShop.menuTitle", {
				lng, pseudo, guildName: data.guildName
			})}`
		)
	);

	buildShopBody(container, toUIContext(ctx), {
		withTreasuryButton: false,
		descriptionKey: "commands:report.city.guildFoodShop.menuDescription"
	});

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
	const foodKey: FoodKey = PET_FOOD_TO_KEY[res.foodType];
	data.food[foodKey] = res.newFoodStock;
	data.treasury = res.newTreasury;
	data.pendingReimburseAmount = res.totalCost;
}

function buildBuySuccessRecap(res: CommandReportFoodShopBuyRes, lng: Language): string {
	return i18n.t("commands:report.city.guildDomain.subMenus.shop.buyFoodSuccess", {
		lng,
		amount: res.amountBought,
		food: i18n.t(`models:foods.${res.foodType}`, {
			lng, count: res.amountBought
		}),
		foodType: res.foodType,
		totalCost: res.totalCost
	});
}

/**
 * Reply with a final message and end the report (mirrors the cooking pattern).
 * Used after reimburse / decline, so the player runs /rapport again to get a fresh state.
 */
async function showQuantityMenu(ctx: FoodShopMenuContext, nestedMenus: CrowniclesNestedMenus, foodType: PetFood): Promise<void> {
	nestedMenus.registerMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU, {
		containers: [buildShopQuantityContainer(toUIContext(ctx), foodType)],
		createCollector: createQuantityCollector(ctx)
	});
	await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU);
}

async function showReimburseMenu(ctx: FoodShopMenuContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
	nestedMenus.registerMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_MENU, {
		containers: [buildShopReimburseContainer(toUIContext(ctx))],
		createCollector: createReimburseCollector(ctx)
	});
	await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_MENU);
}

async function handleFoodBuy(ctx: FoodShopMenuContext, foodType: PetFood, amount: number, nestedMenus: CrowniclesNestedMenus): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		makePacket(CommandReportFoodShopBuyReq, {
			foodType, amount
		}),
		async (_responseContext, packetName, responsePacket) => {
			if (packetName === CommandReportFoodShopBuyRes.name) {
				const res = responsePacket as unknown as CommandReportFoodShopBuyRes;
				applyBuyResult(ctx.data, res);
				ctx.data.pendingPurchaseRecap = buildBuySuccessRecap(res, ctx.lng);
				await showReimburseMenu(ctx, nestedMenus);
			}
			else {
				// Buy failed (e.g., another member just drained the treasury): end the report with a clear error.
				finishReportWithErrorEmbed(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.subMenus.shop.buyFoodError", { lng: ctx.lng }));
			}
		}
	);
}

async function handleReimburse(ctx: FoodShopMenuContext, amount: number, nestedMenus: CrowniclesNestedMenus): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		makePacket(CommandReportGuildDomainDepositTreasuryReq, {
			amount, isReimburse: true
		}),
		(_responseContext, packetName, responsePacket) => {
			if (packetName === CommandReportGuildDomainDepositTreasuryRes.name) {
				const res = responsePacket as unknown as CommandReportGuildDomainDepositTreasuryRes;
				ctx.data.playerMoney = res.newPlayerMoney;
				ctx.data.treasury = res.newTreasury;
				ctx.data.pendingReimburseAmount = undefined;
				const successMessage = i18n.t("commands:report.city.guildDomain.subMenus.shop.reimburseSuccess", {
					lng: ctx.lng, treasury: res.treasuryDeposited
				});
				const recap = ctx.data.pendingPurchaseRecap;
				ctx.data.pendingPurchaseRecap = undefined;
				finishReportWithMessage(ctx, nestedMenus, recap ? `${recap}\n\n${successMessage}` : successMessage);
			}
			else {
				finishReportWithErrorEmbed(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.subMenus.shop.depositTreasuryError", { lng: ctx.lng }));
			}
		}
	);
}

function createMainCollector(ctx: FoodShopMenuContext): CityCollectorFactory {
	return createCityCollector(ctx.interaction, ctx.collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await buttonInteraction.deferUpdate();

		if (customId === ReportCityMenuIds.BACK_TO_CITY) {
			await nestedMenus.changeToMainMenu();
			return;
		}
		if (customId === ReportCityMenuIds.STAY_IN_CITY) {
			handleStayInCityInteraction(ctx.packet, ctx.context, buttonInteraction);
			return;
		}
		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_OPEN_PREFIX)) {
			const foodType = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_OPEN_PREFIX, "") as PetFood;
			await showQuantityMenu(ctx, nestedMenus, foodType);
		}
	});
}

function createQuantityCollector(ctx: FoodShopMenuContext): CityCollectorFactory {
	return createCityCollector(ctx.interaction, ctx.collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await buttonInteraction.deferUpdate();

		if (customId === ReportCityMenuIds.STAY_IN_CITY) {
			handleStayInCityInteraction(ctx.packet, ctx.context, buttonInteraction);
			return;
		}
		if (customId === ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_CANCEL) {
			await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_FOOD_SHOP_MENU);
			return;
		}
		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX)) {
			const parts = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX, "").split("_");
			const foodType = parts[0] as PetFood;
			const amount = parseInt(parts[1], 10);
			await handleFoodBuy(ctx, foodType, amount, nestedMenus);
		}
	});
}

function createReimburseCollector(ctx: FoodShopMenuContext): CityCollectorFactory {
	return createCityCollector(ctx.interaction, ctx.collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await buttonInteraction.deferUpdate();

		if (customId === ReportCityMenuIds.STAY_IN_CITY) {
			handleStayInCityInteraction(ctx.packet, ctx.context, buttonInteraction);
			return;
		}
		if (customId === ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_DECLINE) {
			ctx.data.pendingReimburseAmount = undefined;
			const declineMessage = i18n.t("commands:report.city.guildDomain.subMenus.shop.reimburseDeclined", { lng: ctx.lng });
			const recap = ctx.data.pendingPurchaseRecap;
			ctx.data.pendingPurchaseRecap = undefined;
			finishReportWithMessage(ctx, nestedMenus, recap ? `${recap}\n\n${declineMessage}` : declineMessage);
			return;
		}
		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_PREFIX)) {
			const amount = parseInt(customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_PREFIX, ""), 10);
			await handleReimburse(ctx, amount, nestedMenus);
		}
	});
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
	const ctx: FoodShopMenuContext = {
		data,
		lng: interaction.userLanguage,
		pseudo,
		context,
		interaction,
		packet,
		collectorTime
	};

	return {
		containers: [buildFoodShopMainContainer(ctx)],
		createCollector: createMainCollector(ctx)
	};
}

// (no end-of-file shims needed)
