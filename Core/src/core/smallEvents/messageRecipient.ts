/* @lockInherited — body runs under loadAndExecuteSmallEvents withLockedPlayerAndMissions callback. */
import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { PlayerMessageDeliveries } from "../database/game/models/PlayerMessageDelivery";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventMessageRecipientPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventMessageRecipientPacket";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	ReactionCollectorMessageReaction,
	ReactionCollectorMessageRecipient
} from "../../../../Lib/src/packets/interaction/ReactionCollectorMessageRecipient";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import { withLockedPlayerAndMissionsSafe } from "../utils/withLockedPlayerAndMissionsSafe";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import Player from "../database/game/models/Player";

function generateEmojiChoices(secretEmoji: string): ReactionCollectorMessageReaction[] {
	const otherSecretEmojis = (SmallEventConstants.MESSAGE.SECRET_EMOJIS as unknown as string[])
		.filter(e => e !== secretEmoji);
	const distractorPool = RandomUtils.crowniclesRandom.shuffle([...otherSecretEmojis]);
	const distractors = distractorPool.slice(0, 2);

	const wrongPool = RandomUtils.crowniclesRandom.shuffle([...(SmallEventConstants.MESSAGE.SPECIAL_WRONG_EMOJIS as unknown as string[])]);
	const specialWrongs = wrongPool.slice(0, 2);

	const allEmojis = RandomUtils.crowniclesRandom.shuffle([
		secretEmoji,
		...distractors,
		...specialWrongs
	]);

	return allEmojis.map(emojiId => ({ emojiId }));
}

async function handleRecipientChoice(
	response: CrowniclesPacket[],
	player: Player,
	chosenEmoji: string | undefined,
	destinationLocationId: number,
	secretEmoji: string
): Promise<void> {
	await PlayerMessageDeliveries.removeOfPlayer(player.id);

	if (!chosenEmoji) {
		response.push(makePacket(SmallEventMessageRecipientPacket, {
			outcome: SmallEventConstants.MESSAGE.OUTCOMES.TIMEOUT,
			correctEmoji: secretEmoji,
			destinationLocationId
		}));
		await player.save();
		return;
	}

	if (chosenEmoji === secretEmoji) {
		const moneyWon = RandomUtils.randInt(
			SmallEventConstants.MESSAGE.REWARDS.MONEY.MIN,
			SmallEventConstants.MESSAGE.REWARDS.MONEY.MAX
		);
		const xpWon = RandomUtils.randInt(
			SmallEventConstants.MESSAGE.REWARDS.EXPERIENCE.MIN,
			SmallEventConstants.MESSAGE.REWARDS.EXPERIENCE.MAX
		);

		await player.addMoney({
			amount: moneyWon,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await player.addExperience({
			amount: xpWon,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});

		response.push(makePacket(SmallEventMessageRecipientPacket, {
			outcome: SmallEventConstants.MESSAGE.OUTCOMES.SUCCESS,
			chosenEmoji,
			correctEmoji: secretEmoji,
			destinationLocationId,
			moneyWon,
			xpWon
		}));
	}
	else {
		switch (chosenEmoji) {
			case "bomb": {
				const damage = RandomUtils.randInt(
					SmallEventConstants.MESSAGE.PENALTIES.BOMB_DAMAGE.MIN,
					SmallEventConstants.MESSAGE.PENALTIES.BOMB_DAMAGE.MAX
				);
				await player.addHealth({
					amount: -damage,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});
				response.push(makePacket(SmallEventMessageRecipientPacket, {
					outcome: SmallEventConstants.MESSAGE.OUTCOMES.WRONG_BOMB,
					chosenEmoji,
					correctEmoji: secretEmoji,
					destinationLocationId,
					damage
				}));
				break;
			}
			case "clock": {
				const timeLost = RandomUtils.randInt(
					SmallEventConstants.MESSAGE.PENALTIES.TIME_LOST.MIN,
					SmallEventConstants.MESSAGE.PENALTIES.TIME_LOST.MAX
				);
				await TravelTime.applyEffect(
					player,
					Effect.OCCUPIED,
					timeLost,
					new Date(),
					NumberChangeReason.SMALL_EVENT
				);
				response.push(makePacket(SmallEventMessageRecipientPacket, {
					outcome: SmallEventConstants.MESSAGE.OUTCOMES.WRONG_TIME,
					chosenEmoji,
					correctEmoji: secretEmoji,
					destinationLocationId,
					timeLost
				}));
				break;
			}
			case "poop": {
				response.push(makePacket(SmallEventMessageRecipientPacket, {
					outcome: SmallEventConstants.MESSAGE.OUTCOMES.WRONG_POO,
					chosenEmoji,
					correctEmoji: secretEmoji,
					destinationLocationId
				}));
				break;
			}
			case "heart": {
				response.push(makePacket(SmallEventMessageRecipientPacket, {
					outcome: SmallEventConstants.MESSAGE.OUTCOMES.WRONG_LOVE,
					chosenEmoji,
					correctEmoji: secretEmoji,
					destinationLocationId
				}));
				break;
			}
			default: {
				response.push(makePacket(SmallEventMessageRecipientPacket, {
					outcome: SmallEventConstants.MESSAGE.OUTCOMES.WRONG_GENERIC,
					chosenEmoji,
					correctEmoji: secretEmoji,
					destinationLocationId
				}));
				break;
			}
		}
	}

	await player.save();
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async player => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}

		const delivery = await PlayerMessageDeliveries.getOfPlayer(player.id);
		if (!delivery) {
			return false;
		}

		const destinationId = player.getDestinationId();
		const previousMapId = player.getPreviousMapId();
		return destinationId === delivery.destinationLocationId || previousMapId === delivery.destinationLocationId;
	},

	executeSmallEvent: async (response, player, context: PacketContext): Promise<void> => {
		const delivery = await PlayerMessageDeliveries.getOfPlayer(player.id);
		if (!delivery) {
			return;
		}

		const reactions = generateEmojiChoices(delivery.secretEmoji);
		const collector = new ReactionCollectorMessageRecipient(delivery.destinationLocationId, reactions);

		const endCallback: EndCallback = async (reactionCollector, collectorResponse) => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.MESSAGE_RECIPIENT_CHOOSE);
			await withLockedPlayerAndMissionsSafe(player, "messageRecipient endCallback", async lockedPlayer => {
				const currentDelivery = await PlayerMessageDeliveries.getOfPlayer(lockedPlayer.id);
				const secretEmoji = currentDelivery ? currentDelivery.secretEmoji : delivery.secretEmoji;
				const firstReaction = reactionCollector.getFirstReaction()?.reaction as {
					data: ReactionCollectorMessageReaction;
				} | undefined;
				await handleRecipientChoice(
					collectorResponse,
					lockedPlayer,
					firstReaction?.data.emojiId,
					delivery.destinationLocationId,
					secretEmoji
				);
			});
		};

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.MESSAGE_RECIPIENT_CHOOSE)
			.build();

		response.push(packet);
	}
};
