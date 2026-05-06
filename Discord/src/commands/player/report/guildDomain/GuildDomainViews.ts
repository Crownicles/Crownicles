import {
	ActionRowBuilder,
	ButtonBuilder, ButtonStyle,
	ContainerBuilder,
	SectionBuilder, SeparatorBuilder, SeparatorSpacingSize,
	StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
	TextDisplayBuilder
} from "discord.js";
import i18n from "../../../../translations/i18n";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import {
	GuildBuilding, GuildDomainConstants
} from "../../../../../../Lib/src/constants/GuildDomainConstants";
import {
	PetConstants, PetFood
} from "../../../../../../Lib/src/constants/PetConstants";
import {
	addDomainNavigation, addStatusMessage, addUpgradeSection,
	BUILDING_ICONS, FOOD_KEYS, getBuildingLevel, getBuildingSummary,
	GuildDomainData, GuildDomainMenuContext
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
	5,
	10
] as const;

function getMaxBuyableFood(data: GuildDomainData, foodIndex: number): number {
	const foodKey = FOOD_KEYS[foodIndex];
	const remainingSlots = data.foodCaps[foodIndex] - data.food[foodKey];
	const maxAffordable = Math.floor(data.treasury / GuildDomainConstants.SHOP_PRICES.FOOD[foodIndex]);
	return Math.max(0, Math.min(remainingSlots, maxAffordable));
}

function buildShopCatalogText(data: GuildDomainData, lng: Language): string {
	const foodTypes = PetConstants.PET_FOOD_BY_ID;
	const foodLines: string[] = [];
	for (let i = 0; i < foodTypes.length; i++) {
		const foodType = foodTypes[i];
		const foodKey = FOOD_KEYS[i];
		const stock = data.food[foodKey];
		const cap = data.foodCaps[i];
		const price = GuildDomainConstants.SHOP_PRICES.FOOD[i];
		const foodName = i18n.t(`models:foods.${foodType}`, {
			lng, count: 1
		});
		foodLines.push(i18n.t("commands:report.city.guildDomain.subMenus.shop.catalogFoodLine", {
			lng, food: foodName, stock, cap, price
		}));
	}
	const depositLines: string[] = [];
	for (const cost of [GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT, GuildDomainConstants.SHOP_PRICES.BIG_DEPOSIT]) {
		const penalty = Math.min(
			Math.round(cost * GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.PERCENT),
			GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.MAX
		);
		const treasuryGain = cost - penalty;
		const labelKey = cost === GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT ? "depositSmallName" : "depositBigName";
		depositLines.push(i18n.t("commands:report.city.guildDomain.subMenus.shop.catalogDepositLine", {
			lng, name: i18n.t(`commands:report.city.guildDomain.subMenus.shop.${labelKey}`, { lng }), cost, treasury: treasuryGain
		}));
	}
	return i18n.t("commands:report.city.guildDomain.subMenus.shop.catalog", {
		lng,
		foodLines: foodLines.join("\n"),
		depositLines: depositLines.join("\n"),
		playerMoney: data.playerMoney,
		treasury: data.treasury
	});
}

function buildShopSelectMenu(data: GuildDomainData, lng: Language): StringSelectMenuBuilder | null {
	const select = new StringSelectMenuBuilder()
		.setCustomId(ReportCityMenuIds.GUILD_DOMAIN_SHOP_SELECT)
		.setPlaceholder(i18n.t("commands:report.city.guildDomain.subMenus.shop.selectPlaceholder", { lng }));

	const foodTypes = PetConstants.PET_FOOD_BY_ID;
	let optionCount = 0;

	for (let i = 0; i < foodTypes.length; i++) {
		if (getMaxBuyableFood(data, i) <= 0) {
			continue;
		}
		const foodType = foodTypes[i];
		const foodName = i18n.t(`models:foods.${foodType}`, {
			lng, count: 1
		});
		const price = GuildDomainConstants.SHOP_PRICES.FOOD[i];
		select.addOptions(new StringSelectMenuOptionBuilder()
			.setLabel(foodName)
			.setDescription(i18n.t("commands:report.city.guildDomain.subMenus.shop.selectFoodDescription", {
				lng, price
			}))
			.setValue(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_SELECT_FOOD_PREFIX}${foodType}`));
		optionCount++;
	}

	for (const cost of [GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT, GuildDomainConstants.SHOP_PRICES.BIG_DEPOSIT]) {
		if (data.playerMoney < cost) {
			continue;
		}
		const labelKey = cost === GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT ? "depositSmallName" : "depositBigName";
		const penalty = Math.min(
			Math.round(cost * GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.PERCENT),
			GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.MAX
		);
		const treasuryGain = cost - penalty;
		select.addOptions(new StringSelectMenuOptionBuilder()
			.setLabel(i18n.t(`commands:report.city.guildDomain.subMenus.shop.${labelKey}`, { lng }))
			.setDescription(i18n.t("commands:report.city.guildDomain.subMenus.shop.selectDepositDescription", {
				lng, cost, treasury: treasuryGain
			}))
			.setValue(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_SELECT_DEPOSIT_PREFIX}${cost}`));
		optionCount++;
	}

	return optionCount > 0 ? select : null;
}

function addReimburseSection(container: ContainerBuilder, lng: Language, playerMoney: number, pendingAmount: number): void {
	const penalty = Math.min(
		Math.round(pendingAmount * GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.PERCENT),
		GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.MAX
	);
	const treasuryGain = pendingAmount - penalty;
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.guildDomain.subMenus.shop.reimbursePrompt", {
				lng, cost: pendingAmount, treasury: treasuryGain, penalty
			})
		)
	);
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_PREFIX}${pendingAmount}`)
				.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.reimburseAccept", {
					lng, cost: pendingAmount, treasury: treasuryGain
				}))
				.setStyle(ButtonStyle.Success)
				.setDisabled(playerMoney < pendingAmount),
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.GUILD_DOMAIN_SHOP_REIMBURSE_DECLINE)
				.setLabel(i18n.t("commands:report.city.guildDomain.subMenus.shop.reimburseDecline", { lng }))
				.setStyle(ButtonStyle.Danger)
		)
	);
}

function buildShopBody(container: ContainerBuilder, ctx: GuildDomainMenuContext): void {
	const {
		data, lng
	} = ctx;

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(buildShopCatalogText(data, lng))
	);

	const select = buildShopSelectMenu(data, lng);
	if (select) {
		container.addActionRowComponents(
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)
		);
	}
	else {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.guildDomain.subMenus.shop.noFoodAvailable", { lng })
			)
		);
	}

	if (data.pendingReimburseAmount && data.pendingReimburseAmount > 0) {
		addReimburseSection(container, lng, data.playerMoney, data.pendingReimburseAmount);
	}
}

export function buildShopQuantityContainer(ctx: GuildDomainMenuContext, foodType: PetFood): ContainerBuilder {
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
		new TextDisplayBuilder().setContent(`### ${i18n.t("commands:report.city.guildDomain.subMenus.shop.title", { lng })}`)
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
		},
		statusMessage
	});
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
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					i18n.t("commands:report.city.guildDomain.foodInfo", {
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
