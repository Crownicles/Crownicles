import { packetHandler } from "../../../PacketHandler";
import {
	CommandShopAlreadyHaveBadge,
	CommandShopBadgeBought,
	CommandShopBoughtTooMuchDailyPotions,
	CommandShopBoughtTooMuchTokens,
	CommandShopCannotHealOccupied,
	CommandShopClosed,
	CommandShopEnergyHeal,
	CommandShopFullRegen,
	CommandShopHealAlterationDone,
	CommandShopNoAlterationToHeal,
	CommandShopNoEnergyToHeal,
	CommandShopNotEnoughCurrency,
	CommandShopTokensBought,
	CommandShopTokensFull,
	CommandShopTooManyEnergyBought
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandShopAlreadyHaveBadge,
	handleCommandShopBadgeBought,
	handleCommandShopBoughtTooMuchDailyPotions,
	handleCommandShopBoughtTooMuchTokens,
	handleCommandShopCannotHealOccupied,
	handleCommandShopClosed,
	handleCommandShopEnergyHeal,
	handleCommandShopFullRegen,
	handleCommandShopHealAlterationDone,
	handleCommandShopNoAlterationToHeal,
	handleCommandShopNoEnergyToHeal,
	handleCommandShopNotEnoughMoney,
	handleCommandShopTokensBought,
	handleCommandShopTokensFull,
	handleCommandShopTooManyEnergyBought, handleReactionCollectorBuyCategorySlotBuySuccess
} from "../../../../commands/player/ShopCommand";
import { ReactionCollectorBuyCategorySlotBuySuccess } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";

export default class ShopCommandPacketHandlers {
	@packetHandler(CommandShopClosed)
	async shopClosed(context: PacketContext, _packet: CommandShopClosed): Promise<void> {
		await handleCommandShopClosed(context);
	}

	@packetHandler(CommandShopNoAlterationToHeal)
	async shopNoAlterationToHeal(context: PacketContext, _packet: CommandShopNoAlterationToHeal): Promise<void> {
		await handleCommandShopNoAlterationToHeal(context);
	}

	@packetHandler(CommandShopCannotHealOccupied)
	async shopCannotHealOccupied(context: PacketContext, _packet: CommandShopCannotHealOccupied): Promise<void> {
		await handleCommandShopCannotHealOccupied(context);
	}

	@packetHandler(CommandShopHealAlterationDone)
	async shopHealAlterationDone(context: PacketContext, _packet: CommandShopHealAlterationDone): Promise<void> {
		await handleCommandShopHealAlterationDone(context);
	}

	@packetHandler(CommandShopTooManyEnergyBought)
	async shopTooManyEnergyBought(context: PacketContext, _packet: CommandShopTooManyEnergyBought): Promise<void> {
		await handleCommandShopTooManyEnergyBought(context);
	}

	@packetHandler(CommandShopNoEnergyToHeal)
	async shopNoEnergyToHeal(context: PacketContext, _packet: CommandShopNoEnergyToHeal): Promise<void> {
		await handleCommandShopNoEnergyToHeal(context);
	}

	@packetHandler(CommandShopFullRegen)
	async shopFullRegen(context: PacketContext, _packet: CommandShopFullRegen): Promise<void> {
		await handleCommandShopFullRegen(context);
	}

	@packetHandler(CommandShopAlreadyHaveBadge)
	async shopAlreadyHaveBadge(context: PacketContext, _packet: CommandShopAlreadyHaveBadge): Promise<void> {
		await handleCommandShopAlreadyHaveBadge(context);
	}

	@packetHandler(CommandShopBadgeBought)
	async shopBadgeBought(context: PacketContext, _packet: CommandShopBadgeBought): Promise<void> {
		await handleCommandShopBadgeBought(context);
	}

	@packetHandler(CommandShopBoughtTooMuchDailyPotions)
	async shopBoughtTooMuchDailyPotions(context: PacketContext, _packet: CommandShopBoughtTooMuchDailyPotions): Promise<void> {
		await handleCommandShopBoughtTooMuchDailyPotions(context);
	}

	@packetHandler(CommandShopBoughtTooMuchTokens)
	async shopBoughtTooMuchTokens(context: PacketContext, _packet: CommandShopBoughtTooMuchTokens): Promise<void> {
		await handleCommandShopBoughtTooMuchTokens(context);
	}

	@packetHandler(CommandShopTokensBought)
	async shopTokensBought(context: PacketContext, packet: CommandShopTokensBought): Promise<void> {
		await handleCommandShopTokensBought(context, packet.amount);
	}

	@packetHandler(CommandShopTokensFull)
	async shopTokensFull(context: PacketContext, _packet: CommandShopTokensFull): Promise<void> {
		await handleCommandShopTokensFull(context);
	}

	@packetHandler(CommandShopNotEnoughCurrency)
	async shopNotEnoughMoney(context: PacketContext, packet: CommandShopNotEnoughCurrency): Promise<void> {
		await handleCommandShopNotEnoughMoney(packet, context);
	}

	@packetHandler(ReactionCollectorBuyCategorySlotBuySuccess)
	async buyCategorySlotBuySuccess(context: PacketContext, _packet: ReactionCollectorBuyCategorySlotBuySuccess): Promise<void> {
		await handleReactionCollectorBuyCategorySlotBuySuccess(context);
	}

	@packetHandler(CommandShopEnergyHeal)
	async shopEnergyHeal(context: PacketContext, _packet: CommandShopEnergyHeal): Promise<void> {
		await handleCommandShopEnergyHeal(context);
	}
}
