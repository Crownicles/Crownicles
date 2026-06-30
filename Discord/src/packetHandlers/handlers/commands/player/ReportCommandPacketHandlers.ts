import { packetHandler } from "../../../PacketHandler";
import {
	CommandReportApartmentAlreadyOwnedRes,
	CommandReportApartmentBuyRes,
	CommandReportApartmentClaimRentRes,
	CommandReportApartmentClaimRentTooLowRes,
	CommandReportApartmentRequiresHomeRes,
	CommandReportBigEventResultRes,
	CommandReportBlacksmithDisenchantRes,
	CommandReportBlacksmithMissingMaterialsRes,
	CommandReportBlacksmithNotEnoughMoneyRes,
	CommandReportBlacksmithUpgradeRes,
	CommandReportRoyalBlacksmithMissingMaterialsRes,
	CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes,
	CommandReportRoyalBlacksmithMockBadgeGivenRes,
	CommandReportRoyalBlacksmithNotEnoughGemsRes,
	CommandReportRoyalBlacksmithNotEnoughMoneyRes,
	CommandReportRoyalBlacksmithUpgradeRes,
	CommandReportBuyHealAcceptPacketRes,
	CommandReportBuyHealCannotHealOccupiedPacketRes,
	CommandReportBuyHealNoAlterationPacketRes,
	CommandReportBuyHealRefusePacketRes,
	CommandReportBuyHomeRes,
	CommandReportEatInnMealCooldownRes,
	CommandReportEatInnMealRes,
	CommandReportEnchantNotEnoughCurrenciesRes,
	CommandReportErrorNoMonsterRes,
	CommandReportGardenCompostNotEnoughPlantsRes,
	CommandReportGardenCompostRes,
	CommandReportHomeBedAlreadyFullRes,
	CommandReportHomeBedRes,
	CommandReportBedCooldownRes,
	CommandReportItemCannotBeEnchantedRes,
	CommandReportItemEnchantedRes,
	CommandReportMonsterRewardRes,
	CommandReportMoveHomeRes,
	CommandReportNotEnoughMoneyRes,
	CommandReportRefusePveFightRes,
	CommandReportSleepRoomRes,
	CommandReportStayInCity,
	CommandReportTravelSummaryRes,
	CommandReportUpgradeHomeRes,
	CommandReportUpgradeItemMaxLevelRes,
	CommandReportUpgradeItemMissingMaterialsRes,
	CommandReportUpgradeItemRes,
	CommandReportUseTokensAcceptPacketRes,
	CommandReportUseTokensRefusePacketRes,
	CommandReportTokenMerchantBoughtRes,
	CommandReportTokenMerchantTooMuchRes,
	CommandReportTokenMerchantFullRes,
	CommandReportTokenMerchantRefuseRes,
	CommandReportTokenMerchantCannotAffordRes,
	CommandReportTokenMerchantCharityRes,
	CommandReportTokenMerchantCharityAlreadyUsedRes,
	CommandReportGuildDomainPurchaseRes,
	CommandReportGuildDomainRelocateRes,
	CommandReportGuildDomainNotEnoughTreasuryRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	reportResult,
	stayInCity
} from "../../../../commands/player/ReportCommand";
import { sendBlacksmithReply } from "../../../../commands/player/report/blacksmith/BlacksmithHandlers";
import {
	handleBuyHealAccept,
	handleBuyHealCannotHealOccupied,
	handleBuyHealNoAlteration,
	handleBuyHealRefuse
} from "../../../../commands/player/report/buyHeal/BuyHealHandlers";
import {
	handleGuildDomainNotEnoughTreasury,
	handleGuildDomainPurchase,
	handleGuildDomainRelocate
} from "../../../../commands/player/report/guildDomain/GuildDomainHandlers";
import {
	HOME_REPORT_DESCRIPTORS,
	handleMoveHome,
	sendHomeReport
} from "../../../../commands/player/report/home/HomeHandlers";
import {
	handleEatInnMeal,
	handleInnRoom
} from "../../../../commands/player/report/inn/InnHandlers";
import {
	handleGardenCompost,
	handleGardenCompostNotEnoughPlants
} from "../../../../commands/player/report/home/features/GardenCompostHandlers";
import {
	displayMonsterReward,
	refusePveFight
} from "../../../../commands/player/report/pveFight/PveFightHandlers";
import { reportTravelSummary } from "../../../../commands/player/report/travel/TravelSummary";
import {
	handleUseTokensAccept,
	handleUseTokensRefuse
} from "../../../../commands/player/report/useTokens/UseTokensHandlers";
import {
	handleTokenMerchantBought,
	handleTokenMerchantCannotAfford,
	handleTokenMerchantCharity,
	handleTokenMerchantCharityAlreadyUsed,
	handleTokenMerchantFull,
	handleTokenMerchantRefuse,
	handleTokenMerchantTooMuch
} from "../../../../commands/player/report/tokenMerchant/TokenMerchantHandlers";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class ReportCommandPacketHandlers {
	@packetHandler(CommandReportBigEventResultRes)
	async reportResultRes(context: PacketContext, packet: CommandReportBigEventResultRes): Promise<void> {
		await reportResult(packet, context);
	}

	@packetHandler(CommandReportTravelSummaryRes)
	async reportTravelSummaryRes(context: PacketContext, packet: CommandReportTravelSummaryRes): Promise<void> {
		await reportTravelSummary(packet, context);
	}

	@packetHandler(CommandReportMonsterRewardRes)
	async reportMonsterRewardRes(context: PacketContext, packet: CommandReportMonsterRewardRes): Promise<void> {
		await displayMonsterReward(packet, context);
	}

	@packetHandler(CommandReportErrorNoMonsterRes)
	async reportErrorNoMonsterRes(context: PacketContext, _packet: CommandReportErrorNoMonsterRes): Promise<void> {
		await handleClassicError(context, "commands:fight.monsterNotFound");
	}

	@packetHandler(CommandReportRefusePveFightRes)
	async reportRefusePveFightRes(context: PacketContext, packet: CommandReportRefusePveFightRes): Promise<void> {
		await refusePveFight(packet, context);
	}

	@packetHandler(CommandReportStayInCity)
	async reportStayInCity(context: PacketContext, _packet: CommandReportStayInCity): Promise<void> {
		await stayInCity(context);
	}

	@packetHandler(CommandReportEatInnMealRes)
	async reportEatInnMealRes(context: PacketContext, packet: CommandReportEatInnMealRes): Promise<void> {
		await handleEatInnMeal(packet, context);
	}

	@packetHandler(CommandReportGardenCompostRes)
	async reportGardenCompostRes(context: PacketContext, packet: CommandReportGardenCompostRes): Promise<void> {
		await handleGardenCompost(packet, context);
	}

	@packetHandler(CommandReportGardenCompostNotEnoughPlantsRes)
	async reportGardenCompostNotEnoughPlantsRes(context: PacketContext, packet: CommandReportGardenCompostNotEnoughPlantsRes): Promise<void> {
		await handleGardenCompostNotEnoughPlants(packet, context);
	}

	@packetHandler(CommandReportEatInnMealCooldownRes)
	async reportEatInnMealCooldownRes(context: PacketContext, packet: CommandReportEatInnMealCooldownRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.inns.eatMealCooldown", {
			nextAvailableAt: Math.floor(packet.nextAvailableAt / 1000)
		});
	}

	@packetHandler(CommandReportSleepRoomRes)
	async reportSleepRoomRes(context: PacketContext, packet: CommandReportSleepRoomRes): Promise<void> {
		await handleInnRoom(packet, context);
	}

	@packetHandler(CommandReportNotEnoughMoneyRes)
	async reportNotEnoughMoneyRes(context: PacketContext, packet: CommandReportNotEnoughMoneyRes): Promise<void> {
		await handleClassicError(context, "error:notEnoughMoney", { money: packet.missingMoney });
	}

	@packetHandler(CommandReportEnchantNotEnoughCurrenciesRes)
	async reportEnchantNotEnoughCurrenciesRes(context: PacketContext, packet: CommandReportEnchantNotEnoughCurrenciesRes): Promise<void> {
		const tr = packet.missingMoney > 0
			? packet.missingGems > 0
				? "commands:report.city.enchanter.notEnoughMoneyAndGems"
				: "commands:report.city.enchanter.notEnoughMoney"
			: "commands:report.city.enchanter.notEnoughGems";
		await handleClassicError(context, tr, {
			missingMoney: packet.missingMoney, missingGems: packet.missingGems
		});
	}

	@packetHandler(CommandReportItemEnchantedRes)
	async reportItemEnchantedRes(context: PacketContext, packet: CommandReportItemEnchantedRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.enchanter.acceptTitle",
			descriptionKey: "commands:report.city.enchanter.acceptStory",
			descriptionParams: {
				enchantmentId: packet.enchantmentId,
				enchantmentType: packet.enchantmentType
			}
		});
	}

	@packetHandler(CommandReportItemCannotBeEnchantedRes)
	async reportItemCannotBeEnchantedRes(context: PacketContext, _packet: CommandReportItemCannotBeEnchantedRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.enchanter.cantEnchant");
	}

	@packetHandler(CommandReportBuyHomeRes)
	async reportBuyHomeRes(context: PacketContext, packet: CommandReportBuyHomeRes): Promise<void> {
		await sendHomeReport(HOME_REPORT_DESCRIPTORS.buyHome, packet, context);
	}

	@packetHandler(CommandReportUpgradeHomeRes)
	async reportUpgradeHomeRes(context: PacketContext, packet: CommandReportUpgradeHomeRes): Promise<void> {
		await sendHomeReport(HOME_REPORT_DESCRIPTORS.upgradeHome, packet, context);
	}

	@packetHandler(CommandReportMoveHomeRes)
	async reportMoveHomeRes(context: PacketContext, packet: CommandReportMoveHomeRes): Promise<void> {
		await handleMoveHome(packet, context);
	}

	@packetHandler(CommandReportApartmentBuyRes)
	async reportApartmentBuyRes(context: PacketContext, packet: CommandReportApartmentBuyRes): Promise<void> {
		await sendHomeReport(HOME_REPORT_DESCRIPTORS.apartmentBuy, packet, context);
	}

	@packetHandler(CommandReportApartmentClaimRentRes)
	async reportApartmentClaimRentRes(context: PacketContext, packet: CommandReportApartmentClaimRentRes): Promise<void> {
		await sendHomeReport(HOME_REPORT_DESCRIPTORS.apartmentClaimRent, packet, context);
	}

	@packetHandler(CommandReportApartmentClaimRentTooLowRes)
	async reportApartmentClaimRentTooLowRes(context: PacketContext, packet: CommandReportApartmentClaimRentTooLowRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.homes.apartmentNotary.claimTooLow", {
			mapLocationId: packet.mapLocationId,
			current: packet.currentRent,
			min: packet.minRequired
		});
	}

	@packetHandler(CommandReportApartmentAlreadyOwnedRes)
	async reportApartmentAlreadyOwnedRes(context: PacketContext, packet: CommandReportApartmentAlreadyOwnedRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.homes.apartmentNotary.buyAlreadyOwned", {
			mapLocationId: packet.mapLocationId
		});
	}

	@packetHandler(CommandReportApartmentRequiresHomeRes)
	async reportApartmentRequiresHomeRes(context: PacketContext, packet: CommandReportApartmentRequiresHomeRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.homes.apartmentNotary.buyRequiresHome", {
			mapLocationId: packet.mapLocationId
		});
	}

	@packetHandler(CommandReportUseTokensAcceptPacketRes)
	async reportUseTokensAcceptRes(context: PacketContext, packet: CommandReportUseTokensAcceptPacketRes): Promise<void> {
		await handleUseTokensAccept(packet, context);
	}

	@packetHandler(CommandReportUseTokensRefusePacketRes)
	async reportUseTokensRefuseRes(context: PacketContext, _packet: CommandReportUseTokensRefusePacketRes): Promise<void> {
		await handleUseTokensRefuse(context);
	}

	@packetHandler(CommandReportTokenMerchantBoughtRes)
	async reportTokenMerchantBoughtRes(context: PacketContext, packet: CommandReportTokenMerchantBoughtRes): Promise<void> {
		await handleTokenMerchantBought(packet, context);
	}

	@packetHandler(CommandReportTokenMerchantTooMuchRes)
	async reportTokenMerchantTooMuchRes(context: PacketContext, _packet: CommandReportTokenMerchantTooMuchRes): Promise<void> {
		await handleTokenMerchantTooMuch(context);
	}

	@packetHandler(CommandReportTokenMerchantFullRes)
	async reportTokenMerchantFullRes(context: PacketContext, _packet: CommandReportTokenMerchantFullRes): Promise<void> {
		await handleTokenMerchantFull(context);
	}

	@packetHandler(CommandReportTokenMerchantRefuseRes)
	async reportTokenMerchantRefuseRes(context: PacketContext, _packet: CommandReportTokenMerchantRefuseRes): Promise<void> {
		await handleTokenMerchantRefuse(context);
	}

	@packetHandler(CommandReportTokenMerchantCannotAffordRes)
	async reportTokenMerchantCannotAffordRes(context: PacketContext, _packet: CommandReportTokenMerchantCannotAffordRes): Promise<void> {
		await handleTokenMerchantCannotAfford(context);
	}

	@packetHandler(CommandReportTokenMerchantCharityRes)
	async reportTokenMerchantCharityRes(context: PacketContext, packet: CommandReportTokenMerchantCharityRes): Promise<void> {
		await handleTokenMerchantCharity(packet, context);
	}

	@packetHandler(CommandReportTokenMerchantCharityAlreadyUsedRes)
	async reportTokenMerchantCharityAlreadyUsedRes(context: PacketContext, _packet: CommandReportTokenMerchantCharityAlreadyUsedRes): Promise<void> {
		await handleTokenMerchantCharityAlreadyUsed(context);
	}

	@packetHandler(CommandReportBuyHealAcceptPacketRes)
	async reportBuyHealAcceptRes(context: PacketContext, packet: CommandReportBuyHealAcceptPacketRes): Promise<void> {
		await handleBuyHealAccept(packet, context);
	}

	@packetHandler(CommandReportBuyHealRefusePacketRes)
	async reportBuyHealRefuseRes(context: PacketContext, _packet: CommandReportBuyHealRefusePacketRes): Promise<void> {
		await handleBuyHealRefuse(context);
	}

	@packetHandler(CommandReportBuyHealNoAlterationPacketRes)
	async reportBuyHealNoAlterationRes(context: PacketContext, _packet: CommandReportBuyHealNoAlterationPacketRes): Promise<void> {
		await handleBuyHealNoAlteration(context);
	}

	@packetHandler(CommandReportBuyHealCannotHealOccupiedPacketRes)
	async reportBuyHealCannotHealOccupiedRes(context: PacketContext, _packet: CommandReportBuyHealCannotHealOccupiedPacketRes): Promise<void> {
		await handleBuyHealCannotHealOccupied(context);
	}

	@packetHandler(CommandReportUpgradeItemRes)
	async reportUpgradeItemRes(context: PacketContext, packet: CommandReportUpgradeItemRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.homes.upgradeItemTitle",
			descriptionKey: "commands:report.city.homes.upgradeItemDescription",
			descriptionParams: { newLevel: packet.newItemLevel }
		});
	}

	@packetHandler(CommandReportUpgradeItemMissingMaterialsRes)
	async reportUpgradeItemMissingMaterialsRes(context: PacketContext, _packet: CommandReportUpgradeItemMissingMaterialsRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.homes.upgradeItemMissingMaterialsTitle",
			descriptionKey: "commands:report.city.homes.upgradeItemMissingMaterialsDescription"
		});
	}

	@packetHandler(CommandReportUpgradeItemMaxLevelRes)
	async reportUpgradeItemMaxLevelRes(context: PacketContext, _packet: CommandReportUpgradeItemMaxLevelRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.homes.upgradeItemMaxLevelTitle",
			descriptionKey: "commands:report.city.homes.upgradeItemMaxLevelDescription"
		});
	}

	@packetHandler(CommandReportBlacksmithUpgradeRes)
	async reportBlacksmithUpgradeRes(context: PacketContext, packet: CommandReportBlacksmithUpgradeRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.blacksmith.upgradeTitle",
			descriptionKey: packet.boughtMaterials
				? "commands:report.city.blacksmith.upgradeSuccessWithBuy"
				: "commands:report.city.blacksmith.upgradeSuccess",
			descriptionParams: { newLevel: packet.newItemLevel }
		});
	}

	@packetHandler(CommandReportBlacksmithNotEnoughMoneyRes)
	async reportBlacksmithNotEnoughMoneyRes(context: PacketContext, packet: CommandReportBlacksmithNotEnoughMoneyRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.blacksmith.title",
			descriptionKey: "commands:report.city.blacksmith.notEnoughMoney",
			descriptionParams: { missingMoney: packet.missingMoney }
		});
	}

	@packetHandler(CommandReportBlacksmithMissingMaterialsRes)
	async reportBlacksmithMissingMaterialsRes(context: PacketContext, _packet: CommandReportBlacksmithMissingMaterialsRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.blacksmith.missingMaterialsTitle",
			descriptionKey: "commands:report.city.blacksmith.missingMaterialsDescription"
		});
	}

	@packetHandler(CommandReportBlacksmithDisenchantRes)
	async reportBlacksmithDisenchantRes(context: PacketContext, _packet: CommandReportBlacksmithDisenchantRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.blacksmith.disenchantTitle",
			descriptionKey: "commands:report.city.blacksmith.disenchantSuccess"
		});
	}

	@packetHandler(CommandReportRoyalBlacksmithUpgradeRes)
	async reportRoyalBlacksmithUpgradeRes(context: PacketContext, packet: CommandReportRoyalBlacksmithUpgradeRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.royalBlacksmith.title",
			descriptionKey: packet.boughtMaterials
				? "commands:report.city.royalBlacksmith.upgradeSuccessWithBuy"
				: "commands:report.city.royalBlacksmith.upgradeSuccess",
			descriptionParams: {
				upgradeCost: packet.upgradeCost,
				materialsCost: packet.materialsCost,
				gemCost: packet.gemCost
			}
		});
	}

	@packetHandler(CommandReportRoyalBlacksmithNotEnoughMoneyRes)
	async reportRoyalBlacksmithNotEnoughMoneyRes(context: PacketContext, packet: CommandReportRoyalBlacksmithNotEnoughMoneyRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.royalBlacksmith.title",
			descriptionKey: "commands:report.city.royalBlacksmith.notEnoughMoney",
			descriptionParams: { missingMoney: packet.missingMoney }
		});
	}

	@packetHandler(CommandReportRoyalBlacksmithNotEnoughGemsRes)
	async reportRoyalBlacksmithNotEnoughGemsRes(context: PacketContext, packet: CommandReportRoyalBlacksmithNotEnoughGemsRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.royalBlacksmith.title",
			descriptionKey: "commands:report.city.royalBlacksmith.notEnoughGems",
			descriptionParams: { missingGems: packet.missingGems }
		});
	}

	@packetHandler(CommandReportRoyalBlacksmithMissingMaterialsRes)
	async reportRoyalBlacksmithMissingMaterialsRes(context: PacketContext, _packet: CommandReportRoyalBlacksmithMissingMaterialsRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.royalBlacksmith.title",
			descriptionKey: "commands:report.city.royalBlacksmith.missingMaterials"
		});
	}

	@packetHandler(CommandReportRoyalBlacksmithMockBadgeGivenRes)
	async reportRoyalBlacksmithMockBadgeGivenRes(context: PacketContext, _packet: CommandReportRoyalBlacksmithMockBadgeGivenRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.royalBlacksmith.title",
			descriptionKey: "commands:report.city.royalBlacksmith.mockBadgeGiven"
		});
	}

	@packetHandler(CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes)
	async reportRoyalBlacksmithMockBadgeAlreadyOwnedRes(context: PacketContext, _packet: CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes): Promise<void> {
		await sendBlacksmithReply({
			context,
			titleKey: "commands:report.city.royalBlacksmith.title",
			descriptionKey: "commands:report.city.royalBlacksmith.mockBadgeAlreadyOwned"
		});
	}

	@packetHandler(CommandReportHomeBedRes)
	async reportHomeBedRes(context: PacketContext, packet: CommandReportHomeBedRes): Promise<void> {
		await sendHomeReport(HOME_REPORT_DESCRIPTORS.homeBed, packet, context);
	}

	@packetHandler(CommandReportHomeBedAlreadyFullRes)
	async reportHomeBedAlreadyFullRes(context: PacketContext, _packet: CommandReportHomeBedAlreadyFullRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.homes.bed.alreadyFull");
	}

	@packetHandler(CommandReportBedCooldownRes)
	async reportBedCooldownRes(context: PacketContext, packet: CommandReportBedCooldownRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.homes.bed.cooldown", {
			nextAvailableAt: Math.floor(packet.nextAvailableAt / 1000)
		});
	}

	@packetHandler(CommandReportGuildDomainPurchaseRes)
	async reportGuildDomainPurchaseRes(context: PacketContext, packet: CommandReportGuildDomainPurchaseRes): Promise<void> {
		await handleGuildDomainPurchase(packet, context);
	}

	@packetHandler(CommandReportGuildDomainRelocateRes)
	async reportGuildDomainRelocateRes(context: PacketContext, packet: CommandReportGuildDomainRelocateRes): Promise<void> {
		await handleGuildDomainRelocate(packet, context);
	}

	@packetHandler(CommandReportGuildDomainNotEnoughTreasuryRes)
	async reportGuildDomainNotEnoughTreasuryRes(context: PacketContext, packet: CommandReportGuildDomainNotEnoughTreasuryRes): Promise<void> {
		await handleGuildDomainNotEnoughTreasury(packet, context);
	}
}
