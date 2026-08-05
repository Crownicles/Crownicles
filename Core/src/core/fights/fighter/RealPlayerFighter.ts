import { InventorySlots } from "../../database/game/models/InventorySlot";
import { BlockingUtils } from "../../utils/BlockingUtils";
import { BlockingConstants } from "../../../../../Lib/src/constants/BlockingConstants";
import { FightView } from "../FightView";
import { MissionsController } from "../../missions/MissionsController";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { FighterStatus } from "../FighterStatus";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerFighter } from "./PlayerFighter";
import { Class } from "../../../data/Class";
import Player from "../../database/game/models/Player";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

/**
 * Fighter
 * Class representing a real player in a fight
 */
export class RealPlayerFighter extends PlayerFighter {
	public consumePotionProbability = FightConstants.POTION_NO_DRINK_PROBABILITY.PLAYER;

	public constructor(player: Player, playerClass: Class) {
		super(player, playerClass);
	}

	/**
	 * Function called when the fight starts
	 * @param fightView The fight view
	 * @param startStatus The first status of a player
	 * @param response The response packets
	 */
	async startFight(fightView: FightView, startStatus: FighterStatus, response: CrowniclesPacket[]): Promise<void> {
		await super.startFight(fightView, startStatus, response);
		this.block();
	}

	/**
	 * Function called when the fight ends
	 * @param winner Indicate if the fighter is the winner
	 * @param response
	 * @param bug Indicate if the fight is bugged
	 * @param turnCount The number of turns of the fight
	 */
	async endFight(winner: boolean, response: CrowniclesPacket[], bug: boolean, turnCount: number): Promise<void> {
		await this.player.reload();
		this.player.setEnergyLost(this.stats.maxEnergy! - this.stats.energy!, NumberChangeReason.FIGHT, await InventorySlots.getPlayerActiveObjects(this.player.id));
		await this.player.save();

		if (bug) {
			return;
		}

		await this.manageMissionsOf(response);

		if (this.hasPetAssisted()) {
			await MissionsController.update(this.player, response, {
				missionId: "petAssistedFight"
			});
		}

		if (winner) {
			await MissionsController.update(this.player, response, {
				missionId: "fightHealthPercent",
				params: {
					remainingPercent: this.stats.energy! / this.stats.maxEnergy!
				}
			});
			await MissionsController.update(this.player, response, {
				missionId: "finishWithAttack",
				params: {
					lastAttack: this.fightActionsHistory.at(-1)
				}
			});
			await MissionsController.update(this.player, response, {
				missionId: "fightMinTurns",
				params: { turnCount }
			});
		}
	}

	/**
	 * Allow a fighter to unblock itself
	 */
	unblock(): void {
		BlockingUtils.unblockPlayer(this.player.keycloakId, BlockingConstants.REASONS.FIGHT);
	}

	/**
	 * Allow a fighter to block itself
	 */
	public block(): void {
		BlockingUtils.blockPlayer(this.player.keycloakId, BlockingConstants.REASONS.FIGHT);
	}
}
