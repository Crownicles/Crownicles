import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
	ContainerBuilder, Message,
	SectionBuilder, SeparatorBuilder, SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import i18n from "../../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenuCollector, CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import {
	createStayInCityButton, handleStayInCityInteraction, STAY_IN_CITY_ID
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
import { Language } from "../../../../../../Lib/src/Language";
import { DiscordMQTT } from "../../../../bot/DiscordMQTT";
import {
	CommandReportGuildDomainDepositReq,
	CommandReportGuildDomainDepositRes,
	CommandReportGuildDomainUpgradeReq,
	CommandReportGuildDomainUpgradeRes,
	CommandReportFoodShopBuyReq,
	CommandReportFoodShopBuyRes,
	CommandReportGuildDomainBuyXpReq,
	CommandReportGuildDomainBuyXpRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	GuildBuilding, GuildDomainConstants
} from "../../../../../../Lib/src/constants/GuildDomainConstants";

import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";

// ─── Types ───────────────────────────────────────────────────────────────────

type GuildDomainData = ReactionCollectorCityData["guildDomain"] & object;

interface GuildDomainMenuContext {
	data: GuildDomainData;
	lng: Language;
	pseudo: string;
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEPOSIT_AMOUNTS = [
	100,
	500,
	1000,
	5000
] as const;

const BUILDING_MENU_IDS: Record<GuildBuilding, string> = {
	[GuildBuilding.SHOP]: ReportCityMenuIds.GUILD_DOMAIN_SHOP_MENU,
	[GuildBuilding.SHELTER]: ReportCityMenuIds.GUILD_DOMAIN_SHELTER_MENU,
	[GuildBuilding.PANTRY]: ReportCityMenuIds.GUILD_DOMAIN_PANTRY_MENU,
	[GuildBuilding.TRAINING_GROUND]: ReportCityMenuIds.GUILD_DOMAIN_TRAINING_MENU
};

// ─── Collector helper ────────────────────────────────────────────────────────

function createDomainCollector(
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

// ─── Navigation helpers ──────────────────────────────────────────────────────

function addDomainNavigation(container: ContainerBuilder, ctx: GuildDomainMenuContext, backLabel: string, backId: string): void {
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

function addStatusMessage(container: ContainerBuilder, statusMessage?: string): void {
	if (statusMessage) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(statusMessage)
		);
	}
}

// ─── Main domain menu ────────────────────────────────────────────────────────

function buildMainDomainContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng, pseudo
	} = ctx;
	const container = new ContainerBuilder();

	// Title
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.guildDomain.menuTitle", {
				lng, pseudo, guildName: data.guildName
			})}`
		)
	);

	// Intro + guild level & treasury
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.menuIntro", {
				lng, guildName: data.guildName
			})
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.guildLevelAndTreasury", {
				lng,
				guildLevel: data.guildLevel,
				treasury: data.treasury,
				playerMoney: data.playerMoney
			})
		)
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	// Building sections with enter buttons
	for (const building of Object.values(GuildBuilding)) {
		const currentLevel = data[`${building}Level` as keyof typeof data] as number;
		const maxLevel = GuildDomainConstants.BUILDINGS[building].maxLevel;
		const buildingName = i18n.t(`commands:report.city.guildDomain.buildings.${building}`, { lng });
		const description = getBuildingSummary(building, currentLevel, data, lng);

		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						`**${buildingName}** — ${i18n.t("commands:report.city.guildDomain.levelDisplay", {
							lng, level: currentLevel, maxLevel
						})}\n${description}`
					)
				)
				.setButtonAccessory(
					new ButtonBuilder()
						.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_ENTER_PREFIX}${building}`)
						.setLabel(i18n.t("commands:report.city.guildDomain.enterBuilding", { lng }))
						.setStyle(ButtonStyle.Primary)
				)
		);
	}

	// Deposit section
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.depositLabel", { lng })
		)
	);
	for (const row of buildDepositButtons(data, lng)) {
		container.addActionRowComponents(row);
	}

	addStatusMessage(container, statusMessage);

	// Navigation
	addDomainNavigation(
		container,
		ctx,
		i18n.t("commands:report.city.guildDomain.leaveDomain", { lng }),
		ReportCityMenuIds.BACK_TO_CITY
	);

	return container;
}

