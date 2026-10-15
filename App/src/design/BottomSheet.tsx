import {
	createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState
} from "react";
import {
	Animated, GestureResponderEvent, KeyboardAvoidingView, PanResponder, PanResponderGestureState, PanResponderInstance, Platform,
	Pressable, ScrollView, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeWindow } from "@/src/design/NativeWindow";
import { useSuspendSwipeBack } from "@/src/design/SwipeBack";
import { Theme } from "@/src/design/Theme";
import { createStyles } from "@/src/design/ThemeContext";
import { useReducedMotion } from "@/src/store/useReducedMotion";
import { i18n } from "@/src/translations/i18n";

const useStyles = createStyles(colors => ({
	backdrop: {
		flex: 1, justifyContent: "flex-end"
	},
	veil: {
		...StyleSheet.absoluteFill, backgroundColor: colors.overlay
	},
	card: {
		backgroundColor: colors.paper, borderTopLeftRadius: Theme.radius * 2, borderTopRightRadius: Theme.radius * 2, paddingHorizontal: Theme.spacing.xl, paddingTop: Theme.spacing.md, gap: Theme.spacing.lg, maxHeight: "85%"
	},
	grabber: {
		alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line
	},
	body: {
		gap: Theme.spacing.md, paddingHorizontal: Theme.spacing.xl
	},
	handle: {
		gap: Theme.spacing.lg, minHeight: Theme.dimensions.compactRowMinHeight
	},

	// Spans the card's margins so the scroll indicator runs in them, not over right-aligned values.
	scroll: {
		flexGrow: 0, marginHorizontal: -Theme.spacing.xl
	}
}));

/** Settles quickly with a hint of bounce, like a sheet dropped on a table. */
const SHEET_SPRING = {
	damping: 22, stiffness: 220, mass: 0.9, useNativeDriver: true
} as const;
const SHEET_DISMISS = {
	distance: 90, velocity: 0.8, slop: 10, verticalRatio: 2, pull: 70
} as const;
const SHEET_LEAVE = { returnAfterMs: 1_500 } as const;

/** Stiff and clamped: the sheet keeps the finger's momentum and leaves without bouncing at the bottom. */
const SHEET_LEAVE_SPRING = {
	stiffness: 260, damping: 30, mass: 1, overshootClamping: true, useNativeDriver: true
} as const;
const MILLISECONDS_PER_SECOND = 1_000;
const SHEET_SCROLL_THROTTLE_MS = 16;

type SheetDrag = Pick<PanResponderGestureState, "dx" | "dy" | "numberActiveTouches">;

export function sheetDragStarts(gesture: SheetDrag, scrollOffset = 0): boolean {
	return gesture.numberActiveTouches === 1 && scrollOffset <= 0 && gesture.dy > SHEET_DISMISS.slop && gesture.dy > Math.abs(gesture.dx) * SHEET_DISMISS.verticalRatio;
}

class SheetGestureState {
	private scrollOffset = 0;

	private nestedScrollOffset = 0;

	private scrollAtTouchStart = 0;

	private interrupted = false;

	public updateScroll(offset: number): void { this.scrollOffset = offset; }

	public updateNestedScroll(offset: number): void { this.nestedScrollOffset = offset; }

	public beginTouch(): void { this.scrollAtTouchStart = Math.max(this.scrollOffset, this.nestedScrollOffset); }

	public starts(gesture: SheetDrag): boolean { return sheetDragStarts(gesture, this.scrollAtTouchStart); }

	public beginDrag(): void { this.interrupted = false; }

	public acceptsMove(touches: number): boolean {
		if (touches > 1) {
			this.interrupted = true;
		}
		return !this.interrupted;
	}


	// A drag that ends up sideways is a swipe across the content, never a request to close.
	public closes(gesture: Pick<PanResponderGestureState, "dx" | "dy" | "vy">): boolean {
		return !this.interrupted && gesture.dy > Math.abs(gesture.dx) && (gesture.dy > SHEET_DISMISS.distance || gesture.vy > SHEET_DISMISS.velocity);
	}
}

/**
 * Closing slides the sheet down before its owner removes it. A sheet its owner keeps open (a question
 * that must be answered) comes back up rather than linger off screen, swallowing every touch.
 */
