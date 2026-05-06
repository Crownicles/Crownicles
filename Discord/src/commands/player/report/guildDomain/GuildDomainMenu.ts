import {
	ButtonInteraction, Message
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
	CommandReportGuildDomainBuyXpReq,
	CommandReportGuildDomainBuyXpRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	GuildBuilding, XpTier
} from "../../../../../../Lib/src/constants/GuildDomainConstants";
import { PetFood } from "../../../../../../Lib/src/constants/PetConstants";
import {
	BUILDING_MENU_IDS, createDomainCollector,
	GuildDomainMenuContext
} from "./GuildDomainShared";
import {
	buildBuildingContainer, buildMainDomainContainer
} from "./GuildDomainViews";

function registerAllDomainMenus(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus,
	statusMessage?: string,
	statusMenuId?: string
): void {
	nestedMenus.registerMenu(ReportCityMenuIds.GUILD_DOMAIN_MENU, {
		containers: [buildMainDomainContainer(ctx, statusMenuId === ReportCityMenuIds.GUILD_DOMAIN_MENU ? statusMessage : undefined)],
		createCollector: createMainMenuCollector(ctx)
	});

	for (const building of Object.values(GuildBuilding)) {
		const menuId = BUILDING_MENU_IDS[building];
		const container = buildBuildingContainer(building, ctx, statusMenuId === menuId ? statusMessage : undefined);
		nestedMenus.registerMenu(menuId, {
			containers: [container],
			createCollector: createBuildingMenuCollector(building, ctx)
		});
	}
}

async function handleUpgrade(
	ctx: GuildDomainMenuContext,
	building: GuildBuilding,
	nestedMenus: CrowniclesNestedMenus,
	returnMenuId: string
): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		makePacket(CommandReportGuildDomainUpgradeReq, { building }),
		async (_responseContext, packetName, responsePacket) => {
			if (packetName === CommandReportGuildDomainUpgradeRes.name) {
				const res = responsePacket as unknown as CommandReportGuildDomainUpgradeRes;
				ctx.data.treasury = res.newTreasury;
				const levelField = `${res.building}Level`;
				(ctx.data as Record<string, unknown>)[levelField] = res.newLevel;

				const buildingName = i18n.t(`commands:report.city.guildDomain.buildings.${res.building}`, { lng: ctx.lng });
				registerAllDomainMenus(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.upgradeSuccess", {
					lng: ctx.lng,
					building: buildingName,
					level: res.newLevel
				}), returnMenuId);
				await nestedMenus.changeMenu(returnMenuId);
			}
			else {
				registerAllDomainMenus(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.upgradeError", { lng: ctx.lng }), returnMenuId);
				await nestedMenus.changeMenu(returnMenuId);
			}
		}
	);
}

async function handleFoodBuy(
	ctx: GuildDomainMenuContext,
	foodType: PetFood,
	amount: number,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		makePacket(CommandReportFoodShopBuyReq, {
			foodType,
			amount
		}),
		async (_responseContext, packetName, responsePacket) => {
			const shopMenuId = BUILDING_MENU_IDS[GuildBuilding.SHOP];
			if (packetName === CommandReportFoodShopBuyRes.name) {
				const res = responsePacket as unknown as CommandReportFoodShopBuyRes;
				const foodKey = res.foodType.replace("Food", "") as keyof typeof ctx.data.food;
				ctx.data.food[foodKey] = res.newFoodStock;
				ctx.data.playerMoney = res.newPlayerMoney;

				registerAllDomainMenus(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.subMenus.shop.buyFoodSuccess", {
					lng: ctx.lng,
					amount: res.amountBought,
					food: i18n.t(`models:foods.${res.foodType}`, {
						lng: ctx.lng, count: res.amountBought
					})
				}), shopMenuId);
				await nestedMenus.changeMenu(shopMenuId);
			}
			else {
				registerAllDomainMenus(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.subMenus.shop.buyFoodError", { lng: ctx.lng }), shopMenuId);
				await nestedMenus.changeMenu(shopMenuId);
			}
		}
	);
}

async function handleXpBuy(
	ctx: GuildDomainMenuContext,
	tier: XpTier,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		makePacket(CommandReportGuildDomainBuyXpReq, { tier }),
		async (_responseContext, packetName, responsePacket) => {
			const shopMenuId = BUILDING_MENU_IDS[GuildBuilding.SHOP];
			if (packetName === CommandReportGuildDomainBuyXpRes.name) {
				const res = responsePacket as unknown as CommandReportGuildDomainBuyXpRes;
				ctx.data.playerMoney = res.newPlayerMoney;

				registerAllDomainMenus(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.subMenus.shop.buyXpSuccess", {
					lng: ctx.lng,
					xp: res.xp
				}), shopMenuId);
				await nestedMenus.changeMenu(shopMenuId);
			}
			else {
				registerAllDomainMenus(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.subMenus.shop.buyXpError", { lng: ctx.lng }), shopMenuId);
				await nestedMenus.changeMenu(shopMenuId);
			}
		}
	);
}

function createMainMenuCollector(ctx: GuildDomainMenuContext): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollector(ctx, async (customId: string, buttonInteraction: ButtonInteraction, nestedMenus: CrowniclesNestedMenus) => {
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

function createBuildingMenuCollector(building: GuildBuilding, ctx: GuildDomainMenuContext): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const menuId = BUILDING_MENU_IDS[building];

	return createDomainCollector(ctx, async (customId: string, buttonInteraction: ButtonInteraction, nestedMenus: CrowniclesNestedMenus) => {
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
			await handleUpgrade(ctx, upgradedBuilding, nestedMenus, menuId);
			return;
		}

		if (building === GuildBuilding.SHOP) {
			if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX)) {
				const parts = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX, "").split("_");
				const foodType = parts[0] as PetFood;
				const amount = parseInt(parts[1], 10);
				await handleFoodBuy(ctx, foodType, amount, nestedMenus);
				return;
			}

			if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_XP_PREFIX)) {
				const tier = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_XP_PREFIX, "") as XpTier;
				await handleXpBuy(ctx, tier, nestedMenus);
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
