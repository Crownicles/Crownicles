import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import i18n from "../../../translations/i18n";
import {
	SmallEventSpaceInitialPacket, SmallEventSpaceResultPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventSpacePacket";

export default class SpaceSmallEventHandler {
	@packetHandler(SmallEventSpaceInitialPacket)
	async smallEventSpaceInitial(context: PacketContext, _packet: SmallEventSpaceInitialPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"space",
					i18n.t("smallEvents:space.before_search_format", {
						lng,
						seIntro: getRandomSmallEventIntro(lng),
						intro: StringUtils.getRandomTranslation("smallEvents:space.intro", lng, {
							name: StringUtils.getRandomTranslation("smallEvents:space.names", lng)
						}),
						searchAction: StringUtils.getRandomTranslation("smallEvents:space.searchAction", lng),
						search: StringUtils.getRandomTranslation("smallEvents:space.search", lng)
					}),
					interaction.user,
					lng
				)
			]
		});
	}


	@packetHandler(SmallEventSpaceResultPacket)
	async smallEventSpaceResult(context: PacketContext, packet: SmallEventSpaceResultPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const oldMessage = (await interaction.fetchReply()).embeds[0]?.data.description;
		if (!oldMessage) {
			return;
		}
		const lng = interaction.userLanguage;
		const oneOrMoreDays = packet.values.mainValue > 1
			? i18n.t("smallEvents:space.days_other", { lng })
			: i18n.t("smallEvents:space.days_one", { lng });

		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"space",
					i18n.t("smallEvents:space.after_search_format", {
						lng,
						oldMessage: oldMessage.split(" ")
							.slice(1)
							.join(" "),
						actionIntro: StringUtils.getRandomTranslation("smallEvents:space.actionIntro", lng),
						action: StringUtils.getRandomTranslation("smallEvents:space.action", lng),
						specific: StringUtils.getRandomTranslation(`smallEvents:space.specific.${packet.chosenEvent}`, lng, {
							mainValue: packet.chosenEvent === "moonPhase"
								? i18n.tArray("smallEvents:space.moonPhases", {
									lng
								})[packet.values.mainValue]
								: packet.values.mainValue,
							objectWhichWillCrossTheSky: i18n.t("smallEvents:space.nObjectsCrossTheSky", {
								lng,
								count: packet.values.mainValue
							}),
							days: oneOrMoreDays,
							randomObjectName: packet.values.randomObjectName,
							randomObjectDistance: packet.values.randomObjectDistance,
							randomObjectDiameter: packet.values.randomObjectDiameter
						}),
						outro: StringUtils.getRandomTranslation("smallEvents:space.outro", lng)
					}),
					interaction.user,
					lng
				)
			]
		});
	}
}
