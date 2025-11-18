import { Fighter } from "./fighter/Fighter";
import { FightState } from "./FightState";
import { FightView } from "./FightView";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	PetConstants, PostFightPetReactionType
} from "../../../../Lib/src/constants/PetConstants";
import { FighterStatus } from "./FighterStatus";
import { FightOvertimeBehavior } from "./FightOvertimeBehavior";
import { MonsterFighter } from "./fighter/MonsterFighter";
import { PlayerFighter } from "./fighter/PlayerFighter";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	attackInfo, FightActionController, statsInfo
} from "./actions/FightActionController";
import {
	FightAction, FightActionDataController
} from "../../data/FightAction";
import { FightStatModifierOperation } from "../../../../Lib/src/types/FightStatModifierOperation";
import {
	FightAlterationResult, FightAlterationState
} from "../../../../Lib/src/types/FightAlterationResult";
import { FightActionResult } from "../../../../Lib/src/types/FightActionResult";
import { AiPlayerFighter } from "./fighter/AiPlayerFighter";
import {
	FightAlteration, FightAlterationDataController
} from "../../data/FightAlteration";
import { PetAssistance } from "../../data/PetAssistance";
import { getAiPetBehavior } from "./PetAssistManager";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { FightsManager } from "./FightsManager";
import { CommandFightPetReactionPacket } from "../../../../Lib/src/packets/fights/FightPetReactionPacket";
import { OwnedPet } from "../../../../Lib/src/types/OwnedPet";

export class FightController {
	turn: number;

	public readonly id: string;

	private readonly fighters: (PlayerFighter | MonsterFighter | AiPlayerFighter)[];

	public readonly fightInitiator: PlayerFighter | AiPlayerFighter;

	private readonly _fightView: FightView;

	private state: FightState;

	private endCallback: (fight: FightController, response: CrowniclesPacket[]) => Promise<void>;

	private readonly overtimeBehavior: FightOvertimeBehavior;

	private readonly silentMode: boolean;

	public constructor(
		fighters: {
			fighter1: PlayerFighter | AiPlayerFighter;
			fighter2: (MonsterFighter | AiPlayerFighter);
		},
		overtimeBehavior: FightOvertimeBehavior,
		context: PacketContext,
		silentMode = false
	) {
		this.id = FightsManager.registerFight(this);
		this.fighters = [fighters.fighter1, fighters.fighter2];
		this.fightInitiator = fighters.fighter1;
		this.state = FightState.NOT_STARTED;
		this.turn = 1;
		this._fightView = new FightView(context, this);
		this.overtimeBehavior = overtimeBehavior;
		this.silentMode = silentMode;
	}

	/**
	 * Start a fight
	 */
	public async startFight(response: CrowniclesPacket[]): Promise<void> {
		// Make the fighters ready
		for (let i = 0; i < this.fighters.length; i++) {
			await this.fighters[i].startFight(this._fightView, i === 0 ? FighterStatus.ATTACKER : FighterStatus.DEFENDER);
		}

		if (!this.silentMode) {
			this._fightView.introduceFight(response, this.fighters[0] as PlayerFighter | AiPlayerFighter, this.fighters[1] as MonsterFighter | AiPlayerFighter);
		}

		// The player with the highest speed starts the fight
		if (this.fighters[1].getSpeed() > this.fighters[0].getSpeed() || RandomUtils.crowniclesRandom.bool() && this.fighters[1].getSpeed() === this.fighters[0].getSpeed()) {
			this.invertFighters();
		}
		this.state = FightState.RUNNING;
		await this.prepareNextTurn(response);
	}

	/**
	 * Check if the fight is in silent mode
	 */
	public isSilentMode(): boolean {
		return this.silentMode;
	}

	/**
	 * Get the playing fighter or null if the fight is not running
	 * @returns
	 */
	public getPlayingFighter(): PlayerFighter | MonsterFighter | AiPlayerFighter {
		return this.state === FightState.RUNNING ? this.fighters[0] : null;
	}

