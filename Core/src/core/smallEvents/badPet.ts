import { SmallEventFuncs } from "../../data/SmallEvent";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { BlockingUtils } from "../utils/BlockingUtils";
import { StringConstants } from "../../../../Lib/src/constants/StringConstants";
import {
	ReactionCollectorBadPetFleeReaction,
	ReactionCollectorBadPetGiveMeatReaction,
	ReactionCollectorBadPetGiveVegReaction,
	ReactionCollectorBadPetHideReaction,
	ReactionCollectorBadPetIntimidateReaction,
	ReactionCollectorBadPetPleadReaction,
	ReactionCollectorBadPetSmallEvent,
	ReactionCollectorBadPetWaitReaction,
	ReactionCollectorBadPetProtectReaction,
	ReactionCollectorBadPetDistractReaction,
	ReactionCollectorBadPetCalmReaction,
	ReactionCollectorBadPetImposerReaction,
	ReactionCollectorBadPetEnergizeReaction
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
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { PetUtils } from "../utils/PetUtils";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { Guilds } from "../database/game/models/Guild";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";

type BadPetActionHandler = (petEntity: PetEntity, petModel: Pet, player: Player) => Promise<{
	loveLost: number;
	interactionType: string;
}>;

interface BadPetAction {
	id: string;
	reactionClass: new () => ReactionCollectorReaction;
	handler: BadPetActionHandler;
}

const BAD_PET_ACTIONS: BadPetAction[] = [
	{
		id: "intimidate",
		reactionClass: ReactionCollectorBadPetIntimidateReaction,
		handler: (_petEntity, petModel): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			const isStrong = petModel.force >= SmallEventConstants.BAD_PET.THRESHOLDS.PET_FORCE_STRONG;
			const loveLost = isStrong
				? RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.INTIMIDATE.STRONG_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.INTIMIDATE.STRONG_MAX)
				: RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.INTIMIDATE.WEAK_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.INTIMIDATE.WEAK_MAX);
			return Promise.resolve({
				loveLost,
				interactionType: "intimidate"
			});
		}
	},
	{
		id: "plead",
		reactionClass: ReactionCollectorBadPetPleadReaction,
		handler: (_petEntity, petModel): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			const isWeak = petModel.force < SmallEventConstants.BAD_PET.THRESHOLDS.PET_FORCE_STRONG;
			const loveLost = isWeak
				? RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.PLEAD.WEAK_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.PLEAD.WEAK_MAX)
				: RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.PLEAD.STRONG_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.PLEAD.STRONG_MAX);
			return Promise.resolve({
				loveLost,
				interactionType: "plead"
			});
		}
	},
	{
		id: "giveMeat",
		reactionClass: ReactionCollectorBadPetGiveMeatReaction,
		handler: async (_petEntity, petModel, player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			const canEatMeat = petModel.canEatMeat();

			// Check if player's guild has meat food
			let hasMeat = false;
			if (player.guildId) {
				const guild = await Guilds.getById(player.guildId);
				if (guild && guild.carnivorousFood > 0) {
					hasMeat = true;
				}
			}

			let loveLost: number;
			if (!hasMeat) {
				// No meat in guild inventory = always lose love
				loveLost = SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.NO_FOOD;
			}
			else if (canEatMeat) {
				// Pet is jealous because it likes the food = lose random
				loveLost = RandomUtils.randInt(
					SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.JEALOUS_MIN,
					SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.JEALOUS_MAX
				);
			}
			else {
				// Pet doesn't like meat = 20% chance to lose 1, otherwise 0
				loveLost = RandomUtils.crowniclesRandom.bool(SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.DISLIKES_CHANCE)
					? SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.DISLIKES_AMOUNT
					: 0;
			}

			return {
				loveLost,
				interactionType: "giveMeat"
			};
		}
	},
	{
		id: "giveVeg",
		reactionClass: ReactionCollectorBadPetGiveVegReaction,
		handler: async (_petEntity, petModel, player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			const canEatVegetables = petModel.canEatVegetables();

			// Check if player's guild has vegetable food
			let hasVegetables = false;
			if (player.guildId) {
				const guild = await Guilds.getById(player.guildId);
				if (guild && guild.herbivorousFood > 0) {
					hasVegetables = true;
				}
			}

			let loveLost: number;
			if (!hasVegetables) {
				// No vegetables in guild inventory = always lose 5
				loveLost = SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.NO_FOOD;
			}
			else if (canEatVegetables) {
				// Pet is jealous because it likes the food = lose 1-5 random
				loveLost = RandomUtils.randInt(
					SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.JEALOUS_MIN,
					SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.JEALOUS_MAX
				);
			}
			else {
				// Pet doesn't like vegetables = 20% chance to lose 1, otherwise 0
				loveLost = RandomUtils.crowniclesRandom.bool(SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.DISLIKES_CHANCE)
					? SmallEventConstants.BAD_PET.LOVE_LOST.GIVE_FOOD.DISLIKES_AMOUNT
					: 0;
			}

			return {
				loveLost,
				interactionType: "giveVeg"
			};
		}
	},
	{
		id: "flee",
		reactionClass: ReactionCollectorBadPetFleeReaction,
		handler: async (_petEntity, _petModel, player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
			const playerSpeed = player.getCumulativeSpeed(playerActiveObjects);

			let loveLost: number;
			if (playerSpeed > SmallEventConstants.BAD_PET.THRESHOLDS.PLAYER_SPEED_FAST) {
				// Fast player: 70% chance to escape without loss
				const success = RandomUtils.crowniclesRandom.bool(SmallEventConstants.BAD_PET.THRESHOLDS.FLEE_SUCCESS_CHANCE_FAST);
				loveLost = success ? 0 : RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.FLEE.MIN, SmallEventConstants.BAD_PET.LOVE_LOST.FLEE.MAX);
			}
			else {
				// Slow player: always lose 1-10 love
				loveLost = RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.FLEE.MIN, SmallEventConstants.BAD_PET.LOVE_LOST.FLEE.MAX);
			}

			return {
				loveLost,
				interactionType: "flee"
			};
		}
	},
	{
		id: "hide",
		reactionClass: ReactionCollectorBadPetHideReaction,
		handler: (_petEntity, petModel, _player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			let loveLost: number;

			// If pet force is weak (< 5), 30% chance to lose nothing
			if (petModel.force < SmallEventConstants.BAD_PET.THRESHOLDS.PET_FORCE_WEAK) {
				const success = RandomUtils.crowniclesRandom.bool(SmallEventConstants.BAD_PET.THRESHOLDS.HIDE_SUCCESS_CHANCE_WEAK);
				loveLost = success ? 0 : RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.HIDE.MIN, SmallEventConstants.BAD_PET.LOVE_LOST.HIDE.MAX);
			}
			else {
				// Strong pet: always lose some love
				loveLost = RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.HIDE.MIN, SmallEventConstants.BAD_PET.LOVE_LOST.HIDE.MAX);
			}

			return Promise.resolve({
				loveLost,
				interactionType: "hide"
			});
		}
	},
	{
		id: "wait",
		reactionClass: ReactionCollectorBadPetWaitReaction,
		handler: (_petEntity, _petModel, _player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => Promise.resolve({
			loveLost: SmallEventConstants.BAD_PET.LOVE_LOST.WAIT,
			interactionType: "wait"
		})
	},
	{
		id: "protect",
		reactionClass: ReactionCollectorBadPetProtectReaction,
		handler: async (_petEntity, _petModel, player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
			const playerDefense = player.getCumulativeDefense(playerActiveObjects);

			// Linear scaling: 70% success at 500 defense, 0% at 0 defense
			const defenseRatio = Math.min(playerDefense / SmallEventConstants.BAD_PET.THRESHOLDS.PLAYER_DEFENSE_MAX, 1);
			const successChance = defenseRatio * SmallEventConstants.BAD_PET.THRESHOLDS.PROTECT_MAX_SUCCESS_CHANCE;

			const success = RandomUtils.crowniclesRandom.bool(successChance);
			const loveLost = success
				? 0
				: RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.PROTECT.FAIL_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.PROTECT.FAIL_MAX);

			return {
				loveLost,
				interactionType: "protect"
			};
		}
	},
	{
		id: "distract",
		reactionClass: ReactionCollectorBadPetDistractReaction,
		handler: (_petEntity, _petModel, _player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			const success = RandomUtils.crowniclesRandom.bool(0.5);
			const loveLost = success
				? 0
				: RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.DISTRACT.FAIL_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.DISTRACT.FAIL_MAX);
			return Promise.resolve({
				loveLost,
				interactionType: "distract"
			});
		}
	},
	{
		id: "calm",
		reactionClass: ReactionCollectorBadPetCalmReaction,
		handler: (petEntity, _petModel, _player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			// Based on the pet's current love — the closer love is to the maximum, the lower the chance of failure
			const maxLove = PetConstants.MAX_LOVE_POINTS;
			const currentLove = petEntity.lovePoints;
			const loveRatio = currentLove / maxLove;

			const successChance = SmallEventConstants.BAD_PET.LOVE_LOST.CALM.BASE_SUCCESS_CHANCE
				+ loveRatio * SmallEventConstants.BAD_PET.LOVE_LOST.CALM.LOVE_BONUS_MULTIPLIER;
			const success = RandomUtils.crowniclesRandom.bool(successChance);
			const loveLost = success
				? 0
				: RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.CALM.FAIL_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.CALM.FAIL_MAX);
			return Promise.resolve({
				loveLost,
				interactionType: "calm"
			});
		}
	},
	{
		id: "imposer",
		reactionClass: ReactionCollectorBadPetImposerReaction,
		handler: (_petEntity, petModel, _player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			// Based on the pet's rarity — the rarer the pet, the higher the chance of success
			const rarity = petModel.rarity;

			// Rarity: 1 = common, 8 = legendary
			const successChance = SmallEventConstants.BAD_PET.LOVE_LOST.IMPOSER.BASE_SUCCESS_CHANCE
				+ (rarity - 1) * SmallEventConstants.BAD_PET.LOVE_LOST.IMPOSER.RARITY_BONUS;
			const success = RandomUtils.crowniclesRandom.bool(successChance);
			const loveLost = success
				? 0
				: RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.IMPOSER.FAIL_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.IMPOSER.FAIL_MAX);
			return Promise.resolve({
				loveLost,
				interactionType: "imposer"
			});
		}
	},
	{
		id: "energize",
		reactionClass: ReactionCollectorBadPetEnergizeReaction,
		handler: (petEntity, petModel, _player): Promise<{
			loveLost: number;
			interactionType: string;
		}> => {
			// Based on the pet's vigor
			const vigor = PetUtils.getPetVigor(petModel, petEntity.lovePoints);

			// Higher vigor = better chance (vigor ranges from 0 to 6)
			const successChance = SmallEventConstants.BAD_PET.LOVE_LOST.ENERGIZE.BASE_SUCCESS_CHANCE
				+ vigor / PetConstants.VIGOR.MAX * SmallEventConstants.BAD_PET.LOVE_LOST.ENERGIZE.VIGOR_BONUS_MULTIPLIER;
			const success = RandomUtils.crowniclesRandom.bool(successChance);
			const loveLost = success
				? 0
				: RandomUtils.randInt(SmallEventConstants.BAD_PET.LOVE_LOST.ENERGIZE.FAIL_MIN, SmallEventConstants.BAD_PET.LOVE_LOST.ENERGIZE.FAIL_MAX);
			return Promise.resolve({
				loveLost,
				interactionType: "energize"
			});
		}
	}
];

