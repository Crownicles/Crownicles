import { DataControllerNumber } from "./DataController";
import { Data } from "./Data";
import { LeagueInfoConstants } from "../../../Lib/src/constants/LeagueInfoConstants";
import { GenericItem } from "./GenericItem";
import { generateRandomItem } from "../core/utils/ItemUtils";

export class League extends Data<number> {
	public readonly color!: string;

	public readonly minGloryPoints!: number;

	public readonly maxGloryPoints!: number;


	/**
	 * Get the amount of money to award to the player
	 */
	public getMoneyToAward(): number {
		return LeagueInfoConstants.MONEY_TO_AWARD[this.id];
	}

	/**
	 * Get the amount of xp to award to the player
	 */
	public getXPToAward(): number {
		return LeagueInfoConstants.XP_TO_AWARD[this.id];
	}

	/**
	 * Get the random item a player will get depending on the rarities that are tied to the league id
	 */
	public generateRewardItem(): GenericItem {
		return generateRandomItem({
			minRarity: LeagueInfoConstants.ITEM_MINIMAL_RARITY[this.id],
			maxRarity: LeagueInfoConstants.ITEM_MAXIMAL_RARITY[this.id]
		});
	}
}

export class LeagueDataController extends DataControllerNumber<League> {
	static readonly instance: LeagueDataController = new LeagueDataController("leagues");

	newInstance(): League {
		return new League();
	}

	/**
	 * Get the league by its glory
	 * @param gloryPoints
	 */
	public getByGlory(gloryPoints: number): League {
		return this.getValuesArray()
			.find(league => league.minGloryPoints <= gloryPoints
				&& league.maxGloryPoints >= gloryPoints);
	}
}
