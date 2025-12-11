import {
	AcceptRefusePacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { SmallEventCartPacket } from "../../../Lib/src/packets/smallEvents/SmallEventCartPacket";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import i18n from "../translations/i18n";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import { ReactionCollectorCartData } from "../../../Lib/src/packets/interaction/ReactionCollectorCart";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";

export async function cartCollector(context: PacketContext, packet: AcceptRefusePacket<ReactionCollectorCartData>): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data;
	const story = data.displayedDestination.isDisplayed ? "knownDestination" : "unknownDestination";
	const lng = interaction!.userLanguage;

	const embed = new CrowniclesSmallEventEmbed(
		"cart",
		getRandomSmallEventIntro(lng)
		+ StringUtils.getRandomTranslation(`smallEvents:cart.${story}`, lng, {
			price: data.price,
			moneyEmote: CrowniclesIcons.unitValues.money,
			destination:
				`${CrowniclesIcons.mapTypes[data.displayedDestination.type!]} ${
					i18n.t(`models:map_locations.${data.displayedDestination.id}.name`, { lng })
				}`
		})
		+ StringUtils.getRandomTranslation("smallEvents:cart.menu", lng),
		interaction.user,
		lng
	);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context, {
		emojis: {
			accept: CrowniclesIcons.cartSmallEvent.accept,
			refuse: CrowniclesIcons.cartSmallEvent.refuse
		}
	});
}

export async function cartResult(packet: SmallEventCartPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;
	let story;
	if (!packet.travelDone.hasEnoughMoney && packet.travelDone.isAccepted) {
		story = "notEnoughMoney";
	}

	else if (!packet.travelDone.isAccepted) {
		story = "travelRefused";
	}

	else {
		story = packet.isScam ? "scamTravelDone" : packet.isDisplayed ? "normalTravelDone" : "unknownDestinationTravelDone";
	}

	await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"cart",
				StringUtils.getRandomTranslation(`smallEvents:cart.${story}`, lng),
				interaction.user,
				lng
			)
		]
	});
}
