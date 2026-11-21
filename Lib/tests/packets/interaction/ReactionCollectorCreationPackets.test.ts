import {
	describe, expect, it
} from "vitest";
import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "../../../src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorAltar, ReactionCollectorAltarContributeReaction, ReactionCollectorAltarData
} from "../../../src/packets/interaction/ReactionCollectorAltar";
import {
	ReactionCollectorBadPetReaction, ReactionCollectorBadPetSmallEvent, ReactionCollectorBadPetSmallEventData
} from "../../../src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import {
	ReactionCollectorBigEvent, ReactionCollectorBigEventData, ReactionCollectorBigEventPossibilityReaction
} from "../../../src/packets/interaction/ReactionCollectorBigEvent";
import {
	ReactionCollectorBuyCategorySlot,
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotData,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../src/packets/interaction/ReactionCollectorBuyCategorySlot";
import {
	ReactionCollectorBuyHeal, ReactionCollectorBuyHealData
} from "../../../src/packets/interaction/ReactionCollectorBuyHeal";
import {
	ReactionCollectorCart, ReactionCollectorCartData
} from "../../../src/packets/interaction/ReactionCollectorCart";
import {
	ReactionCollectorChangeClass, ReactionCollectorChangeClassData, ReactionCollectorChangeClassDetails,
	ReactionCollectorChangeClassReaction
} from "../../../src/packets/interaction/ReactionCollectorChangeClass";
import {
	ReactionCollectorChooseDestination,
	ReactionCollectorChooseDestinationData,
	ReactionCollectorChooseDestinationReaction,
	ReactionCollectorStayInCityReaction
} from "../../../src/packets/interaction/ReactionCollectorChooseDestination";
import {
	ReactionCollectorDailyBonus, ReactionCollectorDailyBonusData, ReactionCollectorDailyBonusReaction
} from "../../../src/packets/interaction/ReactionCollectorDailyBonus";
import {
	ReactionCollectorDefensePersonality,
	ReactionCollectorDefensePersonalityData,
	ReactionCollectorDefensePersonalityReaction
} from "../../../src/packets/interaction/ReactionCollectorDefensePersonality";
import {
	ReactionCollectorDrink, ReactionCollectorDrinkData, ReactionCollectorDrinkReaction
} from "../../../src/packets/interaction/ReactionCollectorDrink";
import {
	ReactionCollectorEpicShopSmallEvent, ReactionCollectorEpicShopSmallEventData
} from "../../../src/packets/interaction/ReactionCollectorEpicShopSmallEvent";
import {
	ReactionCollectorEquip, ReactionCollectorEquipCloseReaction, ReactionCollectorEquipData
} from "../../../src/packets/interaction/ReactionCollectorEquip";
import {
	ReactionCollectorFight, ReactionCollectorFightData
} from "../../../src/packets/interaction/ReactionCollectorFight";
import {
	ReactionCollectorFightChooseAction,
	ReactionCollectorFightChooseActionData,
	ReactionCollectorFightChooseActionReaction
} from "../../../src/packets/interaction/ReactionCollectorFightChooseAction";
import {
	ReactionCollectorFightPet, ReactionCollectorFightPetData, ReactionCollectorFightPetReaction
} from "../../../src/packets/interaction/ReactionCollectorFightPet";
import {
	ReactionCollectorGardener, ReactionCollectorGardenerData
} from "../../../src/packets/interaction/ReactionCollectorGardener";
import {
	ReactionCollectorGoToPVEIsland, ReactionCollectorGoToPVEIslandData
} from "../../../src/packets/interaction/ReactionCollectorGoToPVEIsland";
import {
	ReactionCollectorGobletsGame,
	ReactionCollectorGobletsGameBiggestReaction,
	ReactionCollectorGobletsGameCrackedReaction,
	ReactionCollectorGobletsGameData,
	ReactionCollectorGobletsGameMetalReaction,
	ReactionCollectorGobletsGameSparklingReaction
} from "../../../src/packets/interaction/ReactionCollectorGobletsGame";
import {
	ReactionCollectorGuildCreate, ReactionCollectorGuildCreateData
} from "../../../src/packets/interaction/ReactionCollectorGuildCreate";
import {
	ReactionCollectorGuildDescription, ReactionCollectorGuildDescriptionData
} from "../../../src/packets/interaction/ReactionCollectorGuildDescription";
import {
	ReactionCollectorGuildElder, ReactionCollectorGuildElderData
} from "../../../src/packets/interaction/ReactionCollectorGuildElder";
import {
	ReactionCollectorGuildElderRemove, ReactionCollectorGuildElderRemoveData
} from "../../../src/packets/interaction/ReactionCollectorGuildElderRemove";
import {
	ReactionCollectorGuildInvite, ReactionCollectorGuildInviteData
} from "../../../src/packets/interaction/ReactionCollectorGuildInvite";
import {
	ReactionCollectorGuildKick, ReactionCollectorGuildKickData
} from "../../../src/packets/interaction/ReactionCollectorGuildKick";
import {
	ReactionCollectorGuildLeave, ReactionCollectorGuildLeaveData
} from "../../../src/packets/interaction/ReactionCollectorGuildLeave";
import {
	ReactionCollectorInteractOtherPlayersPoor, ReactionCollectorInteractOtherPlayersPoorData
} from "../../../src/packets/interaction/ReactionCollectorInteractOtherPlayers";
import {
	ReactionCollectorItemAccept, ReactionCollectorItemAcceptData, ReactionCollectorItemAcceptDrinkPotionReaction
} from "../../../src/packets/interaction/ReactionCollectorItemAccept";
import {
	ReactionCollectorItemChoice,
	ReactionCollectorItemChoiceData,
	ReactionCollectorItemChoiceDrinkPotionReaction,
	ReactionCollectorItemChoiceItemReaction,
	ReactionCollectorItemChoiceRefuseReaction
} from "../../../src/packets/interaction/ReactionCollectorItemChoice";
import {
	ReactionCollectorJoinBoat, ReactionCollectorJoinBoatData
} from "../../../src/packets/interaction/ReactionCollectorJoinBoat";
import {
	ReactionCollectorLimoges, ReactionCollectorLimogesData
} from "../../../src/packets/interaction/ReactionCollectorLimoges";
import {
	ReactionCollectorLottery,
	ReactionCollectorLotteryData,
	ReactionCollectorLotteryEasyReaction,
	ReactionCollectorLotteryHardReaction,
	ReactionCollectorLotteryMediumReaction
} from "../../../src/packets/interaction/ReactionCollectorLottery";
import {
	ReactionCollectorPetExpedition,
	ReactionCollectorPetExpeditionCloseReaction,
	ReactionCollectorPetExpeditionData,
	ReactionCollectorPetExpeditionRecallReaction
} from "../../../src/packets/interaction/ReactionCollectorPetExpedition";
import {
	ExpeditionOptionData,
	ReactionCollectorPetExpeditionCancelReaction,
	ReactionCollectorPetExpeditionChoice,
	ReactionCollectorPetExpeditionChoiceData,
	ReactionCollectorPetExpeditionSelectReaction
} from "../../../src/packets/interaction/ReactionCollectorPetExpeditionChoice";
import {
	ReactionCollectorPetExpeditionClaimReaction,
	ReactionCollectorPetExpeditionFinished,
	ReactionCollectorPetExpeditionFinishedData
} from "../../../src/packets/interaction/ReactionCollectorPetExpeditionFinished";
import {
	ReactionCollectorPetFeedWithGuild, ReactionCollectorPetFeedWithGuildData, ReactionCollectorPetFeedWithGuildFoodReaction
} from "../../../src/packets/interaction/ReactionCollectorPetFeedWithGuild";
import {
	ReactionCollectorPetFeedWithoutGuild, ReactionCollectorPetFeedWithoutGuildData
} from "../../../src/packets/interaction/ReactionCollectorPetFeedWithoutGuild";
import {
	ReactionCollectorPetFoodContinueReaction,
	ReactionCollectorPetFoodInvestigateReaction,
	ReactionCollectorPetFoodSendPetReaction,
	ReactionCollectorPetFoodSmallEvent,
	ReactionCollectorPetFoodSmallEventData
} from "../../../src/packets/interaction/ReactionCollectorPetFoodSmallEvent";
import {
	ReactionCollectorPetFree,
	ReactionCollectorPetFreeData,
	ReactionCollectorPetFreeSelectReaction,
	ReactionCollectorPetFreeSelection,
	ReactionCollectorPetFreeSelectionData,
	ReactionCollectorPetFreeShelterConfirm,
	ReactionCollectorPetFreeShelterConfirmData
} from "../../../src/packets/interaction/ReactionCollectorPetFree";
import {
	ReactionCollectorPetSell, ReactionCollectorPetSellData
} from "../../../src/packets/interaction/ReactionCollectorPetSell";
import {
	ReactionCollectorPetTransfer,
	ReactionCollectorPetTransferData,
	ReactionCollectorPetTransferDepositReaction,
	ReactionCollectorPetTransferWithdrawReaction
} from "../../../src/packets/interaction/ReactionCollectorPetTransfer";
import {
	ReactionCollectorPveFight, ReactionCollectorPveFightData
} from "../../../src/packets/interaction/ReactionCollectorPveFight";
import {
	ReactionCollectorRecipeShopSmallEvent, ReactionCollectorRecipeShopSmallEventData, RecipeShopSource
} from "../../../src/packets/interaction/ReactionCollectorRecipeShopSmallEvent";
import {
	ReactionCollectorSell, ReactionCollectorSellData, ReactionCollectorSellItemReaction
} from "../../../src/packets/interaction/ReactionCollectorSell";
import {
	ReactionCollectorShop,
	ReactionCollectorShopCloseReaction,
	ReactionCollectorShopData,
	ReactionCollectorShopItemReaction,
	ShopCategory
} from "../../../src/packets/interaction/ReactionCollectorShop";
import {
	ReactionCollectorShopSmallEvent, ReactionCollectorShopSmallEventData
} from "../../../src/packets/interaction/ReactionCollectorShopSmallEvent";
import {
	ReactionCollectorSkipMissionShopItem,
	ReactionCollectorSkipMissionShopItemCloseReaction,
	ReactionCollectorSkipMissionShopItemData,
	ReactionCollectorSkipMissionShopItemReaction
} from "../../../src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import {
	ReactionCollectorTokenMerchant, ReactionCollectorTokenMerchantBuyReaction, ReactionCollectorTokenMerchantData
} from "../../../src/packets/interaction/ReactionCollectorTokenMerchant";
import {
	ReactionCollectorUnlock, ReactionCollectorUnlockData
} from "../../../src/packets/interaction/ReactionCollectorUnlock";
import {
	ReactionCollectorUseTokens, ReactionCollectorUseTokensData
} from "../../../src/packets/interaction/ReactionCollectorUseTokens";
import {
	ReactionCollectorWitch, ReactionCollectorWitchData, ReactionCollectorWitchReaction
} from "../../../src/packets/interaction/ReactionCollectorWitch";
import {
	ItemCategory, ItemConstants, ItemRarity
} from "../../../src/constants/ItemConstants";
import { MainItemDetails } from "../../../src/types/MainItemDetails";
import { OwnedPet } from "../../../src/types/OwnedPet";
import { PetBasicInfo } from "../../../src/types/PetBasicInfo";
import { PetFood } from "../../../src/types/PetFood";
import { FightPlayerStats } from "../../../src/types/FightPlayerStats";
import {
	BaseMission, MissionType
} from "../../../src/types/CompletedMission";
import { PlantId } from "../../../src/constants/PlantConstants";
import { ShopCurrency } from "../../../src/constants/ShopConstants";
import { ShopItemType } from "../../../src/constants/LogsConstants";
import { RecipeType } from "../../../src/constants/CookingConstants";
import { SmallEventGobletsGameStrategy } from "../../../src/packets/smallEvents/SmallEventGobletsGamePacket";

const ID = "collector-id";
const END_TIME = 1_735_689_600_000;

type DataClass = new () => ReactionCollectorData;
type ReactionClass = new () => ReactionCollectorReaction;

type ExpectedReaction = {
	Class: ReactionClass;
	fields: object;
};

type ExpectedData = [DataClass, object];

type CollectorCase = {
	name: string;
	collector: () => ReactionCollector;
	data: ExpectedData;
	reactions: ExpectedReaction[];
};

function reaction(Class: ReactionClass, fields: object = {}): ExpectedReaction {
	return {
		Class, fields
	};
}

function withFields<T extends object>(Class: new () => T, fields: T): T {
	return Object.assign(new Class(), fields);
}

const ACCEPT_REFUSE = [reaction(ReactionCollectorAcceptReaction), reaction(ReactionCollectorRefuseReaction)];

const SWORD: MainItemDetails = {
	id: 42,
	rarity: ItemRarity.RARE,
	itemCategory: ItemCategory.WEAPON,
	itemLevel: 2,
	attack: {
		baseValue: 30, upgradeValue: 5, maxValue: 100
	},
	defense: {
		baseValue: 0, upgradeValue: 0, maxValue: 100
	},
	speed: {
		baseValue: 0, upgradeValue: 0, maxValue: 100
	}
};

