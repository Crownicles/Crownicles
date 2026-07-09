import {
	ContainerBuilder, Message
} from "discord.js";
import i18n from "../../../../translations/i18n";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenuCollector, CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import {
	CrowniclesPacket, makePacket, PacketContext
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
	GuildBuilding,
	GuildDomainConstants
} from "../../../../../../Lib/src/constants/GuildDomainConstants";
import { PetFood } from "../../../../../../Lib/src/constants/PetConstants";
import {
	BUILDING_MENU_IDS, buildFoodBuyConfirmationBase, createDomainCollectorWithStayHandling,
	getBuildingLevel, GuildDomainMenuContext, parseFoodShopBuyCustomId, parsePrefixedAmount, PET_FOOD_TO_KEY, setBuildingLevel
} from "./GuildDomainShared";
import {
	buildBuildingContainer, buildMainDomainContainer, buildShopQuantityContainer,
	buildShopReimburseContainer, buildShopTreasuryContainer
} from "./GuildDomainViews";
import {
	finishReportWithErrorEmbed, finishReportWithMessage
} from "../ReportFlowHelpers";
import { openCityConfirmation } from "../confirmation/CityConfirmationMenu";

type DomainConfirmationConfig = {
	description: string;
	confirmLabel: string;
	confirmEmoji?: string;
	backMenuId: string;
	onConfirm: (nestedMenus: CrowniclesNestedMenus) => Promise<void>;
};

async function showDomainConfirmation(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus,
	config: DomainConfirmationConfig
): Promise<void> {
	await openCityConfirmation(nestedMenus, ctx, {
		description: config.description,
		confirmLabel: config.confirmLabel,
		confirmEmoji: config.confirmEmoji,
		backMenuId: config.backMenuId,
		onConfirm: action => config.onConfirm(action.nestedMenus)
	});
}

function buildBuildingUpgradeConfirmation(
	ctx: GuildDomainMenuContext,
	building: GuildBuilding
): DomainConfirmationConfig | null {
	const currentLevel = getBuildingLevel(ctx.data, building);
	const cost = GuildDomainConstants.getBuildingUpgradeCost(building, currentLevel);
	if (cost === null) {
		return null;
	}
	const buildingName = i18n.t(`commands:report.city.guildDomain.buildings.${building}`, { lng: ctx.lng });
	return {
		description: i18n.t("commands:report.city.guildDomain.upgradeConfirmDescription", {
			lng: ctx.lng,
			building: buildingName,
			level: currentLevel + 1,
			cost,
			treasury: ctx.data.treasury
		}),
		confirmLabel: i18n.t("commands:report.city.buttons.upgrade", { lng: ctx.lng }),
		backMenuId: BUILDING_MENU_IDS[building],
		onConfirm: nestedMenus => handleUpgrade(ctx, building, nestedMenus)
	};
}

function buildFoodBuyConfirmation(
	ctx: GuildDomainMenuContext,
	foodType: PetFood,
	amount: number
): DomainConfirmationConfig | null {
	const base = buildFoodBuyConfirmationBase(ctx, foodType, amount, nestedMenus => handleFoodBuy(ctx, foodType, amount, nestedMenus));
	if (base === null) {
		return null;
	}
	return {
		...base,
		backMenuId: ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU
	};
}

function buildTreasuryDepositConfirmation(ctx: GuildDomainMenuContext, amount: number): DomainConfirmationConfig {
	return {
		description: i18n.t("commands:report.city.guildDomain.subMenus.shop.depositTreasuryConfirmDescription", {
			lng: ctx.lng,
			cost: amount,
			treasury: GuildDomainConstants.computeTreasuryGain(amount)
		}),
		confirmLabel: i18n.t("commands:report.city.buttons.confirm", { lng: ctx.lng }),
		backMenuId: ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU,
		onConfirm: nestedMenus => handleTreasuryDeposit(ctx, amount, nestedMenus, false)
	};
}

/**
 * Send a packet, then either run the success handler with a typed response
 * or finish the report with an error embed when the response packet doesn't match.
 * Centralises the boilerplate shared by handleUpgrade / handleFoodBuy / handleTreasuryDeposit.
 */
