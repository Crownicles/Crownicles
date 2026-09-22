import React from "react";
import {AssetsManager} from "@/src/assets/AssetsManager";

/**
 * Screens outside the protected group are rendered before assets are normally fetched, so they
 * would otherwise show their keys raw. Failing to fetch must not lock the player out: the screen
 * stays usable, only its wording suffers.
 */
export function useTranslationsReady(): boolean {
	const [ready, setReady] = React.useState(AssetsManager.areAssetsReady());

	React.useEffect((): void => {
		if (ready) {
			return;
		}

		AssetsManager.updateAssets()
			.then((): void => {
				setReady(true);
			})
			.catch((error: unknown) => {
				console.error("Failed to update assets outside the protected group:", error);
			});
	}, [ready]);

	return ready;
}
