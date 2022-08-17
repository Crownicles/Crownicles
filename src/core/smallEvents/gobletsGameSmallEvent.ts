import {CommandInteraction, MessageEmbed} from "discord.js";
import {Translations} from "../Translations";
import {Data} from "../Data";
import {Constants} from "../Constants";
import {SmallEvent} from "./SmallEvent";
import {DraftBotReactionMessageBuilder} from "../messages/DraftBotReactionMessage";
import {DraftBotReaction} from "../messages/DraftBotReaction";
import {RandomUtils} from "../utils/RandomUtils";
import {Maps} from "../Maps";
import {format} from "../utils/StringFormatter";
import {minutesDisplay} from "../utils/TimeUtils";
import {BlockingUtils} from "../utils/BlockingUtils";
import {BlockingConstants} from "../constants/BlockingConstants";
import {NumberChangeReason} from "../database/logs/LogsDatabase";

export const smallEvent: SmallEvent = {
	canBeExecuted(): Promise<boolean> {
		return Promise.resolve(true);
	},

	async executeSmallEvent(interaction: CommandInteraction, language: string, entity: any, seEmbed: MessageEmbed) {
		function generateMalus(malus = data.getRandomStringFromArray("malusTypes")): any {
			switch (malus) {
			case "life":
				return {
					type: malus,
					option: Math.round(entity.Player.level / 6) + Constants.SMALL_EVENT.BASE_HEALTH_LOST_GOBLETS_GAME + RandomUtils.draftbotRandom.integer(-3, 3)
				};
			case "time":
				return {
					type: malus,
					option: Math.round(entity.Player.level / 3 * 1.25) + Constants.SMALL_EVENT.BASE_TIME_LOST_GOBLETS_GAME + RandomUtils.draftbotRandom.integer(0, 10)
				};
			case "nothing":
				return {
					type: malus
				};
			case "end":
				return {
					type: malus,
					option: Math.round(entity.Player.level / 8) + Constants.SMALL_EVENT.BASE_HEALTH_LOST_GOBLETS_GAME + RandomUtils.draftbotRandom.integer(-3, 3)
				};
			default:
			}
		}

		async function applyMalus(malus: any): Promise<void> {
			switch (malus.type) {
			case "life":
				await entity.addHealth(-malus.option, interaction.channel, language, NumberChangeReason.SMALL_EVENT);
				break;
			case "time":
				await Maps.applyEffect(entity.Player, Constants.EFFECT.OCCUPIED, malus.option, NumberChangeReason.SMALL_EVENT);
				malus.option = minutesDisplay(malus.option);
				break;
			case "nothing":
				break;
			case "end":
				await entity.addHealth(-malus.option, interaction.channel, language, NumberChangeReason.SMALL_EVENT);
				break;
			default:
				throw new Error("reward type not found");
			}
			await entity.Player.killIfNeeded(entity, interaction.channel, language, NumberChangeReason.SMALL_EVENT);
			await entity.save();
			await entity.save();
		}

		function generateEndMessage(malus: any, goblet: string) {
			seEmbed.setDescription(format(tr.getRandom("results." + malus.type), {
				amount: malus.option,
				goblet: goblet
			}));
			return seEmbed;
		}

		const tr = Translations.getModule("smallEvents.gobletsGame", language);
		const data = Data.getModule("smallEvents.gobletsGame");

		const embed = new DraftBotReactionMessageBuilder()
			.allowUser(interaction.user)
			.endCallback(async (chooseGobletMessage) => {
				const reaction = chooseGobletMessage.getFirstReaction();
				const reactionEmoji = !reaction ? "🔚" : reaction.emoji.name;
				let malus = generateMalus();
				if (!reaction) {
					malus = generateMalus("end");
				}
				let currentGoblet: any;
				for (let i = 0; i < tr.getObjectSize("intro.goblets"); i++) {
					currentGoblet = tr.getObject("intro.goblets")[i];
					if (reactionEmoji === "🔚" || reactionEmoji === tr.getObject("intro.goblets")[i].emoji) {
						BlockingUtils.unblockPlayer(entity.discordUserId, BlockingConstants.REASONS.GOBLET_CHOOSE);
						await applyMalus(malus);
						await chooseGobletMessage.sentMessage.channel.send({embeds: [generateEndMessage(malus, currentGoblet.name)]});
						break;
					}
				}
			});

		const intro = Translations.getModule("smallEventsIntros", language).getRandom("intro");
		let goblets = "", gobletEmoji = "", currentGoblet: any;
		for (let i = 0; i < tr.getObjectSize("intro.goblets"); i++) {
			currentGoblet = tr.getObject("intro.goblets")[i];
			gobletEmoji = currentGoblet.emoji;
			goblets += gobletEmoji + " " + currentGoblet.desc;
			embed.addReaction(new DraftBotReaction(gobletEmoji));
		}
		const builtEmbed = embed.build();
		builtEmbed.formatAuthor(Translations.getModule("commands.report", language).get("journal"), interaction.user);
		builtEmbed.setDescription(
			seEmbed.description
			+ intro
			+ tr.getRandom("intro.intrigue")
			+ goblets
		);
		await builtEmbed.reply(interaction, (collector) => BlockingUtils.blockPlayerWithCollector(entity.discordUserId, BlockingConstants.REASONS.GOBLET_CHOOSE, collector));
	}
};