import React, {PropsWithChildren, useEffect, useState} from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {AssetsManager} from "@/src/assets/AssetsManager";
import {Button} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {applyServerBundle} from "@/src/translations/i18nLoader";
import {i18n} from "@/src/translations/i18n";
import {RestApi} from "@/src/networking/RestApi";
import {APP_COMPATIBILITY_STATUSES} from "../../../WsPackets/src/AppCompatibility";

type OutdatedState = typeof APP_COMPATIBILITY_STATUSES.APP_OUTDATED | typeof APP_COMPATIBILITY_STATUSES.SERVER_OUTDATED;
type BootState = "loading" | "ready" | "error" | OutdatedState;

/** Only a server being updated can be waited out; an outdated app needs the store. */
const OUTDATED_NOTICES: Record<OutdatedState, {message: string; canRetry: boolean}> = {
	[APP_COMPATIBILITY_STATUSES.APP_OUTDATED]: {message: "app:boot.appOutdated", canRetry: false},
	[APP_COMPATIBILITY_STATUSES.SERVER_OUTDATED]: {message: "app:boot.serverOutdated", canRetry: true}
};

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

export function BootGate({children}: PropsWithChildren): React.ReactNode {
	const [state, setState] = useState<BootState>("loading");
	const [retryCount, setRetryCount] = useState(0);

	useEffect((): (() => void) => {
		let active = true;
		// A version mismatch outranks whatever the translations end up doing.
		const settle = (next: "ready" | "error"): void => {
			if (active) {
				setState(previous => previous in OUTDATED_NOTICES ? previous : next);
			}
		};
		const initialize = async (): Promise<void> => {
			try {
				const cached = await AssetsManager.loadCachedBundle("fr");
				if (cached) {
					applyServerBundle(cached.bundle);
					settle("ready");
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
				}
				settle("ready");
			}
			catch (error) {
				console.error("Failed to load translation bundle:", error);
				settle("error");
			}
		};
		initialize().catch(error => console.error("Unexpected translation startup failure:", error));
		// Checked alongside the translations so a cached start is not delayed; a mismatch overrides it.
		RestApi.getCompatibility().then(compatibility => {
			if (active && compatibility && compatibility !== APP_COMPATIBILITY_STATUSES.UP_TO_DATE) {
				setState(compatibility);
			}
		}).catch(error => console.warn("Unexpected compatibility check failure:", error));
		return (): void => {
			active = false;
		};
	}, [retryCount]);

	const retry = (): void => {
		setState("loading");
		setRetryCount(count => count + 1);
	};

	if (state === "ready") {
		return children;
	}

	if (state === APP_COMPATIBILITY_STATUSES.APP_OUTDATED || state === APP_COMPATIBILITY_STATUSES.SERVER_OUTDATED) {
		const notice = OUTDATED_NOTICES[state];
		return <View style={styles.container} testID="boot-outdated">
			<Text style={styles.text}>{i18n.t(notice.message)}</Text>
			{notice.canRetry ? <Button variant="primary" onPress={retry}>{i18n.t("app:boot.retry")}</Button> : null}
		</View>;
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