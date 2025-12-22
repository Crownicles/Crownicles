import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandShopClosed, ShopCategory, ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopUtils } from "../../core/utils/ShopUtils";
import {
	CommandMissionShopAlreadyBoughtPointsThisWeek,
	CommandMissionShopAlreadyHadBadge,
	CommandMissionShopBadge,
	CommandMissionShopKingsFavor,
	CommandMissionShopMoney,
	CommandMissionShopNoMissionToSkip,
	CommandMissionShopNoPet,
	CommandMissionShopPacketReq,
	CommandMissionShopPetInformation,
	CommandMissionShopSkipMissionResult
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import { crowniclesInstance } from "../../index";
import {
	generateRandomItem, giveItemToPlayer
} from "../../core/utils/ItemUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { PetDataController } from "../../data/Pet";
import {
	MissionSlot, MissionSlots
} from "../../core/database/game/models/MissionSlot";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	ReactionCollectorSkipMissionShopItem,
	ReactionCollectorSkipMissionShopItemCloseReaction,
	ReactionCollectorSkipMissionShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import {
	PetConstants, PetDiet
} from "../../../../Lib/src/constants/PetConstants";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { getAiPetBehavior } from "../../core/fights/PetAssistManager";
import { PetUtils } from "../../core/utils/PetUtils";
import { Badge } from "../../../../Lib/src/types/Badge";
import { DwarfPetsSeen } from "../../core/database/game/models/DwarfPetsSeen";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";

/**
 * Calculate the amount of money the player will have if he buys some with gems
 */
function calculateGemsToMoneyRatio(): number {
	/**
	 * Returns the decimal part of a number
	 * @param x
	 */
	const frac = function(x: number): number {
		return x >= 0 ? x % 1 : 1 + x % 1;
	};
	return Constants.MISSION_SHOP.BASE_RATIO
		+ Math.round(Constants.MISSION_SHOP.RANGE_MISSION_MONEY * 2
			* frac(100 * Math.sin(Constants.MISSION_SHOP.SIN_RANDOMIZER * (getDayNumber() % Constants.MISSION_SHOP.SEED_RANGE) + 1))
			- Constants.MISSION_SHOP.RANGE_MISSION_MONEY);
}


function getMoneyShopItem(): ShopItem {
	return {
		id: ShopItemType.MONEY,
		price: Constants.MISSION_SHOP.PRICES.MONEY,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const amount = calculateGemsToMoneyRatio();
			await player.addMoney({
				amount,
				response,
				reason: NumberChangeReason.MISSION_SHOP
			});
			await player.save();
			if (amount < Constants.MISSION_SHOP.KINGS_MONEY_VALUE_THRESHOLD_MISSION) {
				await MissionsController.update(player, response, { missionId: "kingsMoneyValue" });
			}
			response.push(makePacket(CommandMissionShopMoney, {
				amount
			}));
			return true;
		}
	};
}

function getValuableItemShopItem(): ShopItem {
	return {
		id: ShopItemType.TREASURE,
		price: Constants.MISSION_SHOP.PRICES.VALUABLE_ITEM,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number, context: PacketContext): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const item = generateRandomItem({
				minRarity: ItemRarity.SPECIAL
			});
			await giveItemToPlayer(response, context, player, item);
			return true;
		}
	};
}

function getAThousandPointsShopItem(): ShopItem {
	return {
		id: ShopItemType.KINGS_FAVOR,
		price: Constants.MISSION_SHOP.PRICES.THOUSAND_POINTS,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
			if (missionsInfo.hasBoughtPointsThisWeek) {
				response.push(makePacket(CommandMissionShopAlreadyBoughtPointsThisWeek, {}));
				return false;
			}
			await player.addScore({
				amount: Constants.MISSION_SHOP.THOUSAND_POINTS,
				response,
				reason: NumberChangeReason.MISSION_SHOP
			});
			missionsInfo.hasBoughtPointsThisWeek = true;
			response.push(makePacket(CommandMissionShopKingsFavor, {}));
			await Promise.all([player.save(), missionsInfo.save()]);
			return true;
		}
	};
}

