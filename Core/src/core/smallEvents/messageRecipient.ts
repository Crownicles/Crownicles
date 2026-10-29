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

type RecipientChoice = {
	chosenEmoji: string | undefined;
	secretEmoji: string;
	destinationLocationId: number;
};

type RecipientOutcome = Pick<SmallEventMessageRecipientPacket, "outcome" | "moneyWon" | "xpWon" | "damage" | "timeLost">;

type RecipientOutcomeHandler = (player: Player, response: CrowniclesPacket[]) => Promise<RecipientOutcome>;

const OUTCOMES = SmallEventConstants.MESSAGE.OUTCOMES;

async function rewardRightEmoji(player: Player, response: CrowniclesPacket[]): Promise<RecipientOutcome> {
	const moneyWon = RandomUtils.randInt(SmallEventConstants.MESSAGE.REWARDS.MONEY.MIN, SmallEventConstants.MESSAGE.REWARDS.MONEY.MAX);
	const xpWon = RandomUtils.randInt(SmallEventConstants.MESSAGE.REWARDS.EXPERIENCE.MIN, SmallEventConstants.MESSAGE.REWARDS.EXPERIENCE.MAX);
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
	return {
		outcome: OUTCOMES.SUCCESS,
		moneyWon,
		xpWon
	};
}

async function explodeBomb(player: Player, response: CrowniclesPacket[]): Promise<RecipientOutcome> {
	const damage = RandomUtils.randInt(SmallEventConstants.MESSAGE.PENALTIES.BOMB_DAMAGE.MIN, SmallEventConstants.MESSAGE.PENALTIES.BOMB_DAMAGE.MAX);
	await player.addHealth({
		amount: -damage,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});
	return {
		outcome: OUTCOMES.WRONG_BOMB,
		damage
	};
}

async function loseTime(player: Player): Promise<RecipientOutcome> {
	const timeLost = RandomUtils.randInt(SmallEventConstants.MESSAGE.PENALTIES.TIME_LOST.MIN, SmallEventConstants.MESSAGE.PENALTIES.TIME_LOST.MAX);
	await TravelTime.applyEffect(player, Effect.OCCUPIED, timeLost, new Date(), NumberChangeReason.SMALL_EVENT);
	return {
		outcome: OUTCOMES.WRONG_TIME,
		timeLost
	};
}

const WRONG_EMOJI_HANDLERS: Record<string, RecipientOutcomeHandler> = {
	bomb: explodeBomb,
	clock: loseTime,
	poop: () => Promise.resolve({ outcome: OUTCOMES.WRONG_POO }),
	heart: () => Promise.resolve({ outcome: OUTCOMES.WRONG_LOVE })
};

function getOutcomeHandler(choice: RecipientChoice): RecipientOutcomeHandler {
	if (!choice.chosenEmoji) {
		return () => Promise.resolve({ outcome: OUTCOMES.TIMEOUT });
	}
	if (choice.chosenEmoji === choice.secretEmoji) {
		return rewardRightEmoji;
	}
	return WRONG_EMOJI_HANDLERS[choice.chosenEmoji] ?? ((): Promise<RecipientOutcome> => Promise.resolve({ outcome: OUTCOMES.WRONG_GENERIC }));
}

async function handleRecipientChoice(response: CrowniclesPacket[], player: Player, choice: RecipientChoice): Promise<void> {
	await PlayerMessageDeliveries.removeOfPlayer(player.id);

	const outcome = await getOutcomeHandler(choice)(player, response);
	response.push(makePacket(SmallEventMessageRecipientPacket, {
		...outcome,
		chosenEmoji: choice.chosenEmoji,
		correctEmoji: choice.secretEmoji,
		destinationLocationId: choice.destinationLocationId
	}));

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
				await handleRecipientChoice(collectorResponse, lockedPlayer, {
					chosenEmoji: firstReaction?.data.emojiId,
					secretEmoji,
					destinationLocationId: delivery.destinationLocationId
				});
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