async function sendDomainAction<TRes extends CrowniclesPacket>(options: {
	ctx: GuildDomainMenuContext;
	nestedMenus: CrowniclesNestedMenus;
	requestPacket: ReturnType<typeof makePacket>;
	expectedResponseName: string;
	errorTranslationKey: string;
	onSuccess: (res: TRes) => void | Promise<void>;
}): Promise<void> {
	const {
		ctx, nestedMenus, requestPacket, expectedResponseName, errorTranslationKey, onSuccess
	} = options;
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		requestPacket,
		async (_responseContext, packetName, responsePacket) => {
			if (packetName === expectedResponseName) {
				await onSuccess(responsePacket as TRes);
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
	await sendDomainAction<CommandReportGuildDomainUpgradeRes>({
		ctx,
		nestedMenus,
		requestPacket: makePacket(CommandReportGuildDomainUpgradeReq, { building }),
		expectedResponseName: CommandReportGuildDomainUpgradeRes.name,
		errorTranslationKey: "commands:report.city.guildDomain.upgradeError",
		onSuccess: res => {
			ctx.data.treasury = res.newTreasury;
			setBuildingLevel(ctx.data, res.building, res.newLevel);
			const buildingName = i18n.t(`commands:report.city.guildDomain.buildings.${res.building}`, { lng: ctx.lng });
			const successMessage = i18n.t("commands:report.city.guildDomain.upgradeSuccess", {
				lng: ctx.lng, building: buildingName, level: res.newLevel, xpGained: res.xpGained
			});
			finishReportWithMessage(ctx, nestedMenus, successMessage);
		}
	});
}

async function handleFoodBuy(
	ctx: GuildDomainMenuContext,
	foodType: PetFood,
	amount: number,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await sendDomainAction<CommandReportFoodShopBuyRes>({
		ctx,
		nestedMenus,
		requestPacket: makePacket(CommandReportFoodShopBuyReq, {
			foodType, amount
		}),
		expectedResponseName: CommandReportFoodShopBuyRes.name,
		errorTranslationKey: "commands:report.city.guildDomain.subMenus.shop.buyFoodError",
		onSuccess: async res => {
			const foodKey = PET_FOOD_TO_KEY[res.foodType];
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
	});
}

async function handleTreasuryDeposit(
	ctx: GuildDomainMenuContext,
	amount: number,
	nestedMenus: CrowniclesNestedMenus,
	isReimburse: boolean
): Promise<void> {
	await sendDomainAction<CommandReportGuildDomainDepositTreasuryRes>({
		ctx,
		nestedMenus,
		requestPacket: makePacket(CommandReportGuildDomainDepositTreasuryReq, {
			amount, isReimburse
		}),
		expectedResponseName: CommandReportGuildDomainDepositTreasuryRes.name,
		errorTranslationKey: "commands:report.city.guildDomain.subMenus.shop.depositTreasuryError",
		onSuccess: res => {
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
	});
}

function createMainMenuCollector(ctx: GuildDomainMenuContext): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollectorWithStayHandling(ctx, async (customId, _buttonInteraction, nestedMenus) => {
		if (customId === ReportCityMenuIds.BACK_TO_CITY) {
			await nestedMenus.changeToMainMenu();
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

async function handleShopFoodSelection(
	ctx: GuildDomainMenuContext,
	customId: string,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	const selection = parseFoodShopBuyCustomId(customId);
	if (!selection) {
		return;
	}
	const confirmation = buildFoodBuyConfirmation(ctx, selection.foodType, selection.amount);
	if (confirmation) {
		await showDomainConfirmation(ctx, nestedMenus, confirmation);
	}
}

async function handleShopDepositSelection(
	ctx: GuildDomainMenuContext,
	customId: string,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	const amount = parsePrefixedAmount(customId, ReportCityMenuIds.GUILD_DOMAIN_SHOP_DEPOSIT_PREFIX);
	if (!Number.isInteger(amount) || amount <= 0) {
		return;
	}
	await showDomainConfirmation(ctx, nestedMenus, buildTreasuryDepositConfirmation(ctx, amount));
}

type DomainCustomIdRoute = {
	match: (customId: string) => boolean;
	handle: (ctx: GuildDomainMenuContext, customId: string, nestedMenus: CrowniclesNestedMenus) => Promise<void> | void;
};

function createRoutingDomainCollector(
	ctx: GuildDomainMenuContext,
	routes: DomainCustomIdRoute[]
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollectorWithStayHandling(ctx, async (customId, _buttonInteraction, nestedMenus) => {
		for (const route of routes) {
			if (route.match(customId)) {
				await route.handle(ctx, customId, nestedMenus);
				return;
			}
		}
	});
}

function createShopQuantityCollector(
	ctx: GuildDomainMenuContext
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createRoutingDomainCollector(ctx, [
		{
			match: id => id === ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_CANCEL,
			handle: (_ctx, _id, nestedMenus) => nestedMenus.changeMenu(BUILDING_MENU_IDS[GuildBuilding.SHOP])
		},
		{
			match: id => id.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX),
			handle: handleShopFoodSelection
		},
		{
			match: id => id.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_DEPOSIT_PREFIX),
			handle: handleShopDepositSelection
		}
	]);
}

/**
 * Register a guild-domain sub-menu (container + collector) and switch to it.
 * Shared by the shop sub-menus which only differ by menu id, container and collector.
 */
async function showDomainSubMenu(
	nestedMenus: CrowniclesNestedMenus,
	menuId: string,
	container: ContainerBuilder,
	createCollector: (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector
): Promise<void> {
	nestedMenus.registerMenu(menuId, {
		containers: [container],
		createCollector
	});
	await nestedMenus.changeMenu(menuId);
}

async function showShopFoodQuantityMenu(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus,
	foodType: PetFood
): Promise<void> {
	await showDomainSubMenu(
		nestedMenus,
		ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU,
		buildShopQuantityContainer(ctx, foodType),
		createShopQuantityCollector(ctx)
	);
}

async function showShopTreasuryMenu(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await showDomainSubMenu(
		nestedMenus,
		ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_MENU,
		buildShopTreasuryContainer(ctx),
		createShopQuantityCollector(ctx)
	);
}

function createShopReimburseCollector(
	ctx: GuildDomainMenuContext
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollectorWithStayHandling(ctx, async (customId, _buttonInteraction, nestedMenus) => {
		if (customId === ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_DECLINE) {
			ctx.data.pendingReimburseAmount = undefined;
			const declineMessage = i18n.t("commands:report.city.guildDomain.subMenus.shop.reimburseDeclined", { lng: ctx.lng });
			const recap = ctx.data.pendingPurchaseRecap;
			ctx.data.pendingPurchaseRecap = undefined;
			finishReportWithMessage(ctx, nestedMenus, recap ? `${recap}\n\n${declineMessage}` : declineMessage);
			return;
		}

		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_PREFIX)) {
			const amount = parsePrefixedAmount(customId, ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_PREFIX);
			await handleTreasuryDeposit(ctx, amount, nestedMenus, true);
		}
	});
}

async function showShopReimburseMenu(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await showDomainSubMenu(
		nestedMenus,
		ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_MENU,
		buildShopReimburseContainer(ctx),
		createShopReimburseCollector(ctx)
	);
}

async function handleBuildingUpgradeSelection(
	ctx: GuildDomainMenuContext,
	customId: string,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	const upgradedBuilding = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_UPGRADE_PREFIX, "") as GuildBuilding;
	const confirmation = buildBuildingUpgradeConfirmation(ctx, upgradedBuilding);
	if (confirmation) {
		await showDomainConfirmation(ctx, nestedMenus, confirmation);
	}
}

async function handleShopBuildingSelection(
	ctx: GuildDomainMenuContext,
	customId: string,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_OPEN_PREFIX)) {
		const foodType = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_OPEN_PREFIX, "") as PetFood;
		await showShopFoodQuantityMenu(ctx, nestedMenus, foodType);
		return;
	}
	if (customId === ReportCityMenuIds.GUILD_DOMAIN_SHOP_TREASURY_OPEN) {
		await showShopTreasuryMenu(ctx, nestedMenus);
	}
}

function createBuildingMenuCollector(building: GuildBuilding, ctx: GuildDomainMenuContext): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const routes: DomainCustomIdRoute[] = [
		{
			match: id => id === ReportCityMenuIds.GUILD_DOMAIN_BACK,
			handle: (_ctx, _id, nestedMenus) => nestedMenus.changeMenu(ReportCityMenuIds.GUILD_DOMAIN_MENU)
		},
		{
			match: id => id.startsWith(ReportCityMenuIds.GUILD_DOMAIN_UPGRADE_PREFIX),
			handle: handleBuildingUpgradeSelection
		}
	];
	if (building === GuildBuilding.SHOP) {
		routes.push({
			match: () => true,
			handle: handleShopBuildingSelection
		});
	}
	return createRoutingDomainCollector(ctx, routes);
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
