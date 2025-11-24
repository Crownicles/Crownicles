import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	ReactionCollectorBadPetFleeReaction,
	ReactionCollectorBadPetGiveMeatReaction,
	ReactionCollectorBadPetGiveVegReaction,
	ReactionCollectorBadPetHideReaction,
	ReactionCollectorBadPetIntimidateReaction,
	ReactionCollectorBadPetPleadReaction,
	ReactionCollectorBadPetSmallEvent,
	ReactionCollectorBadPetWaitReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { SmallEventBadPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBadPetPacket";
import {
	makePacket, CrowniclesPacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetEntity } from "../database/game/models/PetEntity";
import {
	Pet, PetDataController
} from "../../data/Pet";
import Player from "../database/game/models/Player";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { ReactionCollectorReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { Maps } from "../maps/Maps";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";

type BadPetActionHandler = (petEntity: PetEntity, petModel: Pet) => {
	loveLost: number;
	interactionType: string;
};

interface BadPetAction {
	reactionClass: new () => ReactionCollectorReaction;
	handler: BadPetActionHandler;
}

const BAD_PET_ACTIONS: BadPetAction[] = [
	{
		reactionClass: ReactionCollectorBadPetIntimidateReaction,
		handler: (_petEntity, petModel): {
			loveLost: number;
			interactionType: string;
		} => {
			const isStrong = petModel.force >= 50;
			const loveLost = isStrong ? RandomUtils.randInt(1, 4) : RandomUtils.randInt(5, 9);
			return {
				loveLost,
				interactionType: "intimidate"
			};
		}
	},
	{
		reactionClass: ReactionCollectorBadPetPleadReaction,
		handler: (_petEntity, petModel): {
			loveLost: number;
			interactionType: string;
		} => {
			const isWeak = petModel.force < 50;
			const loveLost = isWeak ? RandomUtils.randInt(1, 4) : RandomUtils.randInt(5, 9);
			return {
				loveLost,
				interactionType: "plead"
			};
		}
	},
	{
		reactionClass: ReactionCollectorBadPetGiveMeatReaction,
		handler: (_petEntity, petModel): {
			loveLost: number;
			interactionType: string;
		} => {
			const isCarnivore = petModel.canEatMeat();
			const loveLost = isCarnivore ? 2 : 5;
			return {
				loveLost,
				interactionType: "giveMeat"
			};
		}
	},
	{
		reactionClass: ReactionCollectorBadPetGiveVegReaction,
		handler: (_petEntity, petModel): {
			loveLost: number;
			interactionType: string;
		} => {
			const isHerbivore = petModel.canEatVegetables();
			const loveLost = isHerbivore ? 2 : 5;
			return {
				loveLost,
				interactionType: "giveVeg"
			};
		}
	},
	{
		reactionClass: ReactionCollectorBadPetFleeReaction,
		handler: (_petEntity, _petModel): {
			loveLost: number;
			interactionType: string;
		} => {
			const success = RandomUtils.crowniclesRandom.bool(0.2);
			const loveLost = success ? 0 : 10;
			return {
				loveLost,
				interactionType: "flee"
			};
		}
	},
	{
		reactionClass: ReactionCollectorBadPetHideReaction,
		handler: (_petEntity, _petModel): {
			loveLost: number;
			interactionType: string;
		} => {
			const loveLost = RandomUtils.randInt(4, 7);
			return {
				loveLost,
				interactionType: "hide"
			};
		}
	},
	{
		reactionClass: ReactionCollectorBadPetWaitReaction,
		handler: (_petEntity, _petModel): {
			loveLost: number;
			interactionType: string;
		} => {
			const loveLost = 5;
			return {
				loveLost,
				interactionType: "wait"
			};
		}
	}
];

const REACTION_HANDLERS: Record<string, BadPetActionHandler> = {};
for (const action of BAD_PET_ACTIONS) {
	REACTION_HANDLERS[action.reactionClass.name] = action.handler;
}

function pickRandom<T>(array: T[], count: number): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = RandomUtils.randInt(0, i + 1);
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled.slice(0, count);
}

function getEndCallback(player: Player): EndCallback {
	return async (collector, response): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.BAD_PET_SMALL_EVENT);

		const reaction = collector.getFirstReaction();
		let result = {
			loveLost: 5,
			interactionType: "wait"
		}; // Default

		if (reaction) {
			const handler = REACTION_HANDLERS[reaction.reaction.type];
			if (handler) {
				const petEntity = await PetEntity.findOne({ where: { id: player.petId } });
				if (petEntity) {
					const petModel = PetDataController.instance.getById(petEntity.typeId);
					if (petModel) {
						result = handler(petEntity, petModel);
					}
				}
			}
		}

		if (result.loveLost > 0) {
			const petEntity = await PetEntity.findOne({ where: { id: player.petId } });
			if (petEntity) {
				petEntity.lovePoints -= result.loveLost;
				if (petEntity.lovePoints < 0) {
					petEntity.lovePoints = 0;
				}
				await petEntity.save();
			}
		}

		response.push(makePacket(SmallEventBadPetPacket, {
			loveLost: result.loveLost,
			interactionType: result.interactionType
		}));
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async (player: Player): Promise<boolean> => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		if (!player.petId) {
			return false;
		}
		const petEntity = await PetEntity.findByPk(player.petId);
		if (!petEntity) {
			return false;
		}
		return petEntity.lovePoints > 0;
	},

	executeSmallEvent: (response: CrowniclesPacket[], player: Player, context): Promise<void> => {
		const selectedActions = pickRandom(BAD_PET_ACTIONS, 3);
		const reactions = selectedActions.map(a => {
			const ReactionClass = a.reactionClass;
			return new ReactionClass();
		});

		const collector = new ReactionCollectorBadPetSmallEvent(reactions);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				time: Constants.MESSAGES.COLLECTOR_TIME
			},
			getEndCallback(player)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.BAD_PET_SMALL_EVENT)
			.build();

		response.push(packet);
		return Promise.resolve();
	}
};


