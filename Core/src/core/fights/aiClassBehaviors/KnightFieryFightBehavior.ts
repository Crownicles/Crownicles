import { RestingKnightFightBehavior } from "./RestingKnightFightBehavior";

/**
 * Fiery knight: casts the benediction as soon as possible against everyone and only rests when badly hurt
 */
class KnightFieryFightBehavior extends RestingKnightFightBehavior {
	protected readonly restEnergyRatio = 0.75;

	protected shouldBless(): boolean {
		return true;
	}
}

export default KnightFieryFightBehavior;