const PET: OwnedPet = {
	typeId: 3,
	nickname: "Rex",
	rarity: 2,
	sex: "m",
	loveLevel: 4,
	force: 10,
	feedDelay: 1
};

const SHELTER_PETS = [
	{
		petEntityId: 99, pet: PET
	}
];

const PET_INFO: PetBasicInfo = {
	petTypeId: 3,
	petSex: "f",
	petNickname: "Rexa"
};

const PLAYER_STATS: FightPlayerStats = {
	classId: 4,
	fightRanking: { glory: 1200 },
	energy: {
		value: 80, max: 100
	},
	attack: 50,
	defense: 40,
	speed: 30,
	breath: {
		base: 2, max: 6, regen: 2
	}
};

const CLASS_DETAILS: ReactionCollectorChangeClassDetails = {
	id: 7,
	energy: 100,
	attack: 50,
	defense: 60,
	speed: 20,
	initialBreath: 3,
	maxBreath: 8,
	breathRegen: 2,
	health: 120
};

const EXPEDITION: ExpeditionOptionData = {
	id: "expedition-1",
	mapLocationId: 12,
	locationType: "forest",
	durationMinutes: 90,
	displayDurationMinutes: 90,
	riskRate: 20,
	difficulty: 30,
	foodCost: 2,
	rewardIndex: 4
};

const MISSION: BaseMission = {
	missionId: "fightAttacks",
	missionObjective: 10,
	missionVariant: 0,
	numberDone: 3,
	missionType: MissionType.DAILY
};

const SHOP_SMALL_EVENT_DATA = withFields(ReactionCollectorShopSmallEventData, {
	item: SWORD, price: 500
});

const EPIC_SHOP_SMALL_EVENT_DATA = withFields(ReactionCollectorEpicShopSmallEventData, {
	item: SWORD, price: 900, tip: true
});

const PVE_FIGHT_DATA = withFields(ReactionCollectorPveFightData, {
	monster: {
		id: "skeleton", level: 12, energy: 300, attack: 40, defense: 30, speed: 20
	},
	mapId: 5
});

const RECIPE_SHOP_DATA = withFields(ReactionCollectorRecipeShopSmallEventData, {
	source: RecipeShopSource.GASPARD_JO,
	recipe: {
		recipeId: "potion_health_1",
		level: 1,
		recipeType: RecipeType.POTION_HEALTH
	},
	recipeCost: 15
});

const ITEM_CHOICE_DATA = withFields(ReactionCollectorItemChoiceData, {
	item: {
		category: ItemCategory.POTION, id: 5
	}
});