function getBuildingSummary(building: GuildBuilding, level: number, _data: GuildDomainData, lng: Language): string {
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

// ─── Deposit buttons ─────────────────────────────────────────────────────────

function buildDepositButtons(data: GuildDomainData, lng: Language): ActionRowBuilder<ButtonBuilder>[] {
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];
	const buttons: ButtonBuilder[] = [];

	for (const amount of DEPOSIT_AMOUNTS) {
		if (data.playerMoney >= amount) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_DEPOSIT_PREFIX}${amount}`)
					.setLabel(i18n.t("commands:report.city.guildDomain.depositAmount", {
						lng, amount
					}))
					.setStyle(ButtonStyle.Success)
			);
		}
	}

	if (data.playerMoney >= GuildDomainConstants.MIN_CONTRIBUTE_AMOUNT) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.GUILD_DOMAIN_DEPOSIT_ALL)
				.setLabel(i18n.t("commands:report.city.guildDomain.depositAll", { lng }))
				.setStyle(ButtonStyle.Success)
		);
	}

	for (let i = 0; i < buttons.length; i += 5) {
		rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
	}

	return rows;
}

// ─── Upgrade section ─────────────────────────────────────────────────────────

function addUpgradeSection(container: ContainerBuilder, building: GuildBuilding, ctx: GuildDomainMenuContext): void {
	const {
		data, lng
	} = ctx;
	if (!data.isChief && !data.isElder) {
		return;
	}

	const currentLevel = data[`${building}Level` as keyof typeof data] as number;
	const upgradeCost = GuildDomainConstants.getBuildingUpgradeCost(building, currentLevel);

	if (upgradeCost === null) {
		// Max level
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

	let upgradeText = i18n.t("commands:report.city.guildDomain.buildingUpgrade", {
		lng,
		nextLevel: currentLevel + 1,
		cost: upgradeCost
	});

	if (!meetsLevel && requiredGuildLevel !== null) {
		upgradeText += i18n.t("commands:report.city.guildDomain.buildingUpgradeBlocked", {
			lng,
			required: requiredGuildLevel
		});
	}
	else if (!canAfford) {
		upgradeText += i18n.t("commands:report.city.guildDomain.buildingUpgradeTreasuryLow", { lng });
	}

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(upgradeText)
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

// ─── Shop sub-menu ───────────────────────────────────────────────────────────

function buildShopContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	const container = new ContainerBuilder();
	const shopLevel = data.shopLevel;

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.guildDomain.subMenus.shop.title", { lng })}`
		)
	);

	if (shopLevel === 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.guildDomain.subMenus.shop.notBuilt", { lng })
			)
		);

		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addUpgradeSection(container, GuildBuilding.SHOP, ctx);
		addStatusMessage(container, statusMessage);
		addDomainNavigation(container, ctx, i18n.t("commands:report.city.guildDomain.backToDomain", { lng }), ReportCityMenuIds.GUILD_DOMAIN_BACK);
		return container;
	}

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shop.description", {
				lng, playerMoney: data.playerMoney
			})
		)
	);

	// Food stock
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.foodInfo", {
				lng,
				common: data.food.common,
				commonCap: data.foodCaps[0],
				carnivorous: data.food.carnivorous,
				carnivorousCap: data.foodCaps[1],
				herbivorous: data.food.herbivorous,
				herbivorousCap: data.foodCaps[2],
				ultimate: data.food.ultimate,
				ultimateCap: data.foodCaps[3]
			})
		)
	);

	// Buy food buttons
	const foodRows = buildFoodBuyButtons(data, lng);
	if (foodRows.length > 0) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.guildDomain.subMenus.shop.buyFoodLabel", { lng })
			)
		);
		for (const row of foodRows) {
			container.addActionRowComponents(row);
		}
	}

	// Buy guild XP buttons
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shop.buyXpLabel", { lng })
		)
	);
	container.addActionRowComponents(buildXpBuyButtons(data, lng));

	addStatusMessage(container, statusMessage);
	addDomainNavigation(container, ctx, i18n.t("commands:report.city.guildDomain.backToDomain", { lng }), ReportCityMenuIds.GUILD_DOMAIN_BACK);

	return container;
}

