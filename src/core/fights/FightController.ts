import {Fighter, FightStatModifierOperation} from "./fighter/Fighter";
import {FightState} from "./FightState";
import {FightView} from "./FightView";
import {RandomUtils} from "../utils/RandomUtils";
import {FightConstants} from "../constants/FightConstants";
import {TextBasedChannel} from "discord.js";
import {FighterStatus} from "./FighterStatus";
import {FightAction} from "./actions/FightAction";
import {FightActions} from "./actions/FightActions";
import {FightWeather} from "./FightWeather";
import {FightOvertimeBehavior} from "./FightOvertimeBehavior";
import {MonsterFighter} from "./fighter/MonsterFighter";
import {PlayerFighter} from "./fighter/PlayerFighter";
import {PVEConstants} from "../constants/PVEConstants";

/**
 * @class FightController
 */
export class FightController {

	turn: number;

	public readonly fighters: Fighter[];

	public readonly friendly: boolean;

	public readonly fightInitiator: Fighter;

	private readonly _fightView: FightView;

	private state: FightState;

	private endCallback: (fight: FightController) => Promise<void>;

	private readonly weather: FightWeather;

	private readonly overtimeBehavior: FightOvertimeBehavior;

	public constructor(
		fighters: { fighter1: Fighter, fighter2: Fighter },
		fightParameters: { friendly: boolean, overtimeBehavior: FightOvertimeBehavior },
		channel: TextBasedChannel,
		language: string) {
		this.fighters = [fighters.fighter1, fighters.fighter2];
		this.fightInitiator = fighters.fighter1;
		this.state = FightState.NOT_STARTED;
		this.turn = 1;
		this.friendly = fightParameters.friendly;
		this._fightView = new FightView(channel, language, this);
		this.weather = new FightWeather();
		this.overtimeBehavior = fightParameters.overtimeBehavior;
	}

	/**
	 * Start a fight
	 * @public
	 */
	public async startFight(): Promise<void> {
		// make the fighters ready
		for (let i = 0; i < this.fighters.length; i++) {
			await this.fighters[i].startFight(this._fightView, i === 0 ? FighterStatus.ATTACKER : FighterStatus.DEFENDER);
		}

		await this._fightView.introduceFight(this.fighters[0], this.fighters[1]);

		// the player with the highest speed start the fight
		if (this.fighters[1].getSpeed() > this.fighters[0].getSpeed() || RandomUtils.draftbotRandom.bool() && this.fighters[1].getSpeed() === this.fighters[0].getSpeed()) {
			this.invertFighters();
		}
		this.state = FightState.RUNNING;
		await this.prepareNextTurn();
	}

	/**
	 * Get the playing fighter or null if the fight is not running
	 * @return {Fighter|null}
	 */
	public getPlayingFighter(): Fighter {
		return this.state === FightState.RUNNING ? this.fighters[0] : null;
	}

	/**
	 * Get the defending fighter or null if the fight is not running
	 * @return {Fighter|null}
	 */
	public getDefendingFighter(): Fighter {
		return this.state === FightState.RUNNING ? this.fighters[1] : null;
	}

	/**
	 * End the fight
	 */
	public async endFight(): Promise<void> {
		this.state = FightState.FINISHED;

		this.checkNegativeFightPoints();

		const winner = this.getWinner();
		const isADraw = this.isADraw();

		this._fightView.outroFight(this.fighters[(1 - winner) % 2], this.fighters[winner % 2], isADraw);

		for (let i = 0; i < this.fighters.length; ++i) {
			await this.fighters[i].endFight(this._fightView, i === winner);
		}
		if (this.endCallback) {
			await this.endCallback(this);
		}
	}

	/**
	 * Cancel a fight and unblock the fighters, used when a fight has bugged (for example if a message was deleted)
	 */
	endBugFight(): void {
		this.state = FightState.BUG;
		for (const fighter of this.fighters) {
			fighter.unblock();
		}
		this._fightView.displayBugFight();
	}

	/**
	 * Get the winner of the fight does not check for draw
	 * @private
	 */
	public getWinner(): number {
		return this.fighters[0].isDead() ? 1 : 0;
	}

	public getWinnerFighter(): Fighter {
		return this.fighters[0].isDead() ? this.fighters[1].isDead() ? null : this.fighters[1] : this.fighters[0];
	}

	/**
	 * Check if the fight is a draw
	 * @private
	 */
	public isADraw(): boolean {
		return this.fighters[0].isDead() === this.fighters[1].isDead() || this.turn >= FightConstants.MAX_TURNS && !(this.fighters[0].isDead() || this.fighters[1].isDead());
	}

	/**
	 * Execute the next fight action
	 * @param fightAction {FightAction} the fight action to execute
	 * @param endTurn {boolean} true if the turn should be ended after the action has been executed
	 */
	public async executeFightAction(fightAction: FightAction, endTurn: boolean): Promise<void> {
		if (endTurn) {
			this.getPlayingFighter().nextFightAction = null;
		}

		const enoughBreath = this.getPlayingFighter().useBreath(fightAction.getBreathCost());

		if (!enoughBreath) {
			if (RandomUtils.draftbotRandom.bool(FightConstants.OUT_OF_BREATH_FAILURE_PROBABILITY)) {
				fightAction = FightActions.getFightActionById("outOfBreath");
			}
			else {
				this.getPlayingFighter().setBreath(0);
			}
		}


		const receivedMessage = fightAction.use(this.getPlayingFighter(), this.getDefendingFighter(), this.turn, this._fightView.language, this.weather);

		await this._fightView.updateHistory(fightAction.getEmoji(), this.getPlayingFighter().getMention(), receivedMessage).catch(
			(e) => {
				console.log("### FIGHT MESSAGE DELETED OR LOST : updateHistory ###");
				console.error(e.stack);
				this.endBugFight();
			});
		if (this.state !== FightState.RUNNING) {
			// an error occurred during the update of the history
			return;
		}
		this.getPlayingFighter().fightActionsHistory.push(fightAction);
		if (this.hadEnded()) {
			await this.endFight();
			return;
		}
		if (endTurn) {
			this.turn++;
			this.invertFighters();
			this.getPlayingFighter().regenerateBreath(this.turn < 2);
			await this.prepareNextTurn();
		}
		else {
			await this._fightView.displayFightStatus().catch(
				(e) => {
					console.log("### FIGHT MESSAGE DELETED OR LOST : displayFightStatus ###");
					console.error(e.stack);
					this.endBugFight();
				});
		}
	}

	/**
	 * Set a callback to be called when the fight ends
	 * @param callback
	 */
	public setEndCallback(callback: (fight: FightController) => Promise<void>): void {
		this.endCallback = callback;
	}

	/**
	 * Get the fight view of the fight controller
	 */
	public getFightView(): FightView {
		return this._fightView;
	}

	/**
	 * Check if any of the fighters has negative fight points
	 * @private
	 */
	private checkNegativeFightPoints(): void {
		// set the fight points to 0 if any of the fighters have fight points under 0
		for (const fighter of this.fighters) {
			if (fighter.getFightPoints() < 0) {
				fighter.setBaseFightPoints(0);
			}
		}
	}

	/**
	 * Execute a turn of a fight
	 * @private
	 */
	private async prepareNextTurn(): Promise<void> {
		// Weather related actions
		const weatherMessage = this.weather.applyWeatherEffect(this.getPlayingFighter(), this.turn, this._fightView.language);
		if (weatherMessage) {
			await this._fightView.displayWeatherStatus(this.weather.getWeatherEmote(), weatherMessage);
		}

		if (this.overtimeBehavior === FightOvertimeBehavior.END_FIGHT_DRAW && this.turn >= FightConstants.MAX_TURNS || this.hadEnded()) {
			await this.endFight();
			return;
		}

		if (this.overtimeBehavior === FightOvertimeBehavior.INCREASE_DAMAGE_PVE && this.turn >= FightConstants.MAX_TURNS) {
			this.increaseDamagesPve(this.turn);
		}

		if (this.getPlayingFighter().hasFightAlteration()) {
			await this.executeFightAction(this.getPlayingFighter().alteration, false);
		}
		if (this.state !== FightState.RUNNING) {
			// a player was killed by a fight alteration, no need to continue the fight
			return;
		}
		await this._fightView.displayFightStatus().catch(
			(e) => {
				console.log("### FIGHT MESSAGE DELETED OR LOST : displayFightStatus ###");
				console.error(e.stack);
				this.endBugFight();
			});
		if (this.state !== FightState.RUNNING) {
			// An issue occurred during the fight status display, no need to continue the fight
			return;
		}

		this.getPlayingFighter().reduceCounters();

		// If the player is fighting a monster, and it's his first turn, then use the "rage explosion" action without changing turns
		if (this.turn < 3 && this.getDefendingFighter() instanceof MonsterFighter && (this.getPlayingFighter() as PlayerFighter).player.rage > 0) {
			await this.executeFightAction(FightActions.getFightActionById("rageExplosion"), false);
			if (this.hadEnded()) {
				return;
			}
		}

		if (this.getPlayingFighter().nextFightAction === null) {
			try {
				await this.getPlayingFighter().chooseAction(this._fightView);
			}
			catch (e) {
				console.log("### FIGHT MESSAGE DELETED OR LOST : displayFightStatus ###");
				console.error(e.stack);
				this.endBugFight();
			}
		}
		else {
			await this.executeFightAction(this.getPlayingFighter().nextFightAction, true);
		}
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
	 * Change who is the player 1 and who is the player 2.
	 * @private
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
	 * @private
	 */
	private hadEnded(): boolean {
		return (
			this.getPlayingFighter().isDeadOrBug() ||
			this.getDefendingFighter().isDeadOrBug() ||
			this.state !== FightState.RUNNING);
	}
}