const REACTION_HANDLERS: Record<string, BadPetActionHandler> = {};
for (const action of BAD_PET_ACTIONS) {
	// map by id (eg 'intimidate') so we can use reaction.data.id (like witch)
	REACTION_HANDLERS[action.id] = action.handler;
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
			// reactions carry data.id (eg 'intimidate'), use it to find the handler (same approach as witch)
			const reactionId = (reaction.reaction.data as unknown as { id?: string }).id as string | undefined;
			const handler = reactionId ? REACTION_HANDLERS[reactionId] : undefined;
			if (handler) {
				const petEntity = await PetEntity.findOne({ where: { id: player.petId } });
				if (petEntity) {
					const petModel = PetDataController.instance.getById(petEntity.typeId);
					if (petModel) {
						result = await handler(petEntity, petModel, player);
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

		const petEntity = await PetEntity.findOne({ where: { id: player.petId } });
		const petId = petEntity ? petEntity.typeId : 0;
		const sex = petEntity ? petEntity.sex : StringConstants.SEX.MALE.short;
		const petNickname = petEntity?.nickname ?? undefined;

		response.push(makePacket(SmallEventBadPetPacket, {
			loveLost: result.loveLost,
			interactionType: result.interactionType,
			petId,
			sex,
			petNickname
		}));
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async (player: Player): Promise<boolean> => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}

		// Moltiar avoids Mount Celestrum where Talvar resides
		const destination = player.getDestination();
		const origin = player.getPreviousMap();
		if ([destination.id, origin.id].some(mapId => mapId === MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM)) {
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

	executeSmallEvent: async (response: CrowniclesPacket[], player: Player, context): Promise<void> => {
		const selectedActions = pickRandom(BAD_PET_ACTIONS, 3);
		const reactions = selectedActions.map(a => {
			const ReactionClass = a.reactionClass;
			const instance = new ReactionClass() as unknown as ReactionCollectorReaction & { id?: string };
			instance.id = a.id;
			return {
				reaction: instance as ReactionCollectorReaction,
				reactionClass: ReactionClass
			};
		});

		const petEntity = await PetEntity.findByPk(player.petId);
		const petId = petEntity ? petEntity.typeId : 0;
		const sex = petEntity ? petEntity.sex : StringConstants.SEX.MALE.short;
		const petNickname = petEntity?.nickname ?? undefined;

		const collector = new ReactionCollectorBadPetSmallEvent(petId, sex, petNickname, reactions);

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
	}
};