function getValueLovePointsPetShopItem(): ShopItem {
	return {
		id: ShopItemType.LOVE_POINTS_VALUE,
		price: Constants.MISSION_SHOP.PRICES.PET_INFORMATION,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			if (player.petId === null) {
				response.push(makePacket(CommandMissionShopNoPet, {}));
				return false;
			}
			const pet = await PetEntities.getById(player.petId);
			const petModel = PetDataController.instance.getById(pet.typeId);
			const randomPetNotShownToDwarfId = await DwarfPetsSeen.getRandomPetNotSeenId(player);
			const randomPetDwarfModel = randomPetNotShownToDwarfId !== 0 ? PetDataController.instance.getById(randomPetNotShownToDwarfId) : null;
			response.push(makePacket(CommandMissionShopPetInformation, {
				nickname: pet.nickname,
				petId: pet.id,
				typeId: petModel.id,
				sex: pet.sex as SexTypeShort,
				loveLevel: pet.getLoveLevelNumber(),
				lovePoints: pet.lovePoints,
				diet: petModel.diet as PetDiet,
				nextFeed: pet.getFeedCooldown(petModel),
				force: petModel.force,
				speed: petModel.speed,
				feedDelay: petModel.feedDelay * PetConstants.BREED_COOLDOWN,
				fightAssistId: getAiPetBehavior(petModel.id).id,
				ageCategory: PetUtils.getAgeCategory(pet.id),
				...randomPetDwarfModel && {
					randomPetDwarf: {
						typeId: randomPetDwarfModel.id,
						sex: PetConstants.SEX.MALE as SexTypeShort,
						numberOfPetsNotSeen: await DwarfPetsSeen.getNumberOfPetsNotSeen(player)
					}
				}
			}));
			return true;
		}
	};
}

function getEndCallbackSkipMissionShopItem(player: Player, missionList: MissionSlot[]): (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => Promise<void> {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => {
		const firstReaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SKIP_MISSION);
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorSkipMissionShopItemCloseReaction.name) {
			response.push(makePacket(CommandShopClosed, {}));
			return;
		}
		const missionIndex: number = (firstReaction.reaction.data as ReactionCollectorSkipMissionShopItemReaction).missionIndex;
		const mission = missionList[missionIndex];
		await mission.destroy();
		const newMission = await MissionsController.addRandomMissionToPlayer(player, MissionsController.getRandomDifficulty(player), mission.missionId);
		response.push(makePacket(CommandMissionShopSkipMissionResult, {
			oldMission: MissionsController.prepareMissionSlot(mission),
			newMission: MissionsController.prepareMissionSlot(newMission)
		}));
		const playerMissionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		await playerMissionsInfo.spendGems(Constants.MISSION_SHOP.PRICES.MISSION_SKIP, response, NumberChangeReason.MISSION_SHOP);
	};
}

function getSkipMapMissionShopItem(): ShopItem {
	return {
		id: ShopItemType.SKIP_MISSION,
		price: Constants.MISSION_SHOP.PRICES.MISSION_SKIP,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number, context: PacketContext): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const missionSlots = await MissionSlots.getOfPlayer(player.id);
			const allMissions = missionSlots.filter(slot => !slot.isCampaign());
			if (!allMissions.length) {
				response.push(makePacket(CommandMissionShopNoMissionToSkip, {}));
				return false;
			}

			const baseMissions = MissionsController.prepareMissionSlots(allMissions);

			const collector = new ReactionCollectorSkipMissionShopItem(baseMissions);

			// Create a reaction collector which will let the player choose the mission he wants to skip
			const packet = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId]
				},
				getEndCallbackSkipMissionShopItem(player, allMissions)
			)
				.block(player.keycloakId, BlockingConstants.REASONS.SKIP_MISSION)
				.build();

			response.push(packet);
			return false;
		}
	};
}

function getBadgeShopItem(): ShopItem {
	return {
		id: ShopItemType.QUEST_MASTER_BADGE,
		price: Constants.MISSION_SHOP.PRICES.BADGE,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			if (await PlayerBadgesManager.hasBadge(player.id, Badge.MISSION_COMPLETER)) {
				response.push(makePacket(CommandMissionShopAlreadyHadBadge, {}));
				return false;
			}
			await PlayerBadgesManager.addBadge(player.id, Badge.MISSION_COMPLETER);
			response.push(makePacket(CommandMissionShopBadge, {}));
			return true;
		}
	};
}

export default class MissionShopCommand {
	@commandRequires(CommandMissionShopPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandMissionShopPacketReq,
		context: PacketContext
	): Promise<void> {
		const shopCategories: ShopCategory[] = [];

		shopCategories.push(
			{
				id: "resources",
				items: [
					getMoneyShopItem(),
					getValuableItemShopItem(),
					getAThousandPointsShopItem()
				]
			},
			{
				id: "utilitaries",
				items: [
					getSkipMapMissionShopItem(),
					getValueLovePointsPetShopItem()
				]
			},
			{
				id: "prestige",
				items: [getBadgeShopItem()]
			}
		);

		await ShopUtils.createAndSendShopCollector(context, response, {
			shopCategories,
			player,
			logger: crowniclesInstance.logsDatabase.logMissionShopBuyout,
			additionalShopData: {
				currency: ShopCurrency.GEM,
				gemToMoneyRatio: calculateGemsToMoneyRatio()
			}
		});
	}
}
