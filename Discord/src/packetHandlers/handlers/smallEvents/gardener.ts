import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventGardenerPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import {
	GARDENER_INTERACTIONS, PlantConstants, SEED_CONDITION_FAILURE
} from "../../../../../Lib/src/constants/PlantConstants";

export default class GardenerSmallEventHandler {
	@packetHandler(SmallEventGardenerPacket)
	async smallEventGardener(context: PacketContext, packet: SmallEventGardenerPacket): Promise<void> {
		const interaction = context.discord!.buttonInteraction ? DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!) : DiscordCache.getInteraction(context.discord!.interaction!);
		const lng = context.discord!.language;

		const isFromCollector = Boolean(context.discord!.buttonInteraction);
		const story = isFromCollector
			? ""
			: getRandomSmallEventIntro(lng) + StringUtils.getRandomTranslation("smallEvents:gardener.stories", lng);

		let rewardText: string;

		switch (packet.interactionName) {
			case GARDENER_INTERACTIONS.SEED:
				rewardText = StringUtils.getRandomTranslation(`smallEvents:gardener.rewards.seed.${packet.conditionKey}`, lng, {
					cost: packet.cost
				});
				break;
			case GARDENER_INTERACTIONS.ADVICE: {
				const adviceReplacements: Record<string, unknown> = {};
				if (packet.conditionKey === SEED_CONDITION_FAILURE.NEED_LEVEL && packet.plantId > 0) {
					adviceReplacements.level = PlantConstants.SEED_LEVEL_REQUIREMENTS[packet.plantId as keyof typeof PlantConstants.SEED_LEVEL_REQUIREMENTS];
				}
				if (packet.conditionKey === SEED_CONDITION_FAILURE.NEED_MONEY && packet.plantId > 0) {
					adviceReplacements.cost = PlantConstants.SEED_COSTS[packet.plantId as keyof typeof PlantConstants.SEED_COSTS];
				}
				rewardText = StringUtils.getRandomTranslation(`smallEvents:gardener.rewards.advice.${packet.conditionKey}`, lng, adviceReplacements);
				break;
			}
			case GARDENER_INTERACTIONS.PLANT:
				rewardText = StringUtils.getRandomTranslation("smallEvents:gardener.rewards.plant", lng, {
					plantId: packet.plantId
				});
				break;
			case GARDENER_INTERACTIONS.MATERIAL:
				rewardText = StringUtils.getRandomTranslation("smallEvents:gardener.rewards.material", lng, {
					materialId: packet.materialId
				});
				break;
			default:
				rewardText = "";
		}

		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"gardener",
					story + rewardText,
					interaction.user,
					lng
				)
			]
		});
	}
}