const CASES: CollectorCase[] = [
	{
		name: "Altar",
		collector: () => new ReactionCollectorAltar([100, 500], 2_000, 5_000),
		data: [ReactionCollectorAltarData, {
			poolAmount: 2_000, poolThreshold: 5_000
		}],
		reactions: [
			reaction(ReactionCollectorAltarContributeReaction, { amount: 100 }),
			reaction(ReactionCollectorAltarContributeReaction, { amount: 500 }),
			reaction(ReactionCollectorRefuseReaction)
		]
	},
	{
		name: "BadPetSmallEvent",
		collector: () => new ReactionCollectorBadPetSmallEvent(3, "m", "Rex", [withFields(ReactionCollectorBadPetReaction, { id: "hide" })]),
		data: [ReactionCollectorBadPetSmallEventData, {
			petId: 3, sex: "m", petNickname: "Rex"
		}],
		reactions: [reaction(ReactionCollectorBadPetReaction, { id: "hide" })]
	},
	{
		name: "BigEvent",
		collector: () => new ReactionCollectorBigEvent(8, [
			withFields(ReactionCollectorBigEventPossibilityReaction, { name: "fight" }),
			withFields(ReactionCollectorBigEventPossibilityReaction, { name: "end" })
		]),
		data: [ReactionCollectorBigEventData, { eventId: 8 }],
		reactions: [
			reaction(ReactionCollectorBigEventPossibilityReaction, { name: "fight" }),
			reaction(ReactionCollectorBigEventPossibilityReaction, { name: "end" })
		]
	},
	{
		name: "Cart",
		collector: () => new ReactionCollectorCart({
			isDisplayed: true, id: 4, type: "ci"
		}, 150),
		data: [ReactionCollectorCartData, {
			displayedDestination: {
				isDisplayed: true, id: 4, type: "ci"
			},
			price: 150
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "ChangeClass",
		collector: () => new ReactionCollectorChangeClass([CLASS_DETAILS], 3600),
		data: [ReactionCollectorChangeClassData, {
			classesDetails: [CLASS_DETAILS], cooldownSeconds: 3600
		}],
		reactions: [reaction(ReactionCollectorChangeClassReaction, { classId: 7 }), reaction(ReactionCollectorRefuseReaction)]
	},
	{
		name: "DailyBonus",
		collector: () => new ReactionCollectorDailyBonus([SWORD]),
		data: [ReactionCollectorDailyBonusData, {}],
		reactions: [reaction(ReactionCollectorDailyBonusReaction, { object: SWORD }), reaction(ReactionCollectorRefuseReaction)]
	},
	{
		name: "Drink",
		collector: () => new ReactionCollectorDrink([SWORD]),
		data: [ReactionCollectorDrinkData, {}],
		reactions: [reaction(ReactionCollectorDrinkReaction, { potion: SWORD }), reaction(ReactionCollectorRefuseReaction)]
	},
	{
		name: "EpicShopSmallEvent",
		collector: () => new ReactionCollectorEpicShopSmallEvent(EPIC_SHOP_SMALL_EVENT_DATA),
		data: [ReactionCollectorEpicShopSmallEventData, {
			item: SWORD, price: 900, tip: true
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "Equip",
		collector: () => new ReactionCollectorEquip([]),
		data: [ReactionCollectorEquipData, { categories: [] }],
		reactions: [reaction(ReactionCollectorEquipCloseReaction)]
	},
	{
		name: "Fight",
		collector: () => new ReactionCollectorFight(PLAYER_STATS),
		data: [ReactionCollectorFightData, { playerStats: PLAYER_STATS }],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "FightChooseAction",
		collector: () => new ReactionCollectorFightChooseAction("fight-1", "keycloak-1", [
			withFields(ReactionCollectorFightChooseActionReaction, {
				id: "simpleAttack", powerMultiplier: 1.2
			})
		]),
		data: [ReactionCollectorFightChooseActionData, {
			fightId: "fight-1", fighterKeycloakId: "keycloak-1"
		}],
		reactions: [reaction(ReactionCollectorFightChooseActionReaction, {
			id: "simpleAttack", powerMultiplier: 1.2
		})]
	},
	{
		name: "FightPet",
		collector: () => new ReactionCollectorFightPet(3, true, [withFields(ReactionCollectorFightPetReaction, { actionId: "pat" })]),
		data: [ReactionCollectorFightPetData, {
			petId: 3, isFemale: true
		}],
		reactions: [reaction(ReactionCollectorFightPetReaction, { actionId: "pat" })]
	},
	{
		name: "Gardener",
		collector: () => new ReactionCollectorGardener(PlantId.LUNAR_MOSS, 300, "paid", true),
		data: [ReactionCollectorGardenerData, {
			seedId: PlantId.LUNAR_MOSS, cost: 300, conditionKey: "paid", isFirstEncounter: true
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "GoToPVEIsland",
		collector: () => new ReactionCollectorGoToPVEIsland(250, 40, 100),
		data: [ReactionCollectorGoToPVEIslandData, {
			price: 250,
			energy: {
				current: 40, max: 100
			}
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "GobletsGame",
		collector: () => new ReactionCollectorGobletsGame(),
		data: [ReactionCollectorGobletsGameData, {}],
		reactions: [
			reaction(ReactionCollectorGobletsGameMetalReaction, {
				id: "metal", strategy: SmallEventGobletsGameStrategy.CLASSIC
			}),
			reaction(ReactionCollectorGobletsGameBiggestReaction, {
				id: "biggest", strategy: SmallEventGobletsGameStrategy.SAFE
			}),
			reaction(ReactionCollectorGobletsGameSparklingReaction, {
				id: "sparkling", strategy: SmallEventGobletsGameStrategy.RISKY
			}),
			reaction(ReactionCollectorGobletsGameCrackedReaction, {
				id: "cracked", strategy: SmallEventGobletsGameStrategy.GAMBLER
			})
		]
	},
	{
		name: "GuildCreate",
		collector: () => new ReactionCollectorGuildCreate("Les Élus"),
		data: [ReactionCollectorGuildCreateData, { guildName: "Les Élus" }],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "GuildDescription",
		collector: () => new ReactionCollectorGuildDescription("Une guilde"),
		data: [ReactionCollectorGuildDescriptionData, { description: "Une guilde" }],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "GuildElder",
		collector: () => new ReactionCollectorGuildElder("Les Élus", "keycloak-2"),
		data: [ReactionCollectorGuildElderData, {
			guildName: "Les Élus", promotedKeycloakId: "keycloak-2"
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "GuildElderRemove",
		collector: () => new ReactionCollectorGuildElderRemove("Les Élus", "keycloak-2"),
		data: [ReactionCollectorGuildElderRemoveData, {
			guildName: "Les Élus", demotedKeycloakId: "keycloak-2"
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "GuildInvite",
		collector: () => new ReactionCollectorGuildInvite("Les Élus", "keycloak-3"),
		data: [ReactionCollectorGuildInviteData, {
			guildName: "Les Élus", invitedPlayerKeycloakId: "keycloak-3"
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "GuildKick",
		collector: () => new ReactionCollectorGuildKick("Les Élus", "keycloak-4"),
		data: [ReactionCollectorGuildKickData, {
			guildName: "Les Élus", kickedKeycloakId: "keycloak-4"
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "GuildLeave",
		collector: () => new ReactionCollectorGuildLeave("Les Élus", false, "keycloak-5"),
		data: [ReactionCollectorGuildLeaveData, {
			guildName: "Les Élus", isGuildDestroyed: false, newChiefKeycloakId: "keycloak-5"
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "InteractOtherPlayersPoor",
		collector: () => new ReactionCollectorInteractOtherPlayersPoor("keycloak-6", 12),
		data: [ReactionCollectorInteractOtherPlayersPoorData, {
			keycloakId: "keycloak-6", rank: 12
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "JoinBoat",
		collector: () => new ReactionCollectorJoinBoat(100, 70, 120),
		data: [ReactionCollectorJoinBoatData, {
			price: 100,
			energy: {
				current: 70, max: 120
			}
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "Lottery",
		collector: () => new ReactionCollectorLottery(),
		data: [ReactionCollectorLotteryData, {}],
		reactions: [
			reaction(ReactionCollectorLotteryEasyReaction),
			reaction(ReactionCollectorLotteryMediumReaction),
			reaction(ReactionCollectorLotteryHardReaction)
		]
	},
	{
		name: "PetExpedition",
		collector: () => new ReactionCollectorPetExpedition({
			pet: PET_INFO, mapLocationId: 12, locationType: "forest", riskRate: 20, returnTime: END_TIME
		}),
		data: [ReactionCollectorPetExpeditionData, {
			pet: PET_INFO, mapLocationId: 12, locationType: "forest", riskRate: 20, returnTime: END_TIME
		}],
		reactions: [reaction(ReactionCollectorPetExpeditionRecallReaction), reaction(ReactionCollectorPetExpeditionCloseReaction)]
	},
	{
		name: "PetExpeditionChoice",
		collector: () => new ReactionCollectorPetExpeditionChoice({
			pet: PET_INFO, expeditions: [EXPEDITION], hasGuild: true, guildFoodAmount: 4
		}),
		data: [ReactionCollectorPetExpeditionChoiceData, {
			pet: PET_INFO, expeditions: [EXPEDITION], hasGuild: true, guildFoodAmount: 4
		}],
		reactions: [
			reaction(ReactionCollectorPetExpeditionSelectReaction, { expedition: EXPEDITION }),
			reaction(ReactionCollectorPetExpeditionCancelReaction)
		]
	},
	{
		name: "PetExpeditionFinished",
		collector: () => new ReactionCollectorPetExpeditionFinished({
			pet: PET_INFO, mapLocationId: 12, locationType: "forest", riskRate: 20
		}),
		data: [ReactionCollectorPetExpeditionFinishedData, {
			pet: PET_INFO, mapLocationId: 12, locationType: "forest", riskRate: 20
		}],
		reactions: [reaction(ReactionCollectorPetExpeditionClaimReaction)]
	},
	{
		name: "PetFeedWithGuild",
		collector: () => new ReactionCollectorPetFeedWithGuild(PET, [
			{
				food: PetFood.MEAT, amount: 2, maxAmount: 5
			}
		]),
		data: [ReactionCollectorPetFeedWithGuildData, { pet: PET }],
		reactions: [
			reaction(ReactionCollectorPetFeedWithGuildFoodReaction, {
				food: PetFood.MEAT, amount: 2, maxAmount: 5
			}),
			reaction(ReactionCollectorRefuseReaction)
		]
	},
	{
		name: "PetFeedWithoutGuild",
		collector: () => new ReactionCollectorPetFeedWithoutGuild(PET, PetFood.CANDY, 20),
		data: [ReactionCollectorPetFeedWithoutGuildData, {
			pet: PET, food: PetFood.CANDY, price: 20
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "PetFoodSmallEvent",
		collector: () => new ReactionCollectorPetFoodSmallEvent("commonFood", "f"),
		data: [ReactionCollectorPetFoodSmallEventData, {
			foodType: "commonFood", petSex: "f"
		}],
		reactions: [
			reaction(ReactionCollectorPetFoodInvestigateReaction),
			reaction(ReactionCollectorPetFoodSendPetReaction),
			reaction(ReactionCollectorPetFoodContinueReaction)
		]
	},
	{
		name: "PetFree",
		collector: () => new ReactionCollectorPetFree(3, "m", "Rex", 250),
		data: [ReactionCollectorPetFreeData, {
			petId: 3, petSex: "m", petNickname: "Rex", freeCost: 250
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "PetFreeShelterConfirm",
		collector: () => new ReactionCollectorPetFreeShelterConfirm({
			petEntityId: 99, petId: 3, petSex: "m", petNickname: "Rex", freeCost: 0, isFromShelter: true
		}),
		data: [ReactionCollectorPetFreeShelterConfirmData, {
			petEntityId: 99, petId: 3, petSex: "m", petNickname: "Rex", freeCost: 0, isFromShelter: true
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "PetFreeSelection",
		collector: () => new ReactionCollectorPetFreeSelection(PET, SHELTER_PETS, [
			withFields(ReactionCollectorPetFreeSelectReaction, { petEntityId: 99 }),
			new ReactionCollectorRefuseReaction()
		]),
		data: [ReactionCollectorPetFreeSelectionData, {
			ownPet: PET, shelterPets: SHELTER_PETS
		}],
		reactions: [reaction(ReactionCollectorPetFreeSelectReaction, { petEntityId: 99 }), reaction(ReactionCollectorRefuseReaction)]
	},
	{
		name: "PetSell",
		collector: () => new ReactionCollectorPetSell("keycloak-7", 1_000, PET, "keycloak-8"),
		data: [ReactionCollectorPetSellData, {
			sellerKeycloakId: "keycloak-7", price: 1_000, pet: PET, buyerKeycloakId: "keycloak-8"
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "PetTransfer",
		collector: () => new ReactionCollectorPetTransfer(PET, SHELTER_PETS, [
			new ReactionCollectorPetTransferDepositReaction(),
			withFields(ReactionCollectorPetTransferWithdrawReaction, { petEntityId: 99 })
		]),
		data: [ReactionCollectorPetTransferData, {
			ownPet: PET, shelterPets: SHELTER_PETS
		}],
		reactions: [reaction(ReactionCollectorPetTransferDepositReaction), reaction(ReactionCollectorPetTransferWithdrawReaction, { petEntityId: 99 })]
	},
	{
		name: "PveFight",
		collector: () => new ReactionCollectorPveFight(PVE_FIGHT_DATA),
		data: [ReactionCollectorPveFightData, {
			monster: PVE_FIGHT_DATA.monster, mapId: 5
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "RecipeShopSmallEvent",
		collector: () => new ReactionCollectorRecipeShopSmallEvent(RECIPE_SHOP_DATA),
		data: [ReactionCollectorRecipeShopSmallEventData, {
			source: RecipeShopSource.GASPARD_JO, recipe: RECIPE_SHOP_DATA.recipe, recipeCost: 15
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "Sell",
		collector: () => new ReactionCollectorSell([
			{
				item: {
					category: ItemCategory.WEAPON, id: 42
				},
				slot: 1,
				price: 80
			}
		]),
		data: [ReactionCollectorSellData, {}],
		reactions: [
			reaction(ReactionCollectorSellItemReaction, {
				item: {
					category: ItemCategory.WEAPON, id: 42
				},
				slot: 1,
				price: 80
			}),
			reaction(ReactionCollectorRefuseReaction)
		]
	},
	{
		name: "ShopSmallEvent",
		collector: () => new ReactionCollectorShopSmallEvent(SHOP_SMALL_EVENT_DATA),
		data: [ReactionCollectorShopSmallEventData, {
			item: SWORD, price: 500
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "SkipMissionShopItem",
		collector: () => new ReactionCollectorSkipMissionShopItem([MISSION, MISSION]),
		data: [ReactionCollectorSkipMissionShopItemData, {}],
		reactions: [
			reaction(ReactionCollectorSkipMissionShopItemReaction, {
				mission: MISSION, missionIndex: 0
			}),
			reaction(ReactionCollectorSkipMissionShopItemReaction, {
				mission: MISSION, missionIndex: 1
			}),
			reaction(ReactionCollectorSkipMissionShopItemCloseReaction)
		]
	},
	{
		name: "Unlock",
		collector: () => new ReactionCollectorUnlock("keycloak-9"),
		data: [ReactionCollectorUnlockData, { unlockedKeycloakId: "keycloak-9" }],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "Witch",
		collector: () => new ReactionCollectorWitch([withFields(ReactionCollectorWitchReaction, { id: "mushroom" })]),
		data: [ReactionCollectorWitchData, {}],
		reactions: [reaction(ReactionCollectorWitchReaction, { id: "mushroom" })]
	},
	{
		name: "BuyHeal",
		collector: () => new ReactionCollectorBuyHeal(300, 1_000),
		data: [ReactionCollectorBuyHealData, {
			healPrice: 300, playerMoney: 1_000
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "UseTokens",
		collector: () => new ReactionCollectorUseTokens(2, 5),
		data: [ReactionCollectorUseTokensData, {
			cost: 2, playerTokens: 5
		}],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "Limoges",
		collector: () => new ReactionCollectorLimoges("question1"),
		data: [ReactionCollectorLimogesData, { questionId: "question1" }],
		reactions: ACCEPT_REFUSE
	},
	{
		name: "TokenMerchant",
		collector: () => new ReactionCollectorTokenMerchant(100, 1_000, 3, [1, 5]),
		data: [ReactionCollectorTokenMerchantData, {
			pricePerToken: 100, playerMoney: 1_000, playerTokens: 3, amounts: [1, 5]
		}],
		reactions: [
			reaction(ReactionCollectorTokenMerchantBuyReaction, { amount: 1 }),
			reaction(ReactionCollectorTokenMerchantBuyReaction, { amount: 5 }),
			reaction(ReactionCollectorRefuseReaction)
		]
	}
];

/**
 * The front-end finds its handler and the reactions by the class names sent in the packet: every type must be the
 * name of the class of the data it comes with, and the data must hold the values the Core passed to the collector.
 */
function expectPacket(packet: ReactionCollectorCreationPacket, [DataClassOfPacket, dataFields]: ExpectedData, reactions: ExpectedReaction[]): void {
	expect(packet.id).toBe(ID);
	expect(packet.endTime).toBe(END_TIME);
	expect(packet.data.type).toBe(DataClassOfPacket.name);
	expect(packet.data.data).toBeInstanceOf(DataClassOfPacket);
	expect({ ...packet.data.data }).toEqual(dataFields);
	expect(packet.reactions.map(r => r.type)).toEqual(reactions.map(expected => expected.Class.name));
	packet.reactions.forEach((r, index) => {
		expect(r.data).toBeInstanceOf(reactions[index].Class);
		expect({ ...r.data }).toEqual(reactions[index].fields);
	});
}

function reactionTypes(packet: ReactionCollectorCreationPacket): string[] {
	return packet.reactions.map(r => r.type);
}

describe("ReactionCollector creation packets", () => {
	it.each(CASES.map(collectorCase => [collectorCase.name, collectorCase] as const))("%s sends the collector values with the class names of its data and reactions", (_name, collectorCase) => {
		expectPacket(collectorCase.collector().creationPacket(ID, END_TIME, true), collectorCase.data, collectorCase.reactions);
	});

	it("builds a new data instance for every packet", () => {
		const collector = new ReactionCollectorGuildKick("Les Élus", "keycloak-4");

		expect(collector.creationPacket(ID, END_TIME).data.data).not.toBe(collector.creationPacket(ID, END_TIME).data.data);
	});
});

describe("ReactionCollector creation packets with optional reactions", () => {
	const destination = withFields(ReactionCollectorChooseDestinationReaction, {
		mapId: 3, mapTypeId: "ro", biomes: []
	});

	it("offers to stay in the city only when it is allowed", () => {
		expectPacket(new ReactionCollectorChooseDestination([destination], true).creationPacket(ID, END_TIME), [ReactionCollectorChooseDestinationData, {}], [
			reaction(ReactionCollectorChooseDestinationReaction, {
				mapId: 3, mapTypeId: "ro", biomes: []
			}),
			reaction(ReactionCollectorStayInCityReaction)
		]);
		expect(reactionTypes(new ReactionCollectorChooseDestination([destination]).creationPacket(ID, END_TIME)))
			.toEqual([ReactionCollectorChooseDestinationReaction.name]);
	});

	it("offers to drink the accepted item only when it can be drunk", () => {
		expectPacket(new ReactionCollectorItemAccept(SWORD, true).creationPacket(ID, END_TIME), [ReactionCollectorItemAcceptData, { itemWithDetails: SWORD }], [
			reaction(ReactionCollectorAcceptReaction),
			reaction(ReactionCollectorItemAcceptDrinkPotionReaction),
			reaction(ReactionCollectorRefuseReaction)
		]);
		expect(reactionTypes(new ReactionCollectorItemAccept(SWORD, false).creationPacket(ID, END_TIME)))
			.toEqual([ReactionCollectorAcceptReaction.name, ReactionCollectorRefuseReaction.name]);
	});

	it("offers to drink the chosen item only when it can be drunk", () => {
		const choice = withFields(ReactionCollectorItemChoiceItemReaction, {
			slot: 2, itemWithDetails: SWORD
		});

		expectPacket(new ReactionCollectorItemChoice(ITEM_CHOICE_DATA, [choice], true).creationPacket(ID, END_TIME), [ReactionCollectorItemChoiceData, {
			item: ITEM_CHOICE_DATA.item
		}], [
			reaction(ReactionCollectorItemChoiceItemReaction, {
				slot: 2, itemWithDetails: SWORD
			}),
			reaction(ReactionCollectorItemChoiceDrinkPotionReaction),
			reaction(ReactionCollectorItemChoiceRefuseReaction)
		]);
		expect(reactionTypes(new ReactionCollectorItemChoice(ITEM_CHOICE_DATA, [choice], false).creationPacket(ID, END_TIME)))
			.toEqual([ReactionCollectorItemChoiceItemReaction.name, ReactionCollectorItemChoiceRefuseReaction.name]);
	});

	it("offers each personality, then the default one and refusing to change", () => {
		expectPacket(new ReactionCollectorDefensePersonality({
			classId: 15,
			personalities: ["knightStrategist", "knightFiery"],
			currentPersonality: "knightFiery",
			recentDefenses: []
		}).creationPacket(ID, END_TIME), [ReactionCollectorDefensePersonalityData, {
			classId: 15, currentPersonality: "knightFiery", recentDefenses: []
		}], [
			reaction(ReactionCollectorDefensePersonalityReaction, { personality: "knightStrategist" }),
			reaction(ReactionCollectorDefensePersonalityReaction, { personality: "knightFiery" }),
			reaction(ReactionCollectorDefensePersonalityReaction),
			reaction(ReactionCollectorRefuseReaction)
		]);
	});
});

describe("ReactionCollector creation packets with a main packet flag", () => {
	it.each([
		["BuyHeal", (): ReactionCollector => new ReactionCollectorBuyHeal(300, 1_000)],
		["UseTokens", (): ReactionCollector => new ReactionCollectorUseTokens(2, 5)],
		["TokenMerchant", (): ReactionCollector => new ReactionCollectorTokenMerchant(100, 1_000, 3, [1, 5])],
		["ItemAccept", (): ReactionCollector => new ReactionCollectorItemAccept(SWORD, false)],
		["ItemChoice", (): ReactionCollector => new ReactionCollectorItemChoice(ITEM_CHOICE_DATA, [], false)],
		["Limoges", (): ReactionCollector => new ReactionCollectorLimoges("question1")]
	])("%s forwards the main packet flag", (_name, collectorOf) => {
		expect(collectorOf().creationPacket(ID, END_TIME, false).mainPacket).toBe(false);
		expect(collectorOf().creationPacket(ID, END_TIME, true).mainPacket).toBe(true);
	});

	it("sends the item accept, item choice and limoges collectors as main packets by default", () => {
		expect(new ReactionCollectorItemAccept(SWORD, false).creationPacket(ID, END_TIME).mainPacket).toBe(true);
		expect(new ReactionCollectorItemChoice(ITEM_CHOICE_DATA, [], false).creationPacket(ID, END_TIME).mainPacket).toBe(true);
		expect(new ReactionCollectorLimoges("question1").creationPacket(ID, END_TIME).mainPacket).toBe(true);
	});

	it("always sends the equipment collector as a main packet", () => {
		expect(new ReactionCollectorEquip([]).creationPacket(ID, END_TIME).mainPacket).toBe(true);
	});
});

describe("ReactionCollectorBuyCategorySlot", () => {
	it("offers a slot only for the categories that still have some to buy, with the slots left", () => {
		expectPacket(new ReactionCollectorBuyCategorySlot([0, 2, 0, 1]).creationPacket(ID, END_TIME), [ReactionCollectorBuyCategorySlotData, {}], [
			reaction(ReactionCollectorBuyCategorySlotReaction, {
				categoryId: ItemCategory.ARMOR, maxSlots: ItemConstants.SLOTS.LIMITS[ItemCategory.ARMOR] - 1, remaining: 2
			}),
			reaction(ReactionCollectorBuyCategorySlotReaction, {
				categoryId: ItemCategory.OBJECT, maxSlots: ItemConstants.SLOTS.LIMITS[ItemCategory.OBJECT] - 1, remaining: 1
			}),
			reaction(ReactionCollectorBuyCategorySlotCancelReaction)
		]);
	});

	it("still offers to cancel when no category can be extended", () => {
		expect(reactionTypes(new ReactionCollectorBuyCategorySlot([0, 0, 0, 0]).creationPacket(ID, END_TIME)))
			.toEqual([ReactionCollectorBuyCategorySlotCancelReaction.name]);
	});
});

describe("ReactionCollectorShop", () => {
	const buy = (): boolean => true;
	const categories: ShopCategory[] = [
		{
			id: "permanentItem",
			items: [
				{
					id: ShopItemType.SLOT_EXTENSION, price: 500, amounts: [1], buyCallback: buy
				},
				{
					id: ShopItemType.COMMON_FOOD, price: 20, amounts: [1, 5], buyCallback: buy
				}
			]
		},
		{
			id: "dailyPotion",
			items: [
				{
					id: ShopItemType.DAILY_POTION, price: 300, amounts: [1], buyCallback: buy
				}
			]
		}
	];

	it("offers each amount of each item at the price of the whole amount, then the closing", () => {
		expectPacket(new ReactionCollectorShop(categories, 1_000, { remainingPotions: 3 }).creationPacket(ID, END_TIME), [ReactionCollectorShopData, {
			availableCurrency: 1_000, currency: ShopCurrency.MONEY, additionalShopData: { remainingPotions: 3 }
		}], [
			reaction(ReactionCollectorShopItemReaction, {
				shopCategoryId: "permanentItem", shopItemId: ShopItemType.SLOT_EXTENSION, price: 500, amount: 1
			}),
			reaction(ReactionCollectorShopItemReaction, {
				shopCategoryId: "permanentItem", shopItemId: ShopItemType.COMMON_FOOD, price: 20, amount: 1
			}),
			reaction(ReactionCollectorShopItemReaction, {
				shopCategoryId: "permanentItem", shopItemId: ShopItemType.COMMON_FOOD, price: 100, amount: 5
			}),
			reaction(ReactionCollectorShopItemReaction, {
				shopCategoryId: "dailyPotion", shopItemId: ShopItemType.DAILY_POTION, price: 300, amount: 1
			}),
			reaction(ReactionCollectorShopCloseReaction)
		]);
	});

	it("sells for coins unless another currency is given", () => {
		expect(new ReactionCollectorShop([], 10).creationPacket(ID, END_TIME).data.data.currency).toBe(ShopCurrency.MONEY);
		expect(new ReactionCollectorShop([], 10, { currency: ShopCurrency.GEM }).creationPacket(ID, END_TIME).data.data.currency).toBe(ShopCurrency.GEM);
	});
});
