import { packetHandler } from "../PacketHandler";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCreationPacket,
	ReactionCollectorEnded
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorBigEventData } from "../../../../Lib/src/packets/interaction/ReactionCollectorBigEvent";
import {
	chooseDestinationCollector,
	createBigEventCollector,
	createBuyHealCollector,
	createUseTokensCollector,
	handleStartPveFight
} from "../../commands/player/ReportCommand";
import { ReactionCollectorChooseDestinationData } from "../../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import { ReactionCollectorUseTokensData } from "../../../../Lib/src/packets/interaction/ReactionCollectorUseTokens";
import { ReactionCollectorBuyHealData } from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyHeal";
import { ReactionCollectorGoToPVEIslandData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGoToPVEIsland";
import { goToPVEIslandCollector } from "../../smallEvents/goToPVEIsland";
import { ReactionCollectorLotteryData } from "../../../../Lib/src/packets/interaction/ReactionCollectorLottery";
import { lotteryCollector } from "../../smallEvents/lottery";
import {
	ReactionCollectorPetFreeData,
	ReactionCollectorPetFreeSelectionData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFree";
import {
	createPetFreeCollector,
	createPetFreeSelectionCollector
} from "../../commands/pet/PetFreeCommand";
import { ReactionCollectorInteractOtherPlayersPoorData } from "../../../../Lib/src/packets/interaction/ReactionCollectorInteractOtherPlayers";
import { interactOtherPlayersCollector } from "../../smallEvents/interactOtherPlayers";
import { ReactionCollectorLimogesData } from "../../../../Lib/src/packets/interaction/ReactionCollectorLimoges";
import { limogesCollector } from "../../smallEvents/limoges";
import { ReactionCollectorWitchData } from "../../../../Lib/src/packets/interaction/ReactionCollectorWitch";
import { witchCollector } from "../../smallEvents/witch";
import { ReactionCollectorItemChoiceData } from "../../../../Lib/src/packets/interaction/ReactionCollectorItemChoice";
import {
	itemAcceptCollector, itemChoiceCollector
} from "../../inventory/ItemCollectors";
import { ReactionCollectorItemAcceptData } from "../../../../Lib/src/packets/interaction/ReactionCollectorItemAccept";
import { ReactionCollectorGuildCreateData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import { createGuildCreateCollector } from "../../commands/guild/GuildCreateCommand";
import { ReactionCollectorGuildInviteData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildInvite.js";
import { createGuildInviteCollector } from "../../commands/guild/GuildInviteCommand.js";
import { ReactionCollectorShopData } from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	shopCollector, shopInventoryExtensionCollector
} from "../../commands/player/ShopCommand";
import { ReactionCollectorBuyCategorySlotData } from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import { ReactionCollectorCartData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCart";
import { cartCollector } from "../../smallEvents/cart";
import { ReactionCollectorFightPetData } from "../../../../Lib/src/packets/interaction/ReactionCollectorFightPet";
import { fightPetCollector } from "../../smallEvents/fightPet";
import { ReactionCollectorGuildKickData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildKick";
import { createGuildKickCollector } from "../../commands/guild/GuildKickCommand";
import { ReactionCollectorGobletsGameData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGobletsGame";
import { gobletsGameCollector } from "../../smallEvents/gobletsGame";
import { createUnlockCollector } from "../../commands/player/UnlockCommand";
import { ReactionCollectorUnlockData } from "../../../../Lib/src/packets/interaction/ReactionCollectorUnlock";
import { smallShopCollector } from "../../smallEvents/shop";
import { epicItemShopCollector } from "../../smallEvents/epicItemShop";
import { ReactionCollectorPetFoodSmallEventData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFoodSmallEvent";
import { petFoodCollector } from "../../smallEvents/petFood";
import { ReactionCollectorBadPetSmallEventData } from "../../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { badPetCollector } from "../../smallEvents/badPet";
import { ReactionCollectorEpicShopSmallEventData } from "../../../../Lib/src/packets/interaction/ReactionCollectorEpicShopSmallEvent";
import { ReactionCollectorShopSmallEventData } from "../../../../Lib/src/packets/interaction/ReactionCollectorShopSmallEvent";
import { ReactionCollectorSkipMissionShopItemData } from "../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import { skipMissionShopItemCollector } from "../../commands/mission/MissionShop";
import { createGuildElderCollector } from "../../commands/guild/GuildElderCommand";
import { ReactionCollectorGuildElderData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildElder";
import {
	createFightCollector, handleCommandFightActionChoose
} from "../../commands/player/FightCommand";
import { ReactionCollectorFightData } from "../../../../Lib/src/packets/interaction/ReactionCollectorFight";
import { ReactionCollectorGuildLeaveData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import { createGuildLeaveCollector } from "../../commands/guild/GuildLeaveCommand";
import { ReactionCollectorSwitchItemData } from "../../../../Lib/src/packets/interaction/ReactionCollectorSwitchItem";
import { switchItemCollector } from "../../commands/player/SwitchCommand";
import { ReactionCollectorGuildElderRemoveData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildElderRemove";
import { createGuildElderRemoveCollector } from "../../commands/guild/GuildElderRemoveCommand";
import { ReactionCollectorGuildDescriptionData } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildDescription";
import { createGuildDescriptionCollector } from "../../commands/guild/GuildDescriptionCommand";
import { ReactionCollectorDrinkData } from "../../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import { drinkAcceptCollector } from "../../commands/player/DrinkCommand";
import { ReactionCollectorPetSellData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetSell";
import { createPetSellCollector } from "../../commands/pet/PetSellCommand";
import { Collector } from "discord.js";
import { ReactionCollectorStopPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import { ReactionCollectorResetTimerPacketRes } from "../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { ReactionCollectorChangeClassData } from "../../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";
import { handleChangeClassReactionCollector } from "../../commands/player/ClassesCommand";
import { ReactionCollectorSellData } from "../../../../Lib/src/packets/interaction/ReactionCollectorSell";
import { handleSellReactionCollector } from "../../commands/player/SellCommand";
import { ReactionCollectorFightChooseActionData } from "../../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";
import { handlePetTransferReactionCollector } from "../../commands/pet/PetTransferCommand";
import { ReactionCollectorPetTransferData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetTransfer";
import { ReactionCollectorPetFeedWithGuildData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithGuild";
import {
	handleCommandPetFeedWithGuildCollector,
	handleCommandPetFeedWithoutGuildCollector
} from "../../commands/pet/PetFeedCommand";
import { ReactionCollectorPetFeedWithoutGuildData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithoutGuild";
import { createJoinBoatCollector } from "../../commands/player/JoinBoatCommand";
import { ReactionCollectorJoinBoatData } from "../../../../Lib/src/packets/interaction/ReactionCollectorJoinBoat";
import { ReactionCollectorPveFightData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPveFight";
import { handleClassicError } from "../../utils/ErrorUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { ReactionCollectorDailyBonusData } from "../../../../Lib/src/packets/interaction/ReactionCollectorDailyBonus";
import { handleDailyBonusCollector } from "../../commands/player/DailyBonusCommand";
import { ReactionCollectorDeposeItemData } from "../../../../Lib/src/packets/interaction/ReactionCollectorDeposeItem";
import { deposeItemCollector } from "../../commands/player/DepositCommand";
import { ReactionCollectorPetExpeditionData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpedition";
import { ReactionCollectorPetExpeditionChoiceData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionChoice";
import { ReactionCollectorPetExpeditionFinishedData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionFinished";
import {
	createPetExpeditionCollector,
	createPetExpeditionChoiceCollector,
	createPetExpeditionFinishedCollector
} from "../../commands/pet/PetExpeditionCollectors";

// Needed because we need to accept any parameter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactionCollectorReturnType = Collector<any, any, any>[];

export type ReactionCollectorReturnTypeOrNull = ReactionCollectorReturnType | null;

export default class ReactionCollectorHandler {
	private static collectorsCache: Map<string, ReactionCollectorReturnType> = new Map();

	/**
	 * Registry of collector handlers. Uses `any` for generic parameters because TypeScript's
	 * contravariance on function parameters prevents storing handlers with specific packet types
	 * in a map expecting the base type. Type safety is ensured within each individual handler.
	 */
	static collectorMap: Map<
		string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(context: PacketContext, packet: ReactionCollectorCreationPacket<any, any>) => Promise<ReactionCollectorReturnTypeOrNull>
	>;

	static initCollectorMap(): void {
		ReactionCollectorHandler.collectorMap = new Map();
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorBigEventData.name, createBigEventCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorChooseDestinationData.name, chooseDestinationCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGoToPVEIslandData.name, goToPVEIslandCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorJoinBoatData.name, createJoinBoatCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetFreeData.name, createPetFreeCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetFreeSelectionData.name, createPetFreeSelectionCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGuildCreateData.name, createGuildCreateCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGuildKickData.name, createGuildKickCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGuildDescriptionData.name, createGuildDescriptionCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGuildElderData.name, createGuildElderCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGuildElderRemoveData.name, createGuildElderRemoveCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGuildLeaveData.name, createGuildLeaveCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorLotteryData.name, lotteryCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorInteractOtherPlayersPoorData.name, interactOtherPlayersCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorWitchData.name, witchCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorItemChoiceData.name, itemChoiceCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorItemAcceptData.name, itemAcceptCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorShopData.name, shopCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorBuyCategorySlotData.name, shopInventoryExtensionCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorCartData.name, cartCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorFightPetData.name, fightPetCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGuildInviteData.name, createGuildInviteCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorGobletsGameData.name, gobletsGameCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorUnlockData.name, createUnlockCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorShopSmallEventData.name, smallShopCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetFoodSmallEventData.name, petFoodCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorBadPetSmallEventData.name, badPetCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorEpicShopSmallEventData.name, epicItemShopCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorSkipMissionShopItemData.name, skipMissionShopItemCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorFightData.name, createFightCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorSwitchItemData.name, switchItemCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorDeposeItemData.name, deposeItemCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorDrinkData.name, drinkAcceptCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetSellData.name, createPetSellCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorChangeClassData.name, handleChangeClassReactionCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorSellData.name, handleSellReactionCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorFightChooseActionData.name, handleCommandFightActionChoose);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetTransferData.name, handlePetTransferReactionCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetFeedWithGuildData.name, handleCommandPetFeedWithGuildCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetFeedWithoutGuildData.name, handleCommandPetFeedWithoutGuildCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPveFightData.name, handleStartPveFight);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorDailyBonusData.name, handleDailyBonusCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorLimogesData.name, limogesCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetExpeditionData.name, createPetExpeditionCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetExpeditionChoiceData.name, createPetExpeditionChoiceCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorPetExpeditionFinishedData.name, createPetExpeditionFinishedCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorUseTokensData.name, createUseTokensCollector);
		ReactionCollectorHandler.collectorMap.set(ReactionCollectorBuyHealData.name, createBuyHealCollector);
	}

	@packetHandler(ReactionCollectorCreationPacket)
	async collectorCreation(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<void> {
		if (!ReactionCollectorHandler.collectorMap) {
			ReactionCollectorHandler.initCollectorMap();
		}
		const collector = ReactionCollectorHandler.collectorMap.get(packet.data.type);
		if (!collector) {
			CrowniclesLogger.error("Unknown collector type", { type: packet.data.type });
			await handleClassicError(context, "error:aDevMessedUp");
			return;
		}
		const createdCollector = await collector(context, packet);

		if (createdCollector) {
			ReactionCollectorHandler.collectorsCache.set(packet.id, createdCollector);
		}
	}

	@packetHandler(ReactionCollectorStopPacket)
	async collectorStop(_context: PacketContext, packet: ReactionCollectorStopPacket): Promise<void> {
		const collector = ReactionCollectorHandler.collectorsCache.get(packet.id);
		if (!collector) {
			CrowniclesLogger.warn(`Collector stop received for collector with ID ${packet.id} but no collector was found with this ID`);
			return;
		}
		collector.forEach(c => {
			if (c.ended) {
				CrowniclesLogger.warn(`Collector stop received for collector with ID ${packet.id} but collector was already stopped`);
				return;
			}
			c.stop();
		});
		ReactionCollectorHandler.collectorsCache.delete(packet.id);
		await Promise.resolve();
	}

	@packetHandler(ReactionCollectorEnded)
	async collectorEnded(_context: PacketContext, _packet: ReactionCollectorEnded): Promise<void> {
		// Ignore
	}

	@packetHandler(ReactionCollectorResetTimerPacketRes)
	async collectorResetTimer(_context: PacketContext, packet: ReactionCollectorResetTimerPacketRes): Promise<void> {
		const collector = ReactionCollectorHandler.collectorsCache.get(packet.reactionCollectorId);
		if (!collector) {
			CrowniclesLogger.warn(`Collector reset timer received for collector with ID ${packet.reactionCollectorId} but no collector was found with this ID`);
			return;
		}
		collector.forEach(c => {
			if (c.ended) {
				CrowniclesLogger.warn(`Collector reset timer received for collector with ID ${packet.reactionCollectorId} but collector was already stopped`);
				return;
			}
			c.resetTimer({
				time: packet.endTime - Date.now()
			});
		});
		await Promise.resolve();
	}
}