function buildFoodBuyButtons(data: GuildDomainData, lng: Language): ActionRowBuilder<ButtonBuilder>[] {
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];
	const foodTypes = PetConstants.PET_FOOD_BY_ID;

	for (let i = 0; i < foodTypes.length; i++) {
		const foodType = foodTypes[i];
		const foodKey = foodType.replace("Food", "") as "common" | "carnivorous" | "herbivorous" | "ultimate";
		const currentStock = data.food[foodKey];
		const cap = data.foodCaps[i];
		const remainingSlots = cap - currentStock;
		const price = GuildDomainConstants.SHOP_PRICES.FOOD[i];
		const maxAffordable = Math.floor(data.playerMoney / price);
		const maxBuyable = Math.min(remainingSlots, maxAffordable);

		if (maxBuyable <= 0) {
			continue;
		}

		const amounts = [
			...new Set([
				1,
				Math.min(5, maxBuyable),
				Math.min(10, maxBuyable),
				maxBuyable
			].filter(a => a > 0))
		];

		const row = new ActionRowBuilder<ButtonBuilder>();
		for (const amount of amounts) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX}${foodType}_${amount}`)
					.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.buyFoodButton", {
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

function buildXpBuyButtons(data: GuildDomainData, lng: Language): ActionRowBuilder<ButtonBuilder> {
	const row = new ActionRowBuilder<ButtonBuilder>();

	row.addComponents(
		new ButtonBuilder()
			.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_XP_PREFIX}small`)
			.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.buyXpSmall", {
				lng,
				cost: GuildDomainConstants.SHOP_PRICES.SMALL_XP
			}))
			.setStyle(ButtonStyle.Success)
			.setDisabled(data.playerMoney < GuildDomainConstants.SHOP_PRICES.SMALL_XP)
	);

	row.addComponents(
		new ButtonBuilder()
			.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_XP_PREFIX}big`)
			.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.buyXpBig", {
				lng,
				cost: GuildDomainConstants.SHOP_PRICES.BIG_XP
			}))
			.setStyle(ButtonStyle.Success)
			.setDisabled(data.playerMoney < GuildDomainConstants.SHOP_PRICES.BIG_XP)
	);

	return row;
}

// ─── Simple building sub-menus ───────────────────────────────────────────────

function buildShelterContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.guildDomain.subMenus.shelter.title", { lng })}`
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shelter.description", {
				lng,
				slots: GuildDomainConstants.getShelterSlots(data.shelterLevel)
			})
		)
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	addUpgradeSection(container, GuildBuilding.SHELTER, ctx);
	addStatusMessage(container, statusMessage);
	addDomainNavigation(container, ctx, i18n.t("commands:report.city.guildDomain.backToDomain", { lng }), ReportCityMenuIds.GUILD_DOMAIN_BACK);

	return container;
}

function buildPantryContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.guildDomain.subMenus.pantry.title", { lng })}`
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.pantry.description", { lng })
		)
	);

	// Food stock
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.foodInfo", {
				lng,
				common: data.food.common,
				commonCap: data.foodCaps[0],
				carnivorous: data.food.carnivorous,
				carnivorousCap: data.foodCaps[1],
				herbivorous: data.food.herbivorous,
				herbivorousCap: data.foodCaps[2],
				ultimate: data.food.ultimate,
				ultimateCap: data.foodCaps[3]
			})
		)
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	addUpgradeSection(container, GuildBuilding.PANTRY, ctx);
	addStatusMessage(container, statusMessage);
	addDomainNavigation(container, ctx, i18n.t("commands:report.city.guildDomain.backToDomain", { lng }), ReportCityMenuIds.GUILD_DOMAIN_BACK);

	return container;
}

function buildTrainingGroundContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	const container = new ContainerBuilder();
	const love = GuildDomainConstants.getTrainingLovePerDay(data.trainingGroundLevel);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.guildDomain.subMenus.training.title", { lng })}`
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			love === 0
				? i18n.t("commands:report.city.guildDomain.subMenus.training.descriptionInactive", { lng })
				: i18n.t("commands:report.city.guildDomain.subMenus.training.descriptionActive", {
					lng, love
				})
		)
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	addUpgradeSection(container, GuildBuilding.TRAINING_GROUND, ctx);
	addStatusMessage(container, statusMessage);
	addDomainNavigation(container, ctx, i18n.t("commands:report.city.guildDomain.backToDomain", { lng }), ReportCityMenuIds.GUILD_DOMAIN_BACK);

	return container;
}

// ─── Menu registration ───────────────────────────────────────────────────────

function registerAllDomainMenus(
	ctx: GuildDomainMenuContext,
	nestedMenus: CrowniclesNestedMenus,
	statusMessage?: string,
	statusMenuId?: string
): void {
	// Main domain menu
	nestedMenus.registerMenu(ReportCityMenuIds.GUILD_DOMAIN_MENU, {
		containers: [buildMainDomainContainer(ctx, statusMenuId === ReportCityMenuIds.GUILD_DOMAIN_MENU ? statusMessage : undefined)],
		createCollector: createMainMenuCollector(ctx)
	});

	// Building sub-menus
	for (const building of Object.values(GuildBuilding)) {
		const menuId = BUILDING_MENU_IDS[building];
		const container = buildBuildingContainer(building, ctx, statusMenuId === menuId ? statusMessage : undefined);
		nestedMenus.registerMenu(menuId, {
			containers: [container],
			createCollector: createBuildingMenuCollector(building, ctx)
		});
	}
}

function buildBuildingContainer(building: GuildBuilding, ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	switch (building) {
		case GuildBuilding.SHOP:
			return buildShopContainer(ctx, statusMessage);
		case GuildBuilding.SHELTER:
			return buildShelterContainer(ctx, statusMessage);
		case GuildBuilding.PANTRY:
			return buildPantryContainer(ctx, statusMessage);
		case GuildBuilding.TRAINING_GROUND:
			return buildTrainingGroundContainer(ctx, statusMessage);
		default:
			return new ContainerBuilder();
	}
}

// ─── Interaction handlers ────────────────────────────────────────────────────

async function handleDeposit(
	ctx: GuildDomainMenuContext,
	amount: number,
	nestedMenus: CrowniclesNestedMenus,
	returnMenuId: string
): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		makePacket(CommandReportGuildDomainDepositReq, { amount }),
		async (_responseContext, packetName, responsePacket) => {
			if (packetName === CommandReportGuildDomainDepositRes.name) {
				const res = responsePacket as unknown as CommandReportGuildDomainDepositRes;
				ctx.data.treasury = res.newTreasury;
				ctx.data.playerMoney = res.newPlayerMoney;
				registerAllDomainMenus(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.depositSuccess", {
					lng: ctx.lng,
					amount: res.amountDeposited
				}), returnMenuId);
				await nestedMenus.changeMenu(returnMenuId);
			}
			else {
				registerAllDomainMenus(ctx, nestedMenus, i18n.t("commands:report.city.guildDomain.depositError", { lng: ctx.lng }), returnMenuId);
				await nestedMenus.changeMenu(returnMenuId);
			}
		}
	);
}

