import { FightController } from "./FightController";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerFighter } from "./fighter/PlayerFighter";
import { Fighter } from "./fighter/Fighter";
import { MonsterFighter } from "./fighter/MonsterFighter";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { CommandFightIntroduceFightersPacket } from "../../../../Lib/src/packets/fights/FightIntroductionPacket";
import { CommandFightStatusPacket } from "../../../../Lib/src/packets/fights/FightStatusPacket";
import { FightAction } from "../../data/FightAction";
import {
	FightActionBuff, FightActionResult, FightStatBuffed
} from "../../../../Lib/src/types/FightActionResult";
import { CommandFightHistoryItemPacket } from "../../../../Lib/src/packets/fights/FightHistoryItemPacket";
import { FightStatModifierOperation } from "../../../../Lib/src/types/FightStatModifierOperation";
import { toSignedPercent } from "../../../../Lib/src/utils/StringUtils";
import { FightAlterationResult } from "../../../../Lib/src/types/FightAlterationResult";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import {
	ReactionCollectorFightChooseAction,
	ReactionCollectorFightChooseActionReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";
import { AIFightActionChoosePacket } from "../../../../Lib/src/packets/fights/AIFightActionChoosePacket";
import { AiPlayerFighter } from "./fighter/AiPlayerFighter";
import { CommandFightEndOfFightPacket } from "../../../../Lib/src/packets/fights/EndOfFightPacket";
import { BuggedFightPacket } from "../../../../Lib/src/packets/fights/BuggedFightPacket";
import { PetAssistanceResult } from "../../../../Lib/src/types/PetAssistanceResult";
import { OwnedPet } from "../../../../Lib/src/types/OwnedPet";
import { getDarkAttackPowerMultiplier } from "./actions/DarkAttackWear";

type HistoryFighter = PlayerFighter | MonsterFighter | AiPlayerFighter;

type HistoryActionResult = FightActionResult | FightAlterationResult | PetAssistanceResult;

type StatsChange = {
	attack?: number;
	defense?: number;
	speed?: number;
	breath?: number;
	energy?: number;
};

type FightActionEffectDealt = NonNullable<CommandFightHistoryItemPacket["fightActionEffectDealt"]>;

type FightActionEffectReceived = NonNullable<CommandFightHistoryItemPacket["fightActionEffectReceived"]>;

const PERCENT_STATS = [
	FightStatBuffed.ATTACK,
	FightStatBuffed.DEFENSE,
	FightStatBuffed.SPEED,
	FightStatBuffed.BREATH
];

const ADDED_STATS = [FightStatBuffed.BREATH, FightStatBuffed.ENERGY];

/**
 * Whether a buff is displayed as a stat change: a multiplied stat, or an added breath or energy
 */
function isDisplayedStatChange(buff: FightActionBuff): boolean {
	return PERCENT_STATS.includes(buff.stat) && buff.operator === FightStatModifierOperation.MULTIPLIER
		|| ADDED_STATS.includes(buff.stat) && buff.operator === FightStatModifierOperation.ADDITION;
}

/**
 * Stat changes an action applied to the fighter (selfTarget) or to its opponent
 */
function buildStatsChange(result: HistoryActionResult, selfTarget: boolean): StatsChange {
	const change: StatsChange = {};
	for (const buff of result.buffs?.filter(buff => buff.selfTarget === selfTarget && isDisplayedStatChange(buff)) ?? []) {
		switch (buff.stat) {
			case FightStatBuffed.ATTACK:
				change.attack = toSignedPercent(buff.value);
				break;
			case FightStatBuffed.DEFENSE:
				change.defense = toSignedPercent(buff.value);
				break;
			case FightStatBuffed.SPEED:
				change.speed = toSignedPercent(buff.value);
				break;
			case FightStatBuffed.BREATH:
				change.breath = buff.value;
				break;
			case FightStatBuffed.ENERGY:
				change.energy = buff.value;
				break;
			default:
				break;
		}
	}
	return change;
}

/**
 * The pet of a player whose action is a pet assistance
 */
function getPetIfRelevant(fighter: HistoryFighter, result: HistoryActionResult): OwnedPet | undefined {
	return !(fighter instanceof MonsterFighter) && fighter.pet && "assistanceStatus" in result
		? fighter.pet.asOwnedPet()
		: undefined;
}

/**
 * Status of an attack, of an alteration or of a pet assistance
 */
function historyStatus(result: HistoryActionResult): string {
	if ("attackStatus" in result) {
		return result.attackStatus;
	}
	return "state" in result ? result.state : result.assistanceStatus;
}

function newAlterationOf(result: HistoryActionResult, selfTarget: boolean): string | undefined {
	return "alterations" in result && result.alterations?.find(alteration => alteration.selfTarget === selfTarget)?.alteration || undefined;
}

function buildEffectDealt(result: HistoryActionResult): FightActionEffectDealt {
	return {
		...buildStatsChange(result, false),
		newAlteration: newAlterationOf(result, false),
		damages: result.damages,
		reflectedDamages: "reflectedDamages" in result ? result.reflectedDamages : undefined,
		summoning: result.buffs?.find(buff => buff.stat === FightStatBuffed.SUMMON)?.value
	};
}

function buildEffectReceived(result: HistoryActionResult): FightActionEffectReceived {
	return {
		...buildStatsChange(result, true),
		newAlteration: newAlterationOf(result, true),
		damages: result.buffs?.find(
			buff => buff.selfTarget && buff.stat === FightStatBuffed.DAMAGE && buff.operator === FightStatModifierOperation.ADDITION
		)?.value
	};
}

export class FightView {
	public context: PacketContext;

	fightController: FightController;

	public constructor(context: PacketContext, fightController: FightController) {
		this.context = context;
		this.fightController = fightController;
	}

	/**
	 * Get the id and breath cost of each fight action available to a fighter
	 * @param fighter
	 */
	private static getActionsBreathCosts(fighter: PlayerFighter | MonsterFighter | AiPlayerFighter): Array<[string, number]> {
		return Array.from(fighter.availableFightActions, ([id, action]): [string, number] => [id, action.breath]);
	}

	/**
	 * Button of an action in the action menu, with its current damage multiplier against the opponent when it changes during the fight
	 * @param fighter
	 * @param opponent
	 * @param actionId
	 */
	private static getActionChoice(fighter: PlayerFighter, opponent: Fighter, actionId: string): ReactionCollectorFightChooseActionReaction {
		return actionId === FightConstants.FIGHT_ACTIONS.PLAYER.DARK_ATTACK
			? {
				id: actionId,
				powerMultiplier: getDarkAttackPowerMultiplier(fighter, opponent)
			}
			: { id: actionId };
	}

	/**
	 * Get the fields of the intro packet describing the opponent, which is either a monster or a player
	 * @param opponent
	 */
	private static getOpponentIntroFields(opponent: MonsterFighter | AiPlayerFighter): Pick<CommandFightIntroduceFightersPacket, "fightOpponentKeycloakId" | "fightOpponentMonsterId" | "fightOpponentPet"> {
		if (opponent instanceof MonsterFighter) {
			return { fightOpponentMonsterId: opponent.monster.id };
		}
		return {
			fightOpponentKeycloakId: opponent.player.keycloakId,
			...opponent.pet ? { fightOpponentPet: opponent.pet.asOwnedPet() } : {}
		};
	}

	/**
	 * Send the fight intro message
	 * @param fighter
	 * @param opponent
	 * @param response
	 */
	introduceFight(response: CrowniclesPacket[], fighter: PlayerFighter | AiPlayerFighter, opponent: MonsterFighter | AiPlayerFighter): void {
		const {
			id, friendly, levelCap
		} = this.fightController;
		response.push(makePacket(CommandFightIntroduceFightersPacket, {
			fightId: id,
			fightInitiatorKeycloakId: fighter.player.keycloakId,
			fightInitiatorActions: FightView.getActionsBreathCosts(fighter),
			fightOpponentActions: FightView.getActionsBreathCosts(opponent),
			...FightView.getOpponentIntroFields(opponent),
			...fighter.pet ? { fightInitiatorPet: fighter.pet.asOwnedPet() } : {},
			friendly,
			...levelCap !== undefined ? { levelCap } : {}
		}));
	}


	/**
	 * Summarize current fight status, displaying fighter's stats
	 */
	displayFightStatus(response: CrowniclesPacket[]): void {
		if (this.fightController.isSilentMode()) {
			return;
		}
		const playingFighter = this.fightController.getPlayingFighter();
		const defendingFighter = this.fightController.getDefendingFighter();
		if (!playingFighter || !defendingFighter) {
			return;
		}
		response.push(makePacket(CommandFightStatusPacket, {
			fightId: this.fightController.id,
			numberOfTurn: this.fightController.turn,
			maxNumberOfTurn: FightConstants.MAX_TURNS,
			activeFighter: {
				keycloakId: playingFighter instanceof MonsterFighter ? undefined : playingFighter.player.keycloakId,
				monsterId: playingFighter instanceof MonsterFighter ? playingFighter.monster.id : undefined,
				glory: playingFighter instanceof MonsterFighter ? undefined : playingFighter.getDisplayedGloryPoints(),
				stats: {
					power: playingFighter.getEnergy(),
					attack: playingFighter.getAttack(),
					defense: playingFighter.getDefense(),
					speed: playingFighter.getSpeed(),
					breath: playingFighter.getBreath(),
					maxBreath: playingFighter.getMaxBreath(),
					breathRegen: playingFighter.getRegenBreath()
				}
			},
			defendingFighter: {
				keycloakId: defendingFighter instanceof MonsterFighter ? undefined : defendingFighter.player.keycloakId,
				monsterId: defendingFighter instanceof MonsterFighter ? defendingFighter.monster.id : undefined,
				glory: defendingFighter instanceof MonsterFighter ? undefined : defendingFighter.getDisplayedGloryPoints(),
				stats: {
					power: defendingFighter.getEnergy(),
					attack: defendingFighter.getAttack(),
					defense: defendingFighter.getDefense(),
					speed: defendingFighter.getSpeed(),
					breath: defendingFighter.getBreath(),
					maxBreath: defendingFighter.getMaxBreath(),
					breathRegen: defendingFighter.getRegenBreath()
				}
			}
		}));
	}

	/**
	 * Update the fight history with the new action made by a fighter (can be an attack or a status alteration)
	 * @param response
	 * @param fighter - the fighter that made the action or received the alteration
	 * @param fightAction - the action made by the fighter
	 * @param fightActionResult - the result of the action
	 */
	addActionToHistory(
		response: CrowniclesPacket[],
		fighter: HistoryFighter,
		fightAction: FightAction,
		fightActionResult: HistoryActionResult
	): void {
		if (this.fightController.isSilentMode()) {
			return;
		}
		const usedAction = Object.prototype.hasOwnProperty.call(fightActionResult, "usedAction") ? (fightActionResult as FightActionResult).usedAction : undefined;
		const result = usedAction?.result ?? fightActionResult;
		response.push(makePacket(CommandFightHistoryItemPacket, {
			fightId: this.fightController.id,
			fighterKeycloakId: fighter instanceof MonsterFighter ? undefined : fighter.player.keycloakId,
			monsterId: fighter instanceof MonsterFighter ? fighter.monster.id : undefined,

			/*
			 * Sometimes fightActionResult.usedAction is not the same
			 * as what the user selected (fightAction is what the user selected)
			 *        and fightActionResult.usedAction is what ended up being used
			 */
			fightActionId: fightAction.id,
			usedFightActionId: usedAction?.id,
			customMessage: "customMessage" in result ? result.customMessage : false,
			customMessageFail: "customMessageFail" in result ? result.customMessageFail : false,
			status: historyStatus(result),
			pet: getPetIfRelevant(fighter, result),
			fightActionEffectDealt: buildEffectDealt(result),
			fightActionEffectReceived: buildEffectReceived(result)
		}));
	}

	/**
	 * Display the fight action menu
	 * @param response
	 * @param playerFighter - the player fighter - This cannot be a monster: they do not use a front-end to play crownicles :p
	 * @param actions - the actions available for the player
	 */
	displayFightActionMenu(response: CrowniclesPacket[], playerFighter: PlayerFighter, actions: Map<string, FightAction>): void {
		const opponent = this.fightController.getDefendingFighter()!;
		const collector = new ReactionCollectorFightChooseAction(
			this.fightController.id,
			playerFighter.player.keycloakId,
			[...actions.keys()].map(actionId => FightView.getActionChoice(playerFighter, opponent, actionId))
		);

		const endCallback: EndCallback = async (collector, response) => {
			const reaction = collector.getFirstReaction();
			if (!reaction) {
				playerFighter.kill();
				await this.fightController.endFight(response, false);
			}
			else {
				await this.fightController.executeFightAction(actions.get((reaction.reaction.data as ReactionCollectorFightChooseActionReaction).id)!, true, response);
			}
		};

		const packet = new ReactionCollectorInstance(
			collector,
			this.context,
			{
				allowedPlayerKeycloakIds: [playerFighter.player.keycloakId]
			},
			endCallback
		)
			.build();

		response.push(packet);
	}

	/**
	 * Display the AI choose action message
	 * @param response
	 * @param waitTimeMs
	 */
	displayAiChooseAction(response: CrowniclesPacket[], waitTimeMs: number): void {
		if (this.fightController.isSilentMode()) {
			return;
		}
		response.push(makePacket(AIFightActionChoosePacket, {
			fightId: this.fightController.id,
			ms: waitTimeMs
		}));
	}

	/**
	 * Generate packets to display the end of the fight
	 * @param response
	 * @param loser
	 * @param winner
	 * @param draw
	 */
	outroFight(
		response: CrowniclesPacket[],
		loser: PlayerFighter | MonsterFighter | AiPlayerFighter,
		winner: PlayerFighter | MonsterFighter | AiPlayerFighter,
		draw: boolean
	): void {
		if (this.fightController.isSilentMode()) {
			return;
		}
		response.push(makePacket(CommandFightEndOfFightPacket, {
			winner: {
				keycloakId: winner instanceof MonsterFighter ? undefined : winner.player.keycloakId,
				monsterId: winner instanceof MonsterFighter ? winner.monster.id : undefined,
				finalEnergy: winner.getEnergy(),
				maxEnergy: winner.getMaxEnergy()
			},
			looser: {
				keycloakId: loser instanceof MonsterFighter ? undefined : loser.player.keycloakId,
				monsterId: loser instanceof MonsterFighter ? loser.monster.id : undefined,
				finalEnergy: loser.getEnergy(),
				maxEnergy: loser.getMaxEnergy()
			},
			draw,
			turns: this.fightController.turn,
			maxTurns: FightConstants.MAX_TURNS,
			petReaction: this.fightController.petReactionData
		}));
	}

	/**
	 * Send a bugged end-of-fight packet
	 * @param response
	 */
	displayBugFight(response: CrowniclesPacket[]): void {
		response.push(makePacket(BuggedFightPacket, {}));
	}
}