function useSheetLeave(offset: Animated.Value, height: number, onClose: () => void): (velocity?: number) => void {
	const reducedMotion = useReducedMotion();
	const leaving = useRef(false);
	const close = useRef(onClose);
	const comeBack = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mounted = useRef(true);
	useEffect(() => {
		close.current = onClose;
	}, [onClose]);
	useEffect(() => {
		mounted.current = true;
		return (): void => {
			mounted.current = false;
			if (comeBack.current) {
				clearTimeout(comeBack.current);
			}
		};
	}, []);
	return useCallback((velocity = 0): void => {
		if (leaving.current) {
			return;
		}
		leaving.current = true;
		const closed = (): void => {
			if (!mounted.current) {
				return;
			}
			close.current();
			comeBack.current = setTimeout(() => {
				leaving.current = false;
				Animated.spring(offset, {
					toValue: 0, ...SHEET_SPRING
				}).start();
			}, SHEET_LEAVE.returnAfterMs);
		};
		if (reducedMotion) {
			closed();
			return;
		}

		// The gesture measures pixels per millisecond, the spring pixels per second.
		Animated.spring(offset, {
			toValue: height, velocity: velocity * MILLISECONDS_PER_SECOND, ...SHEET_LEAVE_SPRING
		}).start(closed);
	}, [
		height,
		offset,
		reducedMotion
	]);
}

function settle(offset: Animated.Value): void {
	Animated.spring(offset, {
		toValue: 0, ...SHEET_SPRING
	}).start();
}

/** The header always answers a downward drag; the content only once it is scrolled back to its top. */
function useSheetDrag(offset: Animated.Value, gestureState: SheetGestureState, leave: (velocity?: number) => void): {
	headerDrag: PanResponderInstance; contentDrag: PanResponderInstance;
} {
	const dragHandlers = useMemo(() => ({
		onPanResponderGrant: (): void => {
			gestureState.beginDrag();
			offset.stopAnimation();
		},
		onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
			if (!gestureState.acceptsMove(gesture.numberActiveTouches)) {
				settle(offset);
				return;
			}
			offset.setValue(Math.max(0, gesture.dy));
		},
		onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
			if (gestureState.closes(gesture)) {
				leave(gesture.vy);
				return;
			}

			// A sheet that cannot be dismissed yet settles back instead of staying where the finger left it.
			settle(offset);
		},
		onPanResponderTerminate: (): void => settle(offset)
	}), [
		gestureState,
		offset,
		leave
	]);
	const headerDrag = useMemo(() => PanResponder.create({
		// The native window claims every touch nobody inside takes at its start, and its descendants are then never asked again: the header takes it first.
		onStartShouldSetPanResponder: (): boolean => true,
		onMoveShouldSetPanResponderCapture: (_event, gesture): boolean => sheetDragStarts(gesture),
		...dragHandlers
	}), [dragHandlers]);
	const contentDrag = useMemo(() => PanResponder.create({
		onStartShouldSetPanResponderCapture: (): boolean => {
			gestureState.beginTouch();
			return false;
		},
		onMoveShouldSetPanResponderCapture: (_event, gesture): boolean => gestureState.starts(gesture),
		...dragHandlers
	}), [dragHandlers, gestureState]);
	return {
		headerDrag, contentDrag
	};
}

/** Where a scroller nested in a sheet reports how far down it is, so the sheet knows when a downward drag is a scroll. */
const SheetScrollContext = createContext<(offset: number) => void>(() => undefined);

/** The sheet's content, scrolled on its own; iOS hands it the pull, and released far enough past the top it takes the sheet away. */
function SheetContent({
	gestureState, leave, children
}: {
	gestureState: SheetGestureState; leave: () => void; children: ReactNode;
}): ReactNode {
	const styles = useStyles();
	const reportNestedScroll = useCallback((offset: number): void => gestureState.updateNestedScroll(offset), [gestureState]);
	return <ScrollView
		style={styles.scroll}
		contentContainerStyle={styles.body}
		keyboardShouldPersistTaps="handled"
		onScroll={event => gestureState.updateScroll(event.nativeEvent.contentOffset.y)}
		alwaysBounceVertical
		onScrollEndDrag={event => {
			if (event.nativeEvent.contentOffset.y < -SHEET_DISMISS.pull) {
				leave();
			}
		}}
		scrollEventThrottle={SHEET_SCROLL_THROTTLE_MS}
	><SheetScrollContext.Provider value={reportNestedScroll}>{children}</SheetScrollContext.Provider></ScrollView>;
}

function SheetHandle({
	drag, heading
}: {
	drag: PanResponderInstance; heading: ReactNode;
}): ReactNode {
	const styles = useStyles();
	return <View {...drag.panHandlers} style={styles.handle} testID="bottom-sheet-handle">
		<View style={styles.grabber} />
		{heading}
	</View>;
}

