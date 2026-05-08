import {
	ActionRowBuilder,
	ButtonBuilder, ButtonStyle,
	ContainerBuilder,
	SectionBuilder, SeparatorBuilder, SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import i18n from "../../../../translations/i18n";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	GuildBuilding, GuildDomainConstants
} from "../../../../../../Lib/src/constants/GuildDomainConstants";
import {
	PetConstants, PetFood
} from "../../../../../../Lib/src/constants/PetConstants";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { Language } from "../../../../../../Lib/src/Language";
import {
	addBuildingLevelAndCostInfo, addDomainNavigation, addFoodInfoBlock, addStatusMessage, addUpgradeSection,
	BUILDING_ICONS, FOOD_KEYS, FoodShopUIContext, getBuildingLevel, getBuildingSummary,
	GuildDomainMenuContext
} from "./GuildDomainShared";

export function buildMainDomainContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng, pseudo
	} = ctx;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.guildDomain.menuTitle", {
				lng, pseudo, guildName: data.guildName
			})}`
		)
	);

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

	for (const building of Object.values(GuildBuilding)) {
		const currentLevel = getBuildingLevel(data, building);
		const maxLevel = GuildDomainConstants.BUILDINGS[building].maxLevel;
		const buildingName = i18n.t(`commands:report.city.guildDomain.buildings.${building}`, { lng });
		const description = getBuildingSummary(building, currentLevel, lng);
		const buildingIcon = BUILDING_ICONS[building];

		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						`${buildingIcon} **${buildingName}** — ${i18n.t("commands:report.city.guildDomain.levelDisplay", {
							lng, level: currentLevel, maxLevel
						})}\n${description}`
					)
				)
				.setButtonAccessory(
					new ButtonBuilder()
						.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_ENTER_PREFIX}${building}`)
						.setLabel(i18n.t(`commands:report.city.guildDomain.enterBuilding.${building}`, { lng }))
						.setEmoji(buildingIcon)
						.setStyle(ButtonStyle.Primary)
				)
		);
	}

	addStatusMessage(container, statusMessage);

	addDomainNavigation(
		container,
		ctx,
		i18n.t("commands:report.city.guildDomain.leaveDomain", { lng }),
		ReportCityMenuIds.BACK_TO_CITY
	);

	return container;
}

const FOOD_BUY_QUICK_PRESETS = [
	1,
	10,
	100
] as const;

function getMaxBuyableFood(data: FoodShopUIContext["data"], foodIndex: number): number {
	const foodKey = FOOD_KEYS[foodIndex];
	const remainingSlots = data.foodCaps[foodIndex] - data.food[foodKey];
	const maxAffordable = Math.floor(data.treasury / GuildDomainConstants.SHOP_PRICES.FOOD[foodIndex]);
	return Math.max(0, Math.min(remainingSlots, maxAffordable));
}

function getMaxAffordableDeposits(data: FoodShopUIContext["data"], cost: number): number {
	return Math.floor(data.playerMoney / cost);
}

/**
 * Build the shared shop body (description, stock info, food choose buttons, optional treasury button).
 * Used both inside the guild domain shop submenu and inside the standalone mobile food shop.
 */
