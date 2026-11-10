import { AiPlayerFighter } from "./AiPlayerFighter";
import type { KingGuard } from "../kingGuards/KingGuardLibrary";
import { PlayerActiveObjects } from "../../database/game/models/PlayerActiveObjects";
import { createKingGuardBehavior } from "../kingGuards/neural/KingGuardNeuralAi";
import { KingGuardData } from "../../../data/KingGuard";

/**
 * AI-controlled fighter drawn from the library of the king guards when /fight finds no opponent.
 * Its player and pet are never persisted: everything the fight needs is preloaded.
 */
export class KingGuardFighter extends AiPlayerFighter {
	public readonly guardData: KingGuardData;

	// Level of the player when the guard was chosen
	public readonly playerLevel: number;

	private readonly activeObjects: PlayerActiveObjects;

	public constructor(guard: KingGuard) {
		super(guard.player, guard.guardClass, {
			allowPotionConsumption: false,
			preloadedActiveObjects: guard.activeObjects,
			preloadedPetEntity: guard.pet,
			classBehavior: createKingGuardBehavior(guard.guardClass.id)
		});
		this.guardData = guard.data;
		this.activeObjects = guard.activeObjects;
		this.playerLevel = guard.playerLevel;
	}

	/**
	 * No glory is at stake against a king guard, and its rating stays hidden
	 */
	public override getDisplayedGloryPoints(): number | undefined {
		return undefined;
	}

	public override getMainActiveObjects(): Promise<PlayerActiveObjects> {
		return Promise.resolve(this.activeObjects);
	}

	protected override countItemsWithTag(tag: string): Promise<number> {
		const equippedItems = [
			this.activeObjects.weapon.item,
			this.activeObjects.armor.item,
			this.activeObjects.potion.item,
			this.activeObjects.object.item
		];
		return Promise.resolve(equippedItems.filter(item => item.tags?.includes(tag)).length);
	}
}
