import { ReactionCollectorReactPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { packetHandler } from "../PacketHandler";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorController } from "../../utils/ReactionsCollector";
import { ChangeBlockingReasonPacket } from "../../../../../Lib/src/packets/utils/ChangeBlockingReasonPacket";
import { BlockingUtils } from "../../utils/BlockingUtils";
import {
	ReactionCollectorResetTimerPacketReq
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import {
	CommandReportHomeChestActionReq, CommandReportHomeChestActionRes,
	CommandReportGardenHarvestReq,
	CommandReportGardenPlantReq,
	CommandReportPlantTransferReq,
	CommandReportCookingIgniteReq,
	CommandReportCookingWoodConfirmRes,
	CommandReportCookingReviveReq,
	CommandReportCookingCraftReq,
	CommandReportCookingMenuReq,
	CommandReportCookingPinReq,
	CommandReportCookingUnpinReq,
	CommandReportGuildDomainDepositReq,
	CommandReportGuildDomainUpgradeReq,
	CommandReportFoodShopBuyReq
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	handleChestAction
} from "../../report/ReportCityService";
import {
	handleGardenHarvest, handleGardenPlant, handlePlantTransfer
} from "../../report/ReportGardenService";
import {
	handleCookingIgnite, handleCookingWoodConfirm, handleCookingRevive, handleCookingCraft,
	handleCookingMenu, handleCookingPin, handleCookingUnpin
} from "../../report/ReportCookingService";
import {
	handleGuildDomainDeposit, handleGuildDomainUpgrade
} from "../../report/ReportCityGuildDomainService";
import { handleFoodShopBuy } from "../../report/ReportCityFoodShopService";
import {
	CommandEquipActionReq, CommandEquipActionRes
} from "../../../../../Lib/src/packets/commands/CommandEquipPacket";
import { handleEquipAction } from "../../utils/EquipActionService";

export default class CoreHandlers {
	@packetHandler(ReactionCollectorReactPacket)
	async reactionCollector(response: CrowniclesPacket[], _context: PacketContext, packet: ReactionCollectorReactPacket): Promise<void> {
		await ReactionCollectorController.reactPacket(response, packet);
	}

	@packetHandler(ChangeBlockingReasonPacket)
	changeBlockingReason(_response: CrowniclesPacket[], context: PacketContext, packet: ChangeBlockingReasonPacket): void {
		BlockingUtils.changeBlockingReason(context.keycloakId!, packet);
	}

	@packetHandler(ReactionCollectorResetTimerPacketReq)
	reactionCollectorResetTimer(response: CrowniclesPacket[], _context: PacketContext, packet: ReactionCollectorResetTimerPacketReq): void {
		ReactionCollectorController.resetTimer(response, packet);
	}

	@packetHandler(CommandReportHomeChestActionReq)
	async homeChestAction(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportHomeChestActionReq): Promise<void> {
		const result = await handleChestAction(context.keycloakId!, packet);
		response.push(makePacket(CommandReportHomeChestActionRes, result));
	}

	@packetHandler(CommandEquipActionReq)
	async equipAction(response: CrowniclesPacket[], context: PacketContext, packet: CommandEquipActionReq): Promise<void> {
		const result = await handleEquipAction(context.keycloakId!, packet);
		response.push(makePacket(CommandEquipActionRes, result));
	}

	@packetHandler(CommandReportGardenHarvestReq)
	async gardenHarvest(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportGardenHarvestReq): Promise<void> {
		response.push(await handleGardenHarvest(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportGardenPlantReq)
	async gardenPlant(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportGardenPlantReq): Promise<void> {
		response.push(await handleGardenPlant(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportPlantTransferReq)
	async plantTransfer(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportPlantTransferReq): Promise<void> {
		response.push(await handlePlantTransfer(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportCookingIgniteReq)
	async cookingIgnite(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportCookingIgniteReq): Promise<void> {
		response.push(...await handleCookingIgnite(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportCookingWoodConfirmRes)
	async cookingWoodConfirm(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportCookingWoodConfirmRes): Promise<void> {
		response.push(...await handleCookingWoodConfirm(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportCookingReviveReq)
	async cookingRevive(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportCookingReviveReq): Promise<void> {
		response.push(...await handleCookingRevive(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportCookingCraftReq)
	async cookingCraft(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportCookingCraftReq): Promise<void> {
		response.push(...await handleCookingCraft(context.keycloakId!, packet, context));
	}

	@packetHandler(CommandReportCookingMenuReq)
	async cookingMenu(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportCookingMenuReq): Promise<void> {
		response.push(...await handleCookingMenu(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportCookingPinReq)
	async cookingPin(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportCookingPinReq): Promise<void> {
		response.push(...await handleCookingPin(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportCookingUnpinReq)
	async cookingUnpin(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportCookingUnpinReq): Promise<void> {
		response.push(...await handleCookingUnpin(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportGuildDomainDepositReq)
	async guildDomainDeposit(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportGuildDomainDepositReq): Promise<void> {
		response.push(await handleGuildDomainDeposit(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportGuildDomainUpgradeReq)
	async guildDomainUpgrade(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportGuildDomainUpgradeReq): Promise<void> {
		response.push(await handleGuildDomainUpgrade(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportFoodShopBuyReq)
	async foodShopBuy(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportFoodShopBuyReq): Promise<void> {
		response.push(await handleFoodShopBuy(context.keycloakId!, packet));
	}
}