	/**
	 * Get the defending fighter or null if the fight is not running
	 * @returns
	 */
	public getDefendingFighter(): PlayerFighter | MonsterFighter | AiPlayerFighter {
		return this.state === FightState.RUNNING ? this.fighters[1] : null;
	}

	/**
	 * Get the fighter that is not the fight initiator
	 * @returns
	 */
	public getNonFightInitiatorFighter(): PlayerFighter | MonsterFighter | AiPlayerFighter {
		return this.fighters[1] === this.fightInitiator ? this.fighters[0] : this.fighters[1];
	}

	/**
	 * End the fight
	 * @param response the response to send to the player
	 * @param bug true if the fight has bugged
	 */
	public async endFight(response: CrowniclesPacket[], bug = false): Promise<void> {
		this.state = bug ? FightState.FINISHED : FightState.BUG;

		this.checkNegativeEnergy();

		const isADraw = this.isADraw();
		const winnerFighter = this.getWinnerFighter();
		const loserFighter = this.getLooserFighter();
		const initiatorFighter = this.fightInitiator;
		const opponentFighter = this.getNonFightInitiatorFighter();
		const displayedWinner = winnerFighter ?? (loserFighter === initiatorFighter ? opponentFighter : initiatorFighter);
		const displayedLoser = loserFighter ?? (displayedWinner === initiatorFighter ? opponentFighter : initiatorFighter);

		this._fightView.outroFight(response, displayedLoser, displayedWinner, isADraw);

		for (const fighter of this.fighters) {
			fighter.unblock();
			await fighter.endFight(!isADraw && fighter === winnerFighter, response, bug, this.turn);
		}

		if (!isADraw) {
			await Promise.all([
				this.applyPostFightPetLoveChange(winnerFighter, "win", response),
				this.applyPostFightPetLoveChange(loserFighter, "loss", response)
			]);
		}

		if (this.endCallback) {
			await this.endCallback(this, response);
		}
	}

	/**
	 * Cancel a fight and unblock the fighters, used when a fight has bugged (for example, if a message was deleted)
	 * @param response {CrowniclesPacket[]}
	 */
	public async endBugFight(response: CrowniclesPacket[]): Promise<void> {
		for (const fighter of this.fighters) {
			fighter.unblock();
			if (fighter instanceof PlayerFighter) {
				fighter.kill();
			}
		}
		this._fightView.displayBugFight(response);

		await this.endFight(response, true);
	}

	/**
	 * Get the winner fighter of the fight
	 * @returns the winner fighter or null if there is no winner
	 */
	public getWinnerFighter(): PlayerFighter | MonsterFighter | AiPlayerFighter {
		return this.fighters[0].isDead() ? this.fighters[1].isDead() ? null : this.fighters[1] : this.fighters[0];
	}

	/**
	 * Get the looser fighter of the fight
	 */
	public getLooserFighter(): PlayerFighter | MonsterFighter | AiPlayerFighter {
		return this.fighters[0].isDead() ? this.fighters[0] : this.fighters[1].isDead() ? this.fighters[1]	: null;
	}

	/**
	 * Check if the fight is a draw
	 */
	public isADraw(): boolean {
		return this.fighters[0].isDead() === this.fighters[1].isDead() || this.turn >= FightConstants.MAX_TURNS && !(this.fighters[0].isDead() || this.fighters[1].isDead());
	}

	/**
	 * Execute the next fight action
	 * @param fightAction {FightAction} the fight action to execute
	 * @param endTurn {boolean} true if the turn should be ended after the action has been executed
	 * @param response {CrowniclesPacket[]} the response to send to the player
	 */
	public async executeFightAction(fightAction: FightAction, endTurn: boolean, response: CrowniclesPacket[]): Promise<void> {
		if (this.hadEnded()) {
			// The fight is probably bugged, no need to continue
			return;
		}

		if (endTurn) {
			this.getPlayingFighter().nextFightAction = null;
		}

		// Get the current fighters
		const attacker = this.getPlayingFighter();
		const defender = this.getDefendingFighter();

		const breathScenarioOutcome = this.handleOutOfBreathScenarios(attacker, fightAction, defender);
		fightAction = breathScenarioOutcome.fightAction;
		const result = breathScenarioOutcome.result;

		// Check if we need to use the out-of-breath action instead
		if ("state" in result) {
			// If the result is a fight alteration result, that means that the player did not have enough breath
			fightAction = FightAlterationDataController.instance.getById(FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH);
		}
		this._fightView.addActionToHistory(response, attacker, fightAction, result);

		if (this.state !== FightState.RUNNING) {
			// An error occurred during the update of the history
			return;
		}
		attacker.fightActionsHistory.push(fightAction);
		if (this.overtimeBehavior === FightOvertimeBehavior.END_FIGHT_DRAW && this.turn >= FightConstants.MAX_TURNS || this.hadEnded()) {
			await this.endFight(response);
			return;
		}
		if (endTurn) {
			this.turn++;
			this.invertFighters();
			this.getPlayingFighter()
				.regenerateBreath(this.turn < 3);
			await this.prepareNextTurn(response);
		}
		else {
			this._fightView.displayFightStatus(response);
		}
	}

	/**
	 * Set a callback to be called when the fight ends
	 * @param callback
	 */
	public setEndCallback(callback: (fight: FightController, response: CrowniclesPacket[]) => Promise<void>): void {
		this.endCallback = callback;
	}

	/**
	 * Execute a fight alteration
	 * @param alteration
	 * @param response
	 */
	private async executeFightAlteration(alteration: FightAlteration, response: CrowniclesPacket[]): Promise<void> {
		const result = alteration.happen(this.getPlayingFighter(), this.getDefendingFighter(), this.turn, this);
		this._fightView.addActionToHistory(response, this.getPlayingFighter(), alteration, result);
		if (this.hadEnded()) {
			await this.endFight(response);
			return;
		}
		this._fightView.displayFightStatus(response);
	}

	/**
	 * Execute a pet assistance
	 * @param petAssistance
	 * @param response
	 */
	private async executePetAssistance(petAssistance: PetAssistance, response: CrowniclesPacket[]): Promise<void> {
		const attacker = this.getPlayingFighter();
		const defender = this.getDefendingFighter();
		const result = await petAssistance.execute(attacker, defender, this.turn, this);
		if (!result) {
			return;
		}
		if (attacker instanceof PlayerFighter) {
			attacker.markPetAssisted();
		}
		this._fightView.addActionToHistory(response, attacker, petAssistance, result);
		if (this.hadEnded()) {
			await this.endFight(response);
			return;
		}
		this._fightView.displayFightStatus(response);
	}

	/**
	 * Handle the out-of-breath scenarios
	 * @param attacker
	 * @param fightAction
	 * @param defender
	 */
	private handleOutOfBreathScenarios(
		attacker: PlayerFighter | MonsterFighter | AiPlayerFighter,
		fightAction: FightAction,
		defender: PlayerFighter | MonsterFighter | AiPlayerFighter
	): {
		fightAction: FightAction; result: FightActionResult | FightAlterationResult;
	} {
		// Check if the attacker has enough breath
		const enoughBreath = attacker.useBreath(fightAction.breath);
		let result: FightActionResult | FightAlterationResult;

		// Handle out of breath scenario
		if (!enoughBreath) {
			if (RandomUtils.crowniclesRandom.bool(FightConstants.OUT_OF_BREATH_FAILURE_PROBABILITY)) {
				const outOfBreathAction = FightAlterationDataController.instance.getById(FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH);
				result = outOfBreathAction.happen(attacker, defender, this.turn, this);
				fightAction = outOfBreathAction;
			}
			else {
				attacker.setBreath(0);
				result = fightAction.use(attacker, defender, this.turn, this);
			}
		}
		else {
			// Execute the action normally
			result = fightAction.use(attacker, defender, this.turn, this);
		}
		return {
			fightAction,
			result
		};
	}

