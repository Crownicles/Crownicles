import React, {PropsWithChildren, useEffect, useState} from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {AssetsManager} from "@/src/assets/AssetsManager";
import {Button} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {applyServerBundle} from "@/src/translations/i18nLoader";
import {i18n} from "@/src/translations/i18n";

type BootState = "loading" | "ready" | "error";

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Theme.colors.wash,
		padding: Theme.spacing.xl,
		gap: Theme.spacing.md
	},
	text: {
		fontFamily: Theme.fonts.regular,
		color: Theme.colors.ink,
		textAlign: "center"
	}
});

export function BootGate({children}: PropsWithChildren): React.ReactElement {
	const [state, setState] = useState<BootState>("loading");
	const [retryCount, setRetryCount] = useState(0);

	useEffect((): (() => void) => {
		let active = true;
		const initialize = async (): Promise<void> => {
			try {
				const cached = await AssetsManager.loadCachedBundle("fr");
				if (cached) {
					applyServerBundle(cached.bundle);
					if (active) {
						setState("ready");
					}
					AssetsManager.syncBundle("fr", cached)
						.then(bundle => {
							if (active) {
								applyServerBundle(bundle.bundle);
							}
						})
						.catch(error => console.warn("Failed to revalidate cached translation bundle:", error));
					return;
				}

				const bundle = await AssetsManager.syncBundle("fr", null);
				if (active) {
					applyServerBundle(bundle.bundle);
					setState("ready");
				}
			}
			catch (error) {
				console.error("Failed to load translation bundle:", error);
				if (active) {
					setState("error");
				}
			}
		};
		initialize().catch(error => console.error("Unexpected translation startup failure:", error));
		return (): void => {
			active = false;
		};
	}, [retryCount]);

	const retry = (): void => {
		setState("loading");
		setRetryCount(count => count + 1);
	};

	if (state === "ready") {
		return <>{children}</>;
	}

	return <View style={styles.container}>
		{state === "error" ? <>
			<Text style={styles.text}>{i18n.t("app:boot.error")}</Text>
			<Button variant="primary" onPress={retry}>{i18n.t("app:boot.retry")}</Button>
		</> : <>
			<ActivityIndicator size="large" color={Theme.colors.ink} />
			<Text style={styles.text}>{i18n.t("app:boot.updating")}</Text>
		</>}
	</View>;
}