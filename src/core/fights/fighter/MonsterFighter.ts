import {Fighter} from "./Fighter";
import {FightActions} from "../actions/FightActions";
import {FightView} from "../FightView";
import {DraftBotEmbed} from "../../messages/DraftBotEmbed";
import {RandomUtils} from "../../utils/RandomUtils";
import Monster from "../../database/game/models/Monster";
import MonsterAttack from "../../database/game/models/MonsterAttack";
import {FightAction} from "../actions/FightAction";
import {PVEConstants} from "../../constants/PVEConstants";
import {TranslationModule} from "../../Translations";
import {FighterStatus} from "../FighterStatus";

export class MonsterFighter extends Fighter {

	private readonly name: string;

	private readonly description: string;

	private readonly emoji: string;

	public readonly monster: Monster;

	public constructor(level: number, monster: Monster, monsterAttacks: MonsterAttack[], language: string) {
		const attacks: FightAction[] = [];
		for (const attack of monsterAttacks) {
			if (level >= attack.minLevel) {
				const monsterAttackToAdd = FightActions.getFightActionById(attack.attackId);
				monsterAttackToAdd.setWeightForRandomSelection(attack.weight);
				attacks.push(monsterAttackToAdd);
			}
		}
		super(level, attacks);
		this.stats.fightPoints = this.calculateStat(PVEConstants.STATS_FORMULA.ENERGY, level, monster.fightPointsRatio);
		this.stats.maxFightPoint = this.stats.fightPoints;
		this.stats.attack = this.calculateStat(PVEConstants.STATS_FORMULA.ATTACK, level, monster.attackRatio);
		this.stats.defense = this.calculateStat(PVEConstants.STATS_FORMULA.DEFENSE, level, monster.defenseRatio);
		this.stats.speed = this.calculateStat(PVEConstants.STATS_FORMULA.SPEED, level, monster.speedRatio);
		this.stats.breath = monster.breath;
		this.stats.maxBreath = monster.maxBreath;
		this.stats.breathRegen = monster.breathRegen;
		this.name = monster.getName(language);
		this.description = monster.getDescription(language);
		this.emoji = monster.getEmoji();
		this.monster = monster;
		this.status = FighterStatus.NOT_STARTED;
	}

	calculateStat(stat: { A: number, B: number, C: number }, level: number, ratio: number): number {
		return Math.round(Math.round(stat.A * level * level + stat.B * level + stat.C) * ratio / 100.0);
	}

	chooseAction(fightView: FightView): Promise<void> {
		fightView.channel.send({
			embeds: [
				new DraftBotEmbed()
					.setDescription(fightView.fightTranslationModule.get("actions.aiChoose"))
			]
		}).then((embed) => {
			const fightAction = this.getRandomAvailableFightAction();
			setTimeout(async function() {
				await embed.delete();
				await fightView.fightController.executeFightAction(fightAction, true);
			}, RandomUtils.draftbotRandom.integer(500, 2000));
		});
		return Promise.resolve();
	}

	endFight(): Promise<void> {
		return Promise.resolve();
	}

	getMention(): string {
		return this.name;
	}

	getName(): string {
		return this.name;
	}

	startFight(): Promise<void> {
		return Promise.resolve();
	}

	unblock(): void {
		// Do nothing
	}

	/**
	 * Return a display of the monster in a string format
	 * @param fightTranslationModule
	 */
	public getStringDisplay(fightTranslationModule: TranslationModule): string {
		return fightTranslationModule.format(
			this.status.getTranslationField(),
			{
				pseudo: this.getName()
			}
		) + fightTranslationModule.format("summarize.stats", {
			power: this.getFightPoints(),
			attack: this.getAttack(),
			defense: this.getDefense(),
			speed: this.getSpeed(),
			breath: this.getBreath(),
			maxBreath: this.getMaxBreath(),
			breathRegen: this.getRegenBreath()
		});
	}

	/**
	 * Return the description of the monster
	 */
	getDescription(): string {
		return this.description;
	}

	/**
	 * Return the emoji of the monster
	 */
	getEmoji(): string {
		return this.emoji;
	}
}