import { AiPlayerFighter } from "./AiPlayerFighter";
import type { KingGuard } from "../kingGuards/KingGuardGenerator";
import { PlayerActiveObjects } from "../../database/game/models/PlayerActiveObjects";

/**
 * AI-controlled fighter generated on the fly when /fight finds no opponent.
 * Its player and pet are never persisted: everything the fight needs is preloaded.
 */
export class KingGuardFighter extends AiPlayerFighter {
	private readonly activeObjects: PlayerActiveObjects;

	public constructor(guard: KingGuard) {
		super(guard.player, guard.guardClass, {
			allowPotionConsumption: false,
			preloadedActiveObjects: guard.activeObjects,
			preloadedPetEntity: guard.pet
		});
		this.activeObjects = guard.activeObjects;
	}

	/**
	 * No glory is at stake against a king guard
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
