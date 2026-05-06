import {
	Message, MessageComponentInteraction
} from "discord.js";
import i18n from "../../../../translations/i18n";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenuCollector, CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import {
	handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	ReactionCollectorCreationPacket
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordMQTT } from "../../../../bot/DiscordMQTT";
import {
	CommandReportGuildDomainUpgradeReq,
	CommandReportGuildDomainUpgradeRes,
	CommandReportFoodShopBuyReq,
	CommandReportFoodShopBuyRes,
	CommandReportGuildDomainDepositTreasuryReq,
	CommandReportGuildDomainDepositTreasuryRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	GuildBuilding
} from "../../../../../../Lib/src/constants/GuildDomainConstants";
import { PetFood } from "../../../../../../Lib/src/constants/PetConstants";
import {
	BUILDING_MENU_IDS, createDomainCollector,
	GuildDomainMenuContext, setBuildingLevel
} from "./GuildDomainShared";
import {
	buildBuildingContainer, buildMainDomainContainer, buildShopQuantityContainer,
	buildShopReimburseContainer, buildShopTreasuryContainer
} from "./GuildDomainViews";
import {
	finishReportWithErrorEmbed, finishReportWithMessage
} from "../ReportFlowHelpers";

/**
 * Send a packet, then either run the success handler with a typed response
 * or finish the report with an error embed when the response packet doesn't match.
 * Centralises the boilerplate shared by handleUpgrade / handleFoodBuy / handleTreasuryDeposit.
 */
async function sendDomainAction<TRes>(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus,
	requestPacket: ReturnType<typeof makePacket>,
	expectedResponseName: string,
	errorTranslationKey: string,
	onSuccess: (res: TRes) => void | Promise<void>
): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		requestPacket,
		async (_responseContext, packetName, responsePacket) => {
			if (packetName === expectedResponseName) {
				await onSuccess(responsePacket as unknown as TRes);
			}
			else {
				finishReportWithErrorEmbed(ctx, nestedMenus, i18n.t(errorTranslationKey, { lng: ctx.lng }));
			}
		}
	);
}

async function handleUpgrade(
	ctx: GuildDomainMenuContext,
	building: GuildBuilding,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await sendDomainAction<CommandReportGuildDomainUpgradeRes>(
		ctx, nestedMenus,
		makePacket(CommandReportGuildDomainUpgradeReq, { building }),
		CommandReportGuildDomainUpgradeRes.name,
		"commands:report.city.guildDomain.upgradeError",
		res => {
			ctx.data.treasury = res.newTreasury;
			setBuildingLevel(ctx.data, res.building, res.newLevel);
			const buildingName = i18n.t(`commands:report.city.guildDomain.buildings.${res.building}`, { lng: ctx.lng });
			const successMessage = i18n.t("commands:report.city.guildDomain.upgradeSuccess", {
				lng: ctx.lng, building: buildingName, level: res.newLevel, xpGained: res.xpGained
			});
			finishReportWithMessage(ctx, nestedMenus, successMessage);
		}
	);
}

async function handleFoodBuy(
	ctx: GuildDomainMenuContext,
	foodType: PetFood,
	amount: number,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await sendDomainAction<CommandReportFoodShopBuyRes>(
		ctx, nestedMenus,
		makePacket(CommandReportFoodShopBuyReq, {
			foodType, amount
		}),
		CommandReportFoodShopBuyRes.name,
		"commands:report.city.guildDomain.subMenus.shop.buyFoodError",
		async res => {
			const foodKey = res.foodType.replace("Food", "") as keyof typeof ctx.data.food;
			ctx.data.food[foodKey] = res.newFoodStock;
			ctx.data.treasury = res.newTreasury;
			ctx.data.pendingReimburseAmount = res.totalCost;
			ctx.data.pendingPurchaseRecap = i18n.t("commands:report.city.guildDomain.subMenus.shop.buyFoodSuccess", {
				lng: ctx.lng,
				amount: res.amountBought,
				food: i18n.t(`models:foods.${res.foodType}`, {
					lng: ctx.lng, count: res.amountBought
				}),
				foodType: res.foodType,
				totalCost: res.totalCost
			});
			await showShopReimburseMenu(ctx, nestedMenus);
		}
	);
}

async function handleTreasuryDeposit(
	ctx: GuildDomainMenuContext,
	amount: number,
	nestedMenus: CrowniclesNestedMenus,
	isReimburse: boolean
): Promise<void> {
	await sendDomainAction<CommandReportGuildDomainDepositTreasuryRes>(
		ctx, nestedMenus,
		makePacket(CommandReportGuildDomainDepositTreasuryReq, {
			amount, isReimburse
		}),
		CommandReportGuildDomainDepositTreasuryRes.name,
		"commands:report.city.guildDomain.subMenus.shop.depositTreasuryError",
		res => {
			ctx.data.playerMoney = res.newPlayerMoney;
			ctx.data.treasury = res.newTreasury;
			if (isReimburse) {
				ctx.data.pendingReimburseAmount = undefined;
			}
			const successKey = isReimburse
				? "commands:report.city.guildDomain.subMenus.shop.reimburseSuccess"
				: "commands:report.city.guildDomain.subMenus.shop.depositTreasurySuccess";
			const successMessage = i18n.t(successKey, {
				lng: ctx.lng, treasury: res.treasuryDeposited
			});
			const recap = isReimburse ? ctx.data.pendingPurchaseRecap : undefined;
			ctx.data.pendingPurchaseRecap = undefined;
			finishReportWithMessage(ctx, nestedMenus, recap ? `${recap}\n\n${successMessage}` : successMessage);
		}
	);
}

