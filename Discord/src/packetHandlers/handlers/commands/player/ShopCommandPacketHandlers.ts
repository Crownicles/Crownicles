import { packetHandler } from "../../../PacketHandler";
import {
	CommandShopAlreadyHaveBadge,
	CommandShopBadgeBought,
	CommandShopBoughtTooMuchDailyPotions,
	CommandShopClosed,
	CommandShopFullRegen,
	CommandShopHealAlterationDone,
	CommandShopNoAlterationToHeal,
	CommandShopNotEnoughCurrency
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandShopAlreadyHaveBadge,
	handleCommandShopBadgeBought,
	handleCommandShopBoughtTooMuchDailyPotions,
	handleCommandShopClosed,
	handleCommandShopFullRegen,
	handleCommandShopHealAlterationDone,
	handleCommandShopNoAlterationToHeal,
	handleCommandShopNotEnoughMoney,
	handleReactionCollectorBuyCategorySlotBuySuccess
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

	@packetHandler(CommandShopHealAlterationDone)
	async shopHealAlterationDone(context: PacketContext, _packet: CommandShopHealAlterationDone): Promise<void> {
		await handleCommandShopHealAlterationDone(context);
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

	@packetHandler(CommandShopNotEnoughCurrency)
	async shopNotEnoughMoney(context: PacketContext, packet: CommandShopNotEnoughCurrency): Promise<void> {
		await handleCommandShopNotEnoughMoney(packet, context);
	}

	@packetHandler(ReactionCollectorBuyCategorySlotBuySuccess)
	async buyCategorySlotBuySuccess(context: PacketContext, _packet: ReactionCollectorBuyCategorySlotBuySuccess): Promise<void> {
		await handleReactionCollectorBuyCategorySlotBuySuccess(context);
	}
}
