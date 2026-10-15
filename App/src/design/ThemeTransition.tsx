import {
	createContext, ReactNode, RefObject, useCallback, useContext, useRef, useState
} from "react";
import {
	Animated, Easing, Image, Platform, StyleSheet, useWindowDimensions, View
} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { captureRef } from "react-native-view-shot";
import { useTheme } from "@/src/design/ThemeContext";
import { ThemePreference } from "@/src/design/ThemePreference";
import { useReducedMotion } from "@/src/store/useReducedMotion";

const THEME_REVEAL = {
	durationMs: 520, startScale: 0.01
} as const;
const SNAPSHOT = {
	format: "jpg", quality: 0.9
} as const;

// Only the alpha of a mask counts: any opaque colour draws the circle.
const styles = StyleSheet.create({
	root: { flex: 1 },
	circle: {
		position: "absolute", backgroundColor: "black"
	}
});

export type ThemeOrigin = {
	x: number; y: number;
};

type ThemeChange = (preference: ThemePreference, origin?: ThemeOrigin) => void;

type Reveal = {
	before: string;
	after?: string;
	origin: ThemeOrigin;
	switchTheme: () => void;
};

const ThemeTransitionContext = createContext<ThemeChange | null>(null);

function nextFrame(): Promise<void> {
	return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function snapshot(root: RefObject<View | null>): Promise<string> {
	return captureRef(root, {
		...SNAPSHOT, result: "tmpfile"
	});
}

/** The circle must reach the farthest corner of the screen from where it starts. */
function coveringRadius(origin: ThemeOrigin, width: number, height: number): number {
	return Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y));
}

type ThemeRequest = {
	origin?: ThemeOrigin;
	unchanged: boolean;
	reducedMotion: boolean;
	revealing: boolean;
};

/** Where the circle starts, or null to switch at once: no finger, nothing to change, motion reduced, the web, or a reveal already running. */
function revealOrigin(request: ThemeRequest): ThemeOrigin | null {
	const instant = request.unchanged || request.reducedMotion || request.revealing || Platform.OS === "web";
	return instant ? null : request.origin ?? null;
}

/** Repaints the screen in the new theme, then pictures it once drawn. */
async function pictureAfter(reveal: Reveal, root: RefObject<View | null>): Promise<string> {
	reveal.switchTheme();
	await nextFrame();
	return snapshot(root);
}

function RevealOverlay({
	reveal, onAfterShown, onDone
}: {
	reveal: Reveal; onAfterShown: () => void; onDone: () => void;
}): ReactNode {
	const {
		width, height
	} = useWindowDimensions();
	const [scale] = useState(() => new Animated.Value(THEME_REVEAL.startScale));
	const radius = coveringRadius(reveal.origin, width, height);
	const grow = (): void => {
		Animated.timing(scale, {
			toValue: 1, duration: THEME_REVEAL.durationMs, easing: Easing.out(Easing.cubic), useNativeDriver: true
		}).start(onDone);
	};
	const circle = <Animated.View style={[
		styles.circle, {
			left: reveal.origin.x - radius, top: reveal.origin.y - radius, width: radius * 2, height: radius * 2, borderRadius: radius, transform: [{ scale }]
		}
	]} />;
	return <View style={StyleSheet.absoluteFill}>
		<Image source={{ uri: reveal.before }} style={StyleSheet.absoluteFill} onLoad={onAfterShown} fadeDuration={0} />
		{reveal.after
			? <MaskedView style={StyleSheet.absoluteFill} maskElement={circle}>
				<Image source={{ uri: reveal.after }} style={StyleSheet.absoluteFill} onLoad={grow} fadeDuration={0} />
			</MaskedView>
			: null}
	</View>;
}

/**
 * A new theme spreads from the finger as a growing circle: the screen is frozen in the old theme,
 * repainted underneath, then the new picture is uncovered over the old one.
 */
export function ThemeTransitionRoot({ children }: { children: ReactNode }): ReactNode {
	const theme = useTheme();
	const reducedMotion = useReducedMotion();
	const root = useRef<View>(null);
	const [reveal, setReveal] = useState<Reveal | null>(null);
	const { setPreference } = theme;

	const change = useCallback<ThemeChange>((preference, origin) => {
		const from = revealOrigin({
			origin, unchanged: preference === theme.preference, reducedMotion, revealing: reveal !== null
		});
		if (!from) {
			setPreference(preference);
			return;
		}
		snapshot(root)
			.then(before => setReveal({
				before, origin: from, switchTheme: () => setPreference(preference)
			}))
			.catch(() => setPreference(preference));
	}, [
		theme.preference,
		reducedMotion,
		reveal,
		setPreference
	]);

	const onBeforeShown = useCallback((): void => {
		if (!reveal || reveal.after) {
			return;
		}
		pictureAfter(reveal, root)
			.then(after => setReveal(current => current && {
				...current, after
			}))
			.catch(() => setReveal(null));
	}, [reveal]);

	return <ThemeTransitionContext.Provider value={change}>
		<View ref={root} collapsable={false} style={styles.root}>{children}</View>
		{reveal ? <RevealOverlay reveal={reveal} onAfterShown={onBeforeShown} onDone={() => setReveal(null)} /> : null}
	</ThemeTransitionContext.Provider>;
}

/** Changes the theme, with the reveal when the app root hosts it and an origin is known. */
export function useThemeChange(): ThemeChange {
	const transition = useContext(ThemeTransitionContext);
	const { setPreference } = useTheme();
	return transition ?? setPreference;
}