export function buildShopBody(
	container: ContainerBuilder,
	ctx: FoodShopUIContext,
	options: {
		withTreasuryButton?: boolean; descriptionKey?: string;
	} = {}
): void {
	const {
		data, lng
	} = ctx;
	const withTreasuryButton = options.withTreasuryButton ?? true;
	const descriptionKey = options.descriptionKey ?? "commands:report.city.guildDomain.subMenus.shop.description";

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t(descriptionKey, {
				lng, playerMoney: data.playerMoney, treasury: data.treasury
			})
		)
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shop.stockInfo", {
				lng,
				common: data.food.common,
				commonCap: data.foodCaps[0],
				herbivorous: data.food.herbivorous,
				herbivorousCap: data.foodCaps[1],
				carnivorous: data.food.carnivorous,
				carnivorousCap: data.foodCaps[2],
				ultimate: data.food.ultimate,
				ultimateCap: data.foodCaps[3]
			})
		)
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shop.choosePrompt", { lng })
		)
	);

	const foodTypes = PetConstants.PET_FOOD_BY_ID;
	const foodRow = new ActionRowBuilder<ButtonBuilder>();
	for (let i = 0; i < foodTypes.length; i++) {
		const foodType = foodTypes[i];
		const foodName = i18n.t(`models:foods.${foodType}`, {
			lng, count: 1
		});
		foodRow.addComponents(
			new ButtonBuilder()
				.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_OPEN_PREFIX}${foodType}`)
				.setLabel(foodName)
				.setEmoji(CrowniclesIcons.foods[foodType])
				.setStyle(ButtonStyle.Primary)
				.setDisabled(getMaxBuyableFood(data, i) <= 0)
		);
	}
	container.addActionRowComponents(foodRow);

	const treasuryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(ReportCityMenuIds.GUILD_DOMAIN_SHOP_TREASURY_OPEN)
			.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.treasuryButton", { lng }))
			.setEmoji(CrowniclesIcons.city.guildDomain.shop)
			.setStyle(ButtonStyle.Success)
			.setDisabled(data.playerMoney < GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT)
	);
	if (withTreasuryButton) {
		container.addActionRowComponents(treasuryRow);
	}
}

export function buildShopQuantityContainer(ctx: FoodShopUIContext, foodType: PetFood): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	const foodIndex = PetConstants.PET_FOOD_BY_ID.indexOf(foodType);
	const foodKey = FOOD_KEYS[foodIndex];
	const price = GuildDomainConstants.SHOP_PRICES.FOOD[foodIndex];
	const maxBuyable = getMaxBuyableFood(data, foodIndex);
	const foodName = i18n.t(`models:foods.${foodType}`, {
		lng, count: 1
	});

	const container = new ContainerBuilder();
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`### ${CrowniclesIcons.foods[foodType]} ${foodName}`)
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shop.quantityPrompt", {
				lng,
				food: foodName,
				stock: data.food[foodKey],
				cap: data.foodCaps[foodIndex],
				price,
				treasury: data.treasury
			})
		)
	);

	const amounts = [
		...new Set([
			...FOOD_BUY_QUICK_PRESETS.map(preset => Math.min(preset, maxBuyable)),
			maxBuyable
		].filter(a => a > 0))
	];

	if (amounts.length > 0) {
		const row = new ActionRowBuilder<ButtonBuilder>();
		for (const amount of amounts) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX}${foodType}_${amount}`)
					.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.quantityButton", {
						lng, amount, cost: price * amount
					}))
					.setStyle(ButtonStyle.Primary)
			);
		}
		container.addActionRowComponents(row);
	}

	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_CANCEL)
				.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.quantityCancel", { lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Secondary)
		)
	);

	return container;
}

export function buildShopTreasuryContainer(ctx: FoodShopUIContext): ContainerBuilder {
	const {
		data, lng
	} = ctx;

	const container = new ContainerBuilder();
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`### ${CrowniclesIcons.city.guildDomain.shop} ${i18n.t("commands:report.city.guildDomain.subMenus.shop.treasuryTitle", { lng })}`)
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shop.treasuryPrompt", {
				lng,
				playerMoney: data.playerMoney,
				treasury: data.treasury,
				penaltyPercent: GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.PERCENT * 100,
				penaltyMax: GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.MAX
			})
		)
	);

	const row = new ActionRowBuilder<ButtonBuilder>();
	const depositTiers: Array<{
		cost: number; labelKey: string;
	}> = [
		{
			cost: GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT, labelKey: "depositSmallName"
		},
		{
			cost: GuildDomainConstants.SHOP_PRICES.BIG_DEPOSIT, labelKey: "depositBigName"
		},
		{
			cost: GuildDomainConstants.SHOP_PRICES.HUGE_DEPOSIT, labelKey: "depositHugeName"
		}
	];
	for (const {
		cost, labelKey
	} of depositTiers) {
		const penalty = Math.min(
			Math.round(cost * GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.PERCENT),
			GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.MAX
		);
		const treasuryGain = cost - penalty;
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_DEPOSIT_PREFIX}${cost}`)
				.setLabel(i18n.t(`commands:report.city.guildDomain.subMenus.shop.${labelKey}Button`, {
					lng, cost, treasury: treasuryGain
				}))
				.setStyle(ButtonStyle.Success)
				.setDisabled(getMaxAffordableDeposits(data, cost) <= 0)
		);
	}
	container.addActionRowComponents(row);

	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.GUILD_DOMAIN_SHOP_QUANTITY_CANCEL)
				.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.quantityCancel", { lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Secondary)
		)
	);

	return container;
}

export function buildShopReimburseContainer(ctx: FoodShopUIContext): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	const pendingAmount = data.pendingReimburseAmount ?? 0;

	const container = new ContainerBuilder();
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`### ${i18n.t("commands:report.city.guildDomain.subMenus.shop.reimburseTitle", { lng })}`)
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shop.reimbursePrompt", {
				lng, cost: pendingAmount, treasury: pendingAmount
			})
		)
	);
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_PREFIX}${pendingAmount}`)
				.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.reimburseAccept", {
					lng, cost: pendingAmount, treasury: pendingAmount
				}))
				.setStyle(ButtonStyle.Success)
				.setDisabled(data.playerMoney < pendingAmount),
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_DECLINE)
				.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.reimburseDecline", { lng }))
				.setStyle(ButtonStyle.Danger)
		)
	);

	return container;
}

export function buildShopContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const { lng } = ctx;
	if (ctx.data.shopLevel === 0) {
		return buildSimpleBuildingContainer({
			ctx,
			building: GuildBuilding.SHOP,
			titleKey: "commands:report.city.guildDomain.subMenus.shop.title",
			body: c => c.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(i18n.t("commands:report.city.guildDomain.subMenus.shop.notBuilt", { lng }))
			),
			statusMessage
		});
	}
	return buildSimpleBuildingContainer({
		ctx,
		building: GuildBuilding.SHOP,
		titleKey: "commands:report.city.guildDomain.subMenus.shop.title",
		body: c => buildShopBody(c, ctx),
		statusMessage
	});
}

interface SimpleBuildingArgs {
	ctx: GuildDomainMenuContext;
	building: GuildBuilding;
	titleKey: string;
	body: (container: ContainerBuilder) => void;
	statusMessage?: string;
}

/**
 * Helper to factor out the common building sub-menu skeleton:
 * title + description + separator + upgrade + status + nav.
 */
function buildSimpleBuildingContainer(args: SimpleBuildingArgs): ContainerBuilder {
	const {
		ctx, building, titleKey, body, statusMessage
	} = args;
	const { lng } = ctx;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`### ${i18n.t(titleKey, { lng })}`)
	);

	body(container);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	addBuildingLevelAndCostInfo(container, building, ctx);
	addUpgradeSection(container, building, ctx);
	addStatusMessage(container, statusMessage);
	addDomainNavigation(container, ctx, i18n.t("commands:report.city.guildDomain.backToDomain", { lng }), ReportCityMenuIds.GUILD_DOMAIN_BACK);

	return container;
}