async function handleUpgrade(
	ctx: GuildDomainMenuContext,
	building: string,
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
				const levelField = `${res.building}Level` as keyof GuildDomainData;
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
	foodType: string,
	amount: number,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		ctx.context,
		makePacket(CommandReportFoodShopBuyReq, {
			foodType, amount
		}),
		async (_responseContext, packetName, responsePacket) => {
			const shopMenuId = BUILDING_MENU_IDS[GuildBuilding.SHOP];
			if (packetName === CommandReportFoodShopBuyRes.name) {
				const res = responsePacket as unknown as CommandReportFoodShopBuyRes;
				const foodKey = res.foodType.replace("Food", "") as "common" | "carnivorous" | "herbivorous" | "ultimate";
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
	tier: string,
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

// ─── Collectors ──────────────────────────────────────────────────────────────

function createMainMenuCollector(ctx: GuildDomainMenuContext): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createDomainCollector(ctx, async (customId, buttonInteraction, nestedMenus) => {
		await buttonInteraction.deferUpdate();

		// Navigate to city
		if (customId === ReportCityMenuIds.BACK_TO_CITY) {
			await nestedMenus.changeToMainMenu();
			return;
		}

		// Stay in city
		if (customId === STAY_IN_CITY_ID) {
			handleStayInCityInteraction(ctx.packet, ctx.context, buttonInteraction);
			return;
		}

		// Enter a building
		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_ENTER_PREFIX)) {
			const building = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_ENTER_PREFIX, "") as GuildBuilding;
			const menuId = BUILDING_MENU_IDS[building];
			if (menuId) {
				await nestedMenus.changeMenu(menuId);
			}
			return;
		}

		// Deposit
		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_DEPOSIT_PREFIX) || customId === ReportCityMenuIds.GUILD_DOMAIN_DEPOSIT_ALL) {
			const amount = customId === ReportCityMenuIds.GUILD_DOMAIN_DEPOSIT_ALL
				? ctx.data.playerMoney
				: parseInt(customId.replace(ReportCityMenuIds.GUILD_DOMAIN_DEPOSIT_PREFIX, ""), 10);
			await handleDeposit(ctx, amount, nestedMenus, ReportCityMenuIds.GUILD_DOMAIN_MENU);
		}
	});
}

function createBuildingMenuCollector(building: GuildBuilding, ctx: GuildDomainMenuContext): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const menuId = BUILDING_MENU_IDS[building];

	return createDomainCollector(ctx, async (customId, buttonInteraction, nestedMenus) => {
		await buttonInteraction.deferUpdate();

		// Back to domain
		if (customId === ReportCityMenuIds.GUILD_DOMAIN_BACK) {
			await nestedMenus.changeMenu(ReportCityMenuIds.GUILD_DOMAIN_MENU);
			return;
		}

		// Stay in city
		if (customId === STAY_IN_CITY_ID) {
			handleStayInCityInteraction(ctx.packet, ctx.context, buttonInteraction);
			return;
		}

		// Upgrade building
		if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_UPGRADE_PREFIX)) {
			const upgradedBuilding = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_UPGRADE_PREFIX, "");
			await handleUpgrade(ctx, upgradedBuilding, nestedMenus, menuId);
			return;
		}

		// Shop-specific interactions
		if (building === GuildBuilding.SHOP) {
			// Buy food
			if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX)) {
				const parts = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX, "").split("_");
				const foodType = parts[0];
				const amount = parseInt(parts[1], 10);
				await handleFoodBuy(ctx, foodType, amount, nestedMenus);
				return;
			}

			// Buy XP
			if (customId.startsWith(ReportCityMenuIds.GUILD_DOMAIN_SHOP_XP_PREFIX)) {
				const tier = customId.replace(ReportCityMenuIds.GUILD_DOMAIN_SHOP_XP_PREFIX, "");
				await handleXpBuy(ctx, tier, nestedMenus);
			}
		}
	});
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getGuildDomainMenu(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	collectorTime: number,
	pseudo: string
): CrowniclesNestedMenu {
	const data = (packet.data.data as ReactionCollectorCityData).guildDomain!;
	const lng = interaction.userLanguage;

	const ctx: GuildDomainMenuContext = {
		data, lng, pseudo, context, interaction, packet, collectorTime
	};

	return {
		containers: [buildMainDomainContainer(ctx)],
		createCollector: createMainMenuCollector(ctx)
	};
}

export function getGuildDomainSubMenus(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	collectorTime: number,
	pseudo: string
): Map<string, CrowniclesNestedMenu> {
	const data = (packet.data.data as ReactionCollectorCityData).guildDomain!;
	const lng = interaction.userLanguage;

	const ctx: GuildDomainMenuContext = {
		data, lng, pseudo, context, interaction, packet, collectorTime
	};

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
