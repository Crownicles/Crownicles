/**
 * Reference to a specific apartment location surfaced in user-facing packets.
 * Combines the canonical city id (used by the backend) with the representative
 * map location id (used by the frontend to display the city's localized name).
 */
export interface ApartmentLocationRef {
	cityId: string;

	/** Representative map location ID for displaying the city's user-facing name */
	mapLocationId: number;
}

/**
 * Summary of one apartment owned by the player, surfaced in the city
 * reaction collector data.
 */
export interface OwnedApartmentSummary extends ApartmentLocationRef {
	apartmentId: number;

	purchasePrice: number;

	accumulatedRent: number;

	/** True if this apartment is currently rented out (player's main home is in this apartment's city) */
	isRented: boolean;
}