function createMainMenuCollector(ctx: GuildDomainMenuContext): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollector(ctx, async (customId: string, buttonInteraction: MessageComponentInteraction, nestedMenus: CrowniclesNestedMenus) => {
		await buttonInteraction.deferUpdate();

		if (customId === ReportCityMenuIds.BACK_TO_CITY) {
			await nestedMenus.changeToMainMenu();
			return;
		}

		if (customId === ReportCityMenuIds.STAY_IN_CITY) {
			handleStayInCityInteraction(ctx.packet, ctx.context, buttonInteraction);
			return;
		}

		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_ENTER_PREFIX)) {
			const building = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_ENTER_PREFIX, "") as GuildBuilding;
			const menuId = BUILDING_MENU_IDS[building];
			if (menuId) {
				await nestedMenus.changeMenu(menuId);
			}
		}
	});
}

function createShopQuantityCollector(
	ctx: GuildDomainMenuContext
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollector(ctx, async (customId: string, buttonInteraction: MessageComponentInteraction, nestedMenus: CrowniclesNestedMenus) => {
		await buttonInteraction.deferUpdate();

		if (customId === ReportCityMenuIds.STAY_IN_CITY) {
			handleStayInCityInteraction(ctx.packet, ctx.context, buttonInteraction);
			return;
		}

		if (customId === ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_CANCEL) {
			await nestedMenus.changeMenu(BUILDING_MENU_IDS[GuildBuilding.SHOP]);
			return;
		}

		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX)) {
			const parts = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX, "").split("_");
			const foodType = parts[0] as PetFood;
			const amount = parseInt(parts[1], 10);
			await handleFoodBuy(ctx, foodType, amount, nestedMenus);
			return;
		}

		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_DEPOSIT_PREFIX)) {
			const amount = parseInt(customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_DEPOSIT_PREFIX, ""), 10);
			await handleTreasuryDeposit(ctx, amount, nestedMenus, false);
		}
	});
}

async function showShopFoodQuantityMenu(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus,
	foodType: PetFood
): Promise<void> {
	nestedMenus.registerMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU, {
		containers: [buildShopQuantityContainer(ctx, foodType)],
		createCollector: createShopQuantityCollector(ctx)
	});
	await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU);
}

async function showShopTreasuryMenu(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	nestedMenus.registerMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU, {
		containers: [buildShopTreasuryContainer(ctx)],
		createCollector: createShopQuantityCollector(ctx)
	});
	await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU);
}

function createShopReimburseCollector(
	ctx: GuildDomainMenuContext
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollector(ctx, async (customId: string, buttonInteraction: MessageComponentInteraction, nestedMenus: CrowniclesNestedMenus) => {
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
			await handleTreasuryDeposit(ctx, amount, nestedMenus, true);
		}
	});
}

async function showShopReimburseMenu(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	nestedMenus.registerMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_MENU, {
		containers: [buildShopReimburseContainer(ctx)],
		createCollector: createShopReimburseCollector(ctx)
	});
	await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_MENU);
}

function createBuildingMenuCollector(building: GuildBuilding, ctx: GuildDomainMenuContext): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollector(ctx, async (customId: string, buttonInteraction: MessageComponentInteraction, nestedMenus: CrowniclesNestedMenus) => {
		await buttonInteraction.deferUpdate();

		if (customId === ReportCityMenuIds.GUILD_DOMAIN_BACK) {
			await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_DOMAIN_MENU);
			return;
		}

		if (customId === ReportCityMenuIds.STAY_IN_CITY) {
			handleStayInCityInteraction(ctx.packet, ctx.context, buttonInteraction);
			return;
		}

		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_UPGRADE_PREFIX)) {
			const upgradedBuilding = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_UPGRADE_PREFIX, "") as GuildBuilding;
			await handleUpgrade(ctx, upgradedBuilding, nestedMenus);
			return;
		}

		if (building === GuildBuilding.SHOP) {
			if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_OPEN_PREFIX)) {
				const foodType = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_OPEN_PREFIX, "") as PetFood;
				await showShopFoodQuantityMenu(ctx, nestedMenus, foodType);
				return;
			}

			if (customId === ReportCityMenuIds.GUILD_DOMAIN_SHOP_TREASURY_OPEN) {
				await showShopTreasuryMenu(ctx, nestedMenus);
			}
		}
	});
}

export interface GuildDomainMenuOptions {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	pseudo: string;
}

function buildContextFromOptions(options: GuildDomainMenuOptions): GuildDomainMenuContext {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = options;
	const data = (packet.data.data as ReactionCollectorCityData).guildDomain!;
	return {
		data,
		lng: interaction.userLanguage,
		pseudo,
		context,
		interaction,
		packet,
		collectorTime
	};
}

export function getGuildDomainMenu(options: GuildDomainMenuOptions): CrowniclesNestedMenu {
	const ctx = buildContextFromOptions(options);
	return {
		containers: [buildMainDomainContainer(ctx)],
		createCollector: createMainMenuCollector(ctx)
	};
}

export function getGuildDomainSubMenus(options: GuildDomainMenuOptions): Map<string, CrowniclesNestedMenu> {
	const ctx = buildContextFromOptions(options);
	const subMenus = new Map<string, CrowniclesNestedMenu>();

	for (const building of Object.values(GuildBuilding)) {
		const menuId = BUILDING_MENU_IDS[building];
		subMenus.set(menuId, {
			containers: [buildBuildingContainer(building, ctx)],
			createCollector: createBuildingMenuCollector(building, ctx)
		});
	}

	return subMenus;
}