	/**
	 * Check if any of the fighters has negative energy
	 */
	private checkNegativeEnergy(): void {
		// Set the energy to 0 if any of the fighters have energy under 0
		for (const fighter of this.fighters) {
			if (fighter.getEnergy() < 0) {
				fighter.setBaseEnergy(0);
			}
		}
	}

	/**
	 * Execute a turn of a fight
	 */
	private async prepareNextTurn(response: CrowniclesPacket[]): Promise<void> {
		if (this.overtimeBehavior === FightOvertimeBehavior.INCREASE_DAMAGE_PVE && this.turn >= FightConstants.MAX_TURNS) {
			this.increaseDamagesPve(this.turn);
		}

		const currentFighter = this.getPlayingFighter();
		if ((currentFighter instanceof AiPlayerFighter || currentFighter instanceof PlayerFighter) && currentFighter.pet) {
			const petAction = getAiPetBehavior(currentFighter.pet.typeId);
			if (petAction) {
				await this.executePetAssistance(petAction, response);
			}
		}
		if (this.state !== FightState.RUNNING) {
			// A player was killed by a pet action, no need to continue the fight
			return;
		}


		if (this.getPlayingFighter()
			.hasFightAlteration()) {
			await this.executeFightAlteration(this.getPlayingFighter().alteration, response);
		}
		if (this.state !== FightState.RUNNING) {
			// A player was killed by a fight alteration, no need to continue the fight
			return;
		}

		this._fightView.displayFightStatus(response);

		this.getPlayingFighter()
			.reduceCounters();

		// If the player is fighting a monster, and it's his first turn, then use the "rage explosion" action without changing turns
		if (this.turn < 3 && this.getDefendingFighter() instanceof MonsterFighter && (this.getPlayingFighter() as PlayerFighter).player.rage > 0) {
			await this.executeFightAction(FightActionDataController.instance.getById("rageExplosion"), false, response);
			if (this.hadEnded()) {
				return;
			}
		}

		if (this.getPlayingFighter().nextFightAction === null) {
			try {
				await this.getPlayingFighter()
					.chooseAction(this._fightView, response);
			}
			catch (e) {
				CrowniclesLogger.errorWithObj("Fight message deleted or lost : displayFightStatus", e);
				await this.endBugFight(response);
			}
		}
		else {
			await this.executeFightAction(this.getPlayingFighter().nextFightAction, true, response);
		}
	}

	private async applyPostFightPetLoveChange(
		fighter: PlayerFighter | AiPlayerFighter | MonsterFighter | null,
		outcome: "win" | "loss",
		response: CrowniclesPacket[]
	): Promise<void> {
		if (!fighter || fighter instanceof MonsterFighter) {
			return;
		}
		const petEntity = fighter.pet;
		if (!petEntity) {
			return;
		}
		if (outcome === "win" && petEntity.getLoveLevelNumber() === PetConstants.LOVE_LEVEL.TRAINED) {
			this.pushPetReactionPacket(
				response,
				fighter.player.keycloakId,
				PetConstants.POST_FIGHT_REACTION_TYPES.TRAINED,
				0,
				petEntity.asOwnedPet()
			);
			return;
		}
		const probability = fighter instanceof PlayerFighter
			? PetConstants.POST_FIGHT_LOVE_CHANCES.PLAYER_CONTROLLED
			: PetConstants.POST_FIGHT_LOVE_CHANCES.AI_CONTROLLED;
		if (!RandomUtils.crowniclesRandom.bool(probability)) {
			return;
		}
		const loveDelta = outcome === "win" ? 1 : -1;
		await petEntity.changeLovePoints({
			player: fighter.player,
			response,
			amount: loveDelta,
			reason: NumberChangeReason.FIGHT
		});
		await petEntity.save({ fields: ["lovePoints"] });
		this.pushPetReactionPacket(
			response,
			fighter.player.keycloakId,
			loveDelta > 0 ? PetConstants.POST_FIGHT_REACTION_TYPES.LOVE_GAIN : PetConstants.POST_FIGHT_REACTION_TYPES.LOVE_LOSS,
			loveDelta,
			petEntity.asOwnedPet()
		);
	}

