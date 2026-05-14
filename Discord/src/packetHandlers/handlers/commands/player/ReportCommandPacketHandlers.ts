import { packetHandler } from "../../../PacketHandler";
import {
	CommandReportBigEventResultRes,
	CommandReportBlacksmithDisenchantRes,
	CommandReportBlacksmithMissingMaterialsRes,
	CommandReportBlacksmithNotEnoughMoneyRes,
	CommandReportBlacksmithUpgradeRes,
	CommandReportBuyHealAcceptPacketRes,
	CommandReportBuyHealCannotHealOccupiedPacketRes,
	CommandReportBuyHealNoAlterationPacketRes,
	CommandReportBuyHealRefusePacketRes,
	CommandReportBuyHomeRes,
	CommandReportChooseDestinationCityRes,
	CommandReportEatInnMealCooldownRes,
	CommandReportEatInnMealRes,
	CommandReportEnchantNotEnoughCurrenciesRes,
	CommandReportErrorNoMonsterRes,
	CommandReportHomeBedAlreadyFullRes,
	CommandReportHomeBedRes,
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
	CommandReportGuildDomainPurchaseRes,
	CommandReportGuildDomainRelocateRes,
	CommandReportGuildDomainNotEnoughTreasuryRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleChooseDestinationCity,
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
	handleBuyHome,
	handleHomeBed,
	handleMoveHome,
	handleUpgradeHome
} from "../../../../commands/player/report/home/HomeHandlers";
import {
	handleEatInnMeal,
	handleInnRoom
} from "../../../../commands/player/report/inn/InnHandlers";
import {
	displayMonsterReward,
	refusePveFight
} from "../../../../commands/player/report/pveFight/PveFightHandlers";
import { reportTravelSummary } from "../../../../commands/player/report/travel/TravelSummary";
import {
	handleUseTokensAccept,
	handleUseTokensRefuse
} from "../../../../commands/player/report/useTokens/UseTokensHandlers";
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

	@packetHandler(CommandReportChooseDestinationCityRes)
	async reportChooseDestinationCityRes(context: PacketContext, packet: CommandReportChooseDestinationCityRes): Promise<void> {
		await handleChooseDestinationCity(packet, context);
	}

	@packetHandler(CommandReportEatInnMealRes)
	async reportEatInnMealRes(context: PacketContext, packet: CommandReportEatInnMealRes): Promise<void> {
		await handleEatInnMeal(packet, context);
	}

	@packetHandler(CommandReportEatInnMealCooldownRes)
	async reportEatInnMealCooldownRes(context: PacketContext, _packet: CommandReportEatInnMealCooldownRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.inns.eatMealCooldown");
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
		await handleBuyHome(packet, context);
	}

	@packetHandler(CommandReportUpgradeHomeRes)
	async reportUpgradeHomeRes(context: PacketContext, packet: CommandReportUpgradeHomeRes): Promise<void> {
		await handleUpgradeHome(packet, context);
	}

	@packetHandler(CommandReportMoveHomeRes)
	async reportMoveHomeRes(context: PacketContext, packet: CommandReportMoveHomeRes): Promise<void> {
		await handleMoveHome(packet, context);
	}

	@packetHandler(CommandReportUseTokensAcceptPacketRes)
	async reportUseTokensAcceptRes(context: PacketContext, packet: CommandReportUseTokensAcceptPacketRes): Promise<void> {
		await handleUseTokensAccept(packet, context);
	}

	@packetHandler(CommandReportUseTokensRefusePacketRes)
	async reportUseTokensRefuseRes(context: PacketContext, _packet: CommandReportUseTokensRefusePacketRes): Promise<void> {
		await handleUseTokensRefuse(context);
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

	@packetHandler(CommandReportHomeBedRes)
	async reportHomeBedRes(context: PacketContext, packet: CommandReportHomeBedRes): Promise<void> {
		await handleHomeBed(packet, context);
	}

	@packetHandler(CommandReportHomeBedAlreadyFullRes)
	async reportHomeBedAlreadyFullRes(context: PacketContext, _packet: CommandReportHomeBedAlreadyFullRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.homes.bed.alreadyFull");
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