export function buildShelterContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	return buildSimpleBuildingContainer({
		ctx,
		building: GuildBuilding.SHELTER,
		titleKey: "commands:report.city.guildDomain.subMenus.shelter.title",
		body: container => {
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					i18n.t("commands:report.city.guildDomain.subMenus.shelter.description", {
						lng,
						slots: GuildDomainConstants.getShelterSlots(data.shelterLevel)
					})
				)
			);
			container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			if (data.shelterPets.length === 0) {
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						i18n.t("commands:report.city.guildDomain.subMenus.shelter.empty", { lng })
					)
				);
			}
			else {
				const list = data.shelterPets
					.map((pet, index) => `**${index + 1}.** ${DisplayUtils.getOwnedPetInlineDisplay(pet, lng)}`)
					.join("\n");
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						`${i18n.t("commands:report.city.guildDomain.subMenus.shelter.petListHeader", {
							lng,
							count: data.shelterPets.length,
							max: data.shelterMaxCount
						})}\n${list}`
					)
				);
			}
			container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					i18n.t("commands:report.city.guildDomain.subMenus.shelter.petTransferHint", { lng })
				)
			);
		},
		statusMessage
	});
}

/**
 * Build the auto-fill explanation text for the pantry menu, adapted to the current pantry level.
 * Lists daily auto-fill amounts per food category, hiding categories with zero rate.
 * If the pantry isn't built yet (level 0), explains how to unlock the feature.
 */
function buildAutoFillText(pantryLevel: number, lng: Language): string {
	const rates = GuildDomainConstants.getAutoFillRates(pantryLevel);
	const lines: string[] = [];
	for (let i = 0; i < FOOD_KEYS.length; i++) {
		const rate = rates[i] ?? 0;
		if (rate > 0) {
			lines.push(i18n.t("commands:report.city.guildDomain.subMenus.pantry.autoFillLine", {
				lng,
				amount: rate,
				food: i18n.t(`models:foods.${PetConstants.PET_FOOD_BY_ID[i]}`, {
					lng, count: rate
				}),
				foodType: PetConstants.PET_FOOD_BY_ID[i]
			}));
		}
	}
	if (lines.length === 0) {
		return i18n.t("commands:report.city.guildDomain.subMenus.pantry.autoFillNone", { lng });
	}
	return `${i18n.t("commands:report.city.guildDomain.subMenus.pantry.autoFillHeader", { lng })}\n${lines.join("\n")}`;
}

export function buildPantryContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	return buildSimpleBuildingContainer({
		ctx,
		building: GuildBuilding.PANTRY,
		titleKey: "commands:report.city.guildDomain.subMenus.pantry.title",
		body: container => {
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					i18n.t("commands:report.city.guildDomain.subMenus.pantry.description", { lng })
				)
			);
			container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			addFoodInfoBlock(container, data, lng);
			container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(buildAutoFillText(data.pantryLevel, lng))
			);
		},
		statusMessage
	});
}

export function buildTrainingGroundContainer(ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
	const {
		data, lng
	} = ctx;
	const love = GuildDomainConstants.getTrainingLovePerDay(data.trainingGroundLevel);
	return buildSimpleBuildingContainer({
		ctx,
		building: GuildBuilding.TRAINING_GROUND,
		titleKey: "commands:report.city.guildDomain.subMenus.training.title",
		body: container => {
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
			addFoodInfoBlock(container, data, lng);
		},
		statusMessage
	});
}

export function buildBuildingContainer(building: GuildBuilding, ctx: GuildDomainMenuContext, statusMessage?: string): ContainerBuilder {
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
