import {
	ReactNode, useEffect, useSyncExternalStore
} from "react";
import {
	Share as NativeShare, View
} from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	describeFatalError, FatalErrorRecord, fatalErrorStore
} from "@/src/store/FatalErrorStore";
import {
	Button, ButtonRow, Note, Screen, SectionHeader
} from "@/src/design/Primitives";
import {
	ActionBanner, Standing
} from "@/src/design/Sections";
import {
	CircleAlert, RotateCcw, Share
} from "@/src/design/FightIcons";
import { Theme } from "@/src/design/Theme";
import {
	createStyles, useColors
} from "@/src/design/ThemeContext";
import { i18n } from "@/src/translations/i18n";

const useStyles = createStyles(colors => ({
	page: {
		flex: 1, backgroundColor: colors.wash
	}
}));

/** The report as whoever investigates it needs it: the build and the phone, then what the error said and where. */
export function fatalErrorReport(record: FatalErrorRecord): string {
	return i18n.t("app:crash.reportText", {
		version: record.appBuild
			? i18n.t("app:settings.appVersionValue", {
				version: record.appVersion, build: record.appBuild
			})
			: record.appVersion,
		platform: record.platform,
		date: new Date(record.occurredAt).toISOString(),
		message: record.message,
		stack: record.stack,
		componentStack: record.componentStack ?? ""
	});
}

/** Through the phone's share sheet, which also offers to copy it. */
export function shareFatalError(record: FatalErrorRecord): void {
	NativeShare.share({ message: fatalErrorReport(record) }).catch((error: unknown): void => {
		console.warn("Unable to share the fatal error report:", error);
	});
}

/** Rethrows, while drawing, an error raised outside of any screen, so the error boundary shows it like the others. */
export function FatalErrorRelay(): null {
	const raised = useSyncExternalStore(fatalErrorStore.subscribeRaised, fatalErrorStore.getRaised, fatalErrorStore.getRaised);
	if (raised) {
		throw raised;
	}
	return null;
}

/**
 * Drawn in place of the whole app once an error broke it: the app stays open, the report stays on the phone to be
 * shared, and starting again remounts every screen.
 */
export function FatalErrorScreen({
	error, retry
}: ErrorBoundaryProps): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const insets = useSafeAreaInsets();
	useEffect(() => fatalErrorStore.record(error), [error]);

	// Another error while this screen is up must not close the app it kept open: it is kept, and the screen stays.
	useEffect(() => fatalErrorStore.subscribeRaised((): void => undefined), []);
	const restart = (): void => {
		fatalErrorStore.dismissRaised();
		retry().catch((retryError: unknown): void => {
			console.error("Unable to start the app again after a fatal error:", retryError);
		});
	};
	const share = (): void => {
		const record = fatalErrorStore.getLast();
		if (record) {
			shareFatalError(record);
		}
	};
	return <View style={[styles.page, { paddingTop: insets.top }]}>
		<Screen>
			<Standing
				emblem={<CircleAlert size={Theme.dimensions.headerIcon} color={colors.red} />}
				caption={i18n.t("app:crash.eyebrow")}
				title={i18n.t("app:crash.title")}
				subtitle={i18n.t("app:crash.description")}
			/>
			<ActionBanner icon={RotateCcw} label={i18n.t("app:crash.restart")} onPress={restart} />
			<SectionHeader>{i18n.t("app:crash.report")}</SectionHeader>
			<Note>{describeFatalError(error).message}</Note>
			<ButtonRow><Button icon={Share} onPress={share}>{i18n.t("app:crash.share")}</Button></ButtonRow>
		</Screen>
	</View>;
}
