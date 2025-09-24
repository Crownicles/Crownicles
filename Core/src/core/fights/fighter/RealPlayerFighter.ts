import { InventorySlots } from "../../database/game/models/InventorySlot";
import { BlockingUtils } from "../../utils/BlockingUtils";
import { BlockingConstants } from "../../../../../Lib/src/constants/BlockingConstants";
import { FightView } from "../FightView";
import { MissionsController } from "../../missions/MissionsController";
import { MissionSlots } from "../../database/game/models/MissionSlot";
import { getDayNumber } from "../../../../../Lib/src/utils/TimeUtils";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { FighterStatus } from "../FighterStatus";
import { Maps } from "../../maps/Maps";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { PVEConstants } from "../../../../../Lib/src/constants/PVEConstants";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerFighter } from "./PlayerFighter";
import { Class } from "../../../data/Class";
import Player from "../../database/game/models/Player";

/**
 * Fighter
 * Class representing a real player in a fight
 */
export class RealPlayerFighter extends PlayerFighter {
	private pveMembers: {
		attack: number; speed: number;
	}[];

	private petAssisted: boolean;

	public constructor(player: Player, playerClass: Class) {
		super(player, playerClass);
		this.petAssisted = false;
	}

	/**
	 * Mark that the pet has assisted during the fight
	 */
	public markPetAssisted(): void {
		this.petAssisted = true;
	}

	/**
	 * Function called when the fight starts
	 * @param fightView The fight view
	 * @param startStatus The first status of a player
	 */
	async startFight(fightView: FightView, startStatus: FighterStatus): Promise<void> {
		await super.startFight(fightView, startStatus);
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
		this.player.setEnergyLost(this.stats.maxEnergy - this.stats.energy, NumberChangeReason.FIGHT, await InventorySlots.getPlayerActiveObjects(this.player.id));
		await this.player.save();

		if (bug) {
			return;
		}

		await this.manageMissionsOf(response);

		if (this.petAssisted) {
			await MissionsController.update(this.player, response, {
				missionId: "petAssistedFight"
			});
		}

		if (winner) {
			await MissionsController.update(this.player, response, {
				missionId: "fightHealthPercent",
				params: {
					remainingPercent: this.stats.energy / this.stats.maxEnergy
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
				params: {
					turnCount
				}
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

	/**
	 * Send the embed to choose an action
	 * @param fightView
	 * @param response
	 */
	async chooseAction(fightView: FightView, response: CrowniclesPacket[]): Promise<void> {
		const actions: Map<string, FightAction> = new Map(this.availableFightActions);

		// Add guild attack if on PVE island and members are here
		if (Maps.isOnPveIsland(this.player)) {
			if (!this.pveMembers) {
				const members = await Maps.getGuildMembersOnPveIsland(this.player);
				this.pveMembers = [];
				for (const member of members) {
					const memberActiveObjects = await InventorySlots.getMainSlotsItems(member.id);
					this.pveMembers.push({
						attack: member.getCumulativeAttack(memberActiveObjects),
						speed: member.getCumulativeSpeed(memberActiveObjects)
					});
				}
			}

			if (this.pveMembers.length !== 0 && RandomUtils.crowniclesRandom.realZeroToOneInclusive() < PVEConstants.GUILD_ATTACK_PROBABILITY) {
				actions.set("guildAttack", FightActionDataController.instance.getById("guildAttack"));
			}
		}
		fightView.displayFightActionMenu(response, this, actions);
	}

	/**
	 * Get the members of the player's guild on the island of the fighter
	 */
	public getPveMembersOnIsland(): {
		attack: number; speed: number;
	}[] {
		return this.pveMembers;
	}

	/**
	 * Check the fight action history of a fighter
	 * @param response
	 */
	private async checkFightActionHistory(response: CrowniclesPacket[]): Promise<void> {
		const playerFightActionsHistory: Map<string, number> = this.getFightActionCount();

		// Iterate on each action in the history
		for (const [action, count] of playerFightActionsHistory) {
			await MissionsController.update(this.player, response, {
				missionId: "fightAttacks",
				count,
				params: { attackType: action }
			});
		}
	}

	/**
	 * Manage the mission of a fighter
	 * @param response
	 */
	private async manageMissionsOf(response: CrowniclesPacket[]): Promise<void> {
		await this.checkFightActionHistory(response);

		await MissionsController.update(this.player, response, { missionId: "anyFight" });

		const slots = await MissionSlots.getOfPlayer(this.player.id);
		for (const slot of slots) {
			if (slot.missionId === "fightStreak") {
				const lastDay = slot.saveBlob ? slot.saveBlob.readInt32LE() : 0;
				const currDay = getDayNumber();
				if (lastDay === currDay - 1) {
					await MissionsController.update(this.player, response, { missionId: "fightStreak" });
				}
				else if (lastDay !== currDay) {
					await MissionsController.update(this.player, response, {
						missionId: "fightStreak",
						count: 1,
						set: true
					});
				}
			}
		}
	}
}