/** Rises once mounted, then calls `onShown` when it has settled. */
function useSheetRise(offset: Animated.Value, onShown: (() => void) | undefined): void {
	const shown = useRef(onShown);
	useEffect(() => {
		shown.current = onShown;
	}, [onShown]);
	useEffect(() => {
		Animated.spring(offset, {
			toValue: 0, ...SHEET_SPRING
		}).start(({ finished }) => {
			if (finished) {
				shown.current?.();
			}
		});
	}, [offset]);
}

/**
 * Everything that rises from the bottom: the detail of a line, a quick question, a short result.
 * A tap above it or a downward drag of its header or unscrolled content puts it away.
 */
export function BottomSheet({
	onClose, onShown, onDismissed, visible = true, heading, children, testID
}: {
	onClose: () => void;

	/** Once the sheet has settled, for an animation that should not play while it is still rising. */
	onShown?: () => void;

	/** Once iOS has fully put the sheet away, after `visible` turned false. */
	onDismissed?: () => void;
	visible?: boolean;
	heading?: ReactNode;
	children: ReactNode;
	testID?: string;
}): ReactNode {
	const styles = useStyles();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const [offset] = useState(() => new Animated.Value(height));
	const [gestureState] = useState(() => new SheetGestureState());
	const leave = useSheetLeave(offset, height, onClose);
	useSuspendSwipeBack(visible);
	useSheetRise(offset, onShown);
	const {
		headerDrag, contentDrag
	} = useSheetDrag(offset, gestureState, leave);

	// The veil lightens as the sheet goes down, so a drag or a close reads as one movement.
	const veilOpacity = offset.interpolate({
		inputRange: [0, height], outputRange: [1, 0], extrapolate: "clamp"
	});
	return <NativeWindow visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={(): void => leave()} {...onDismissed ? { onDismiss: onDismissed } : {}}>
		<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
			<Animated.View pointerEvents="none" style={[styles.veil, { opacity: veilOpacity }]} />
			<Pressable accessibilityRole="button" accessibilityLabel={i18n.t("app:common.back")} style={StyleSheet.absoluteFill} onPress={(): void => leave()} testID="detail-sheet-backdrop" />
			<Animated.View {...contentDrag.panHandlers} style={[
				styles.card, {
					paddingBottom: insets.bottom + Theme.spacing.xl, transform: [{ translateY: offset }]
				}
			]} testID={testID}>
				<SheetHandle drag={headerDrag} heading={heading} />
				<SheetContent gestureState={gestureState} leave={leave}>{children}</SheetContent>
			</Animated.View>
		</KeyboardAvoidingView>
	</NativeWindow>;
}

/**
 * A scroller of its own inside a sheet, for a long list kept to part of the screen. Dragging down its
 * scrolled content reads it back instead of taking the sheet away. Started at the end, it opens on the latest lines.
 */
export function SheetScrollView({
	style, startAtEnd = false, children, testID
}: {
	style?: StyleProp<ViewStyle>;
	startAtEnd?: boolean;
	children: ReactNode;
	testID?: string;
}): ReactNode {
	const report = useContext(SheetScrollContext);
	const scroll = useRef<ScrollView>(null);
	const size = useRef({
		viewport: 0, content: 0, positioned: false, endPending: false
	});

	// Not every platform reports the jump to the end as a scroll: the offset it lands on is reported here.
	const reportEnd = (): void => {
		const {
			viewport, content, endPending
		} = size.current;
		if (!endPending || viewport <= 0) {
			return;
		}
		size.current.endPending = false;
		report(Math.max(0, content - viewport));
	};
	return <ScrollView
		ref={scroll}
		style={style}
		scrollEventThrottle={SHEET_SCROLL_THROTTLE_MS}
		onScroll={(event): void => report(event.nativeEvent.contentOffset.y)}
		onLayout={(event): void => {
			size.current.viewport = event.nativeEvent.layout.height;
			reportEnd();
		}}
		onContentSizeChange={(_width, height): void => {
			size.current.content = height;
			if (!startAtEnd || size.current.positioned) {
				return;
			}
			size.current.positioned = true;
			size.current.endPending = true;
			scroll.current?.scrollToEnd({ animated: false });
			reportEnd();
		}}
		{...testID ? { testID } : {}}
	>{children}</ScrollView>;
}