	private pushPetReactionPacket(
		response: CrowniclesPacket[],
		playerKeycloakId: string,
		reactionType: PostFightPetReactionType,
		loveDelta: number,
		pet: OwnedPet
	): void {
		response.push(makePacket(CommandFightPetReactionPacket, {
			fightId: this.id,
			playerKeycloakId,
			reactionType,
			loveDelta,
			pet
		}));
	}

	private increaseDamagesPve(currentTurn: number): void {
		for (const fighter of this.fighters) {
			if (fighter instanceof MonsterFighter) {
				if (currentTurn - FightConstants.MAX_TURNS < PVEConstants.DAMAGE_INCREASED_DURATION) {
					fighter.applyAttackModifier({
						operation: FightStatModifierOperation.MULTIPLIER,
						value: 1.2,
						origin: null
					});
					fighter.applyDefenseModifier({
						operation: FightStatModifierOperation.MULTIPLIER,
						value: 1.2,
						origin: null
					});
					fighter.applySpeedModifier({
						operation: FightStatModifierOperation.MULTIPLIER,
						value: 1.2,
						origin: null
					});
				}
				fighter.applyDamageMultiplier(1.2, PVEConstants.DAMAGE_INCREASED_DURATION);
			}
		}
	}

	/**
	 * Change who is player 1 and who is player 2.
	 */
	private invertFighters(): void {
		const temp = this.fighters[0];
		this.fighters[0] = this.fighters[1];
		this.fighters[1] = temp;
		this.fighters[0].setStatus(FighterStatus.ATTACKER);
		this.fighters[1].setStatus(FighterStatus.DEFENDER);
	}

	/**
	 * Check if a fight has ended or not
	 */
	public hadEnded(): boolean {
		return (
			this.state !== FightState.RUNNING
			|| this.getPlayingFighter()
				.isDeadOrBug()
			|| this.getDefendingFighter()
				.isDeadOrBug());
	}
}

/**
 * Get the number of used god moves in the fight
 * @param sender
 * @param receiver
 */
export function getUsedGodMoves(sender: Fighter, receiver: Fighter): number {
	return sender.fightActionsHistory.filter(action => FightConstants.GOD_MOVES.includes(action.id)).length
		+ receiver.fightActionsHistory.filter(action => FightConstants.GOD_MOVES.includes(action.id)).length;
}

/**
 * Default heal fight alteration result
 * @param affected
 */
export function defaultHealFightAlterationResult(affected: Fighter): FightAlterationResult {
	affected.removeAlteration();
	return {
		state: FightAlterationState.STOP
	};
}

/**
 * Default max uses fight alteration result
 */
export function defaultFightAlterationResult(): FightAlterationResult {
	return {
		state: FightAlterationState.ACTIVE
	};
}

/**
 * Default max uses fight alteration result
 * @param affected
 */
export function defaultRandomActionFightAlterationResult(affected: Fighter): FightAlterationResult {
	affected.nextFightAction = affected.getRandomAvailableFightAction();
	return {
		state: FightAlterationState.RANDOM_ACTION
	};
}

/**
 * Default damage fight alteration result
 * @param affected
 * @param statsInfo
 * @param attackInfo
 */
export function defaultDamageFightAlterationResult(affected: Fighter, statsInfo: statsInfo, attackInfo: attackInfo): FightAlterationResult {
	return {
		state: FightAlterationState.ACTIVE,
		damages: FightActionController.getAttackDamage(statsInfo, affected, attackInfo, true)
	};
}
