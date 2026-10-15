import {
	ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState
} from "react";
import {
	Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View
} from "react-native";
import { Image } from "expo-image";
import { NotificationFeedbackType } from "expo-haptics";
import { Haptics } from "@/src/design/Haptics";
import {
	isAvailableAsync, shareAsync
} from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import Svg, {
	Defs, LinearGradient, Path, RadialGradient, Rect, Stop
} from "react-native-svg";
import crowniclesCrown from "@/assets/images/adaptive-icon.png";
import { AppConstants } from "@/src/AppConstants";
import { AppIcons } from "@/src/AppIcons";
import { itemDisplayName } from "@/src/collectors/CollectorLabels";
import { usePlayerPseudo } from "@/src/collectors/EventOutcomeScreen";
import { VISIBLE_BADGES } from "@/src/components/CharacterReference";
import {
	inventoryItemDetails, itemEmoji
} from "@/src/components/InventoryItemRow";
import { useAnnouncementTurn } from "@/src/components/useToastTurn";
import { NativeWindow } from "@/src/design/NativeWindow";
import { ActionBanner } from "@/src/design/Sections";
import { Share } from "@/src/design/FightIcons";
import {
	BOSS_MOMENT_PALETTES, BRAND_COLORS, MOMENT_PALETTES, MomentPalette, Theme
} from "@/src/design/Theme";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { TwemojiText } from "@/src/design/TwemojiText";
import { useFight } from "@/src/store/FightStore";
import {
	MEMORABLE_MOMENT_KINDS, MemorableMoment, memorableMomentStore, useMemorableMoment
} from "@/src/store/MemorableMomentStore";
import { usePlayerProfile } from "@/src/store/usePlayerProfile";
import { useReducedMotion } from "@/src/store/useReducedMotion";
import {
	AppStateChange, useAppState, useAppStateChange
} from "@/src/store/AppState";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";
import { useQueryClient } from "@tanstack/react-query";
import type { Badge } from "ws-packets/src/objects/Badge";
import { i18n } from "@/src/translations/i18n";

/** The card is a 4:5 portrait, the shape social feeds crop the least. */
const MOMENT_CARD = {
	maxWidth: 340,
	aspectRatio: 0.8,
	radius: 24,
	frameInset: 10,
	frameOpacity: 0.45,

	/** The crown fills half of its transparent square: drawn larger, then pulled in. */
	logo: 48,
	logoInset: -10,
	emblem: 112,
	emblemEmoji: 68,
	rays: 300,
	rayCount: 16,
	titleSize: 26,
	titleLineHeight: 31,
	recordSize: 34,
	eyebrowSpacing: 2,
	wordmarkSpacing: 3
} as const;

const MOMENT_MOTION = {
	appearMs: 260, fromScale: 0.9, overshoot: 1.4
} as const;

const SHARED_IMAGE = {
	format: "png", mimeType: "image/png", uti: "public.png"
} as const;

/** How strongly the halo shines, from the emblem outwards. */
const GLOW_STOPS = [
	{
		offset: 0, opacity: 0.55
	},
	{
		offset: 0.6, opacity: 0.12
	},
	{
		offset: 1, opacity: 0
	}
] as const;

/** What the card says, whatever the moment it celebrates. */
export type MomentCardContent = {
	eyebrow: string;
	emoji: string;
	title: string;
	subtitle: string;
	palette: MomentPalette;
	record?: {
		level: number; caption: string;
	};
};

export function momentContent(moment: MemorableMoment): MomentCardContent {
	const eyebrow = i18n.t(`app:moments.eyebrows.${moment.kind}`);
	switch (moment.kind) {
		case MEMORABLE_MOMENT_KINDS.BADGE:
			return {
				eyebrow,
				emoji: AppIcons.getIcon(`badges.${moment.badge}`),
				title: i18n.t(`app:reference.badges.names.${moment.badge}`),
				subtitle: i18n.t("app:moments.badgeProgress", {
					owned: moment.owned, total: moment.total
				}),
				palette: MOMENT_PALETTES.brand
			};
		case MEMORABLE_MOMENT_KINDS.MYTHIC_ITEM:
			return {
				eyebrow,
				emoji: itemEmoji(moment.item) ?? AppIcons.getIcon(`rarity.${moment.item.rarity}`),
				title: itemDisplayName(moment.item),
				subtitle: inventoryItemDetails(moment.item),
				palette: MOMENT_PALETTES.mythicItem
			};
		default: {
			const {
				monsterId, monsterLevel, classId, previousLevel
			} = moment.record;
			return {
				eyebrow,
				emoji: AppIcons.getIcon(`monsters.${monsterId}`),
				title: i18n.t(`models:monsters.${monsterId}.name`),
				subtitle: i18n.t("models:classFormat", { id: classId }),
				palette: BOSS_MOMENT_PALETTES[monsterId] ?? MOMENT_PALETTES.brand,
				record: {
					level: monsterLevel,
					caption: previousLevel === undefined ? i18n.t("app:moments.firstWin") : i18n.t("app:moments.previousRecord", { level: previousLevel })
				}
			};
		}
	}
}

function momentDate(at: number): string {
	return new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(at);
}

const cardStyles = StyleSheet.create({
	card: {
		aspectRatio: MOMENT_CARD.aspectRatio, borderRadius: MOMENT_CARD.radius, overflow: "hidden"
	},
	frame: {
		position: "absolute",
		top: MOMENT_CARD.frameInset,
		right: MOMENT_CARD.frameInset,
		bottom: MOMENT_CARD.frameInset,
		left: MOMENT_CARD.frameInset,
		borderRadius: MOMENT_CARD.radius - MOMENT_CARD.frameInset / 2,
		borderWidth: 1,
		opacity: MOMENT_CARD.frameOpacity
	},
	content: {
		flex: 1, alignItems: "center", paddingHorizontal: Theme.spacing.xxl, paddingTop: Theme.spacing.xxl, paddingBottom: Theme.spacing.xl
	},
	brand: {
		flexDirection: "row", alignItems: "center"
	},
	logo: {
		width: MOMENT_CARD.logo, height: MOMENT_CARD.logo, marginVertical: MOMENT_CARD.logoInset, marginLeft: MOMENT_CARD.logoInset
	},
	wordmark: {
		fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.eyebrow, letterSpacing: MOMENT_CARD.wordmarkSpacing, textTransform: "uppercase", color: BRAND_COLORS.cream
	},
	middle: {
		flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center"
	},
	emblem: {
		width: MOMENT_CARD.emblem,
		height: MOMENT_CARD.emblem,
		borderRadius: MOMENT_CARD.emblem / 2,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2,
		backgroundColor: BRAND_COLORS.glass
	},
	rays: {
		position: "absolute",
		width: MOMENT_CARD.rays,
		height: MOMENT_CARD.rays,
		left: (MOMENT_CARD.emblem - MOMENT_CARD.rays) / 2,
		top: (MOMENT_CARD.emblem - MOMENT_CARD.rays) / 2
	},
	eyebrow: {
		marginTop: Theme.spacing.xl,
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.eyebrow,
		lineHeight: Theme.lineHeight.eyebrow,
		letterSpacing: MOMENT_CARD.eyebrowSpacing,
		textTransform: "uppercase"
	},
	title: {
		marginTop: Theme.spacing.xs,
		fontFamily: Theme.fonts.extraBold,
		fontSize: MOMENT_CARD.titleSize,
		lineHeight: MOMENT_CARD.titleLineHeight,
		letterSpacing: Theme.letterSpacing.hero / 2,
		textAlign: "center",
		color: BRAND_COLORS.white
	},
	subtitleBox: { marginTop: Theme.spacing.sm },
	subtitle: {
		fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.body, lineHeight: Theme.lineHeight.body, textAlign: "center", color: BRAND_COLORS.cream
	},
	record: {
		marginTop: Theme.spacing.md, alignItems: "center"
	},
	recordLevel: {
		fontFamily: Theme.fonts.extraBold, fontSize: MOMENT_CARD.recordSize
	},
	recordCaption: {
		fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, color: BRAND_COLORS.cream
	},
	footer: {
		alignSelf: "stretch",
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
		paddingTop: Theme.spacing.md,
		borderTopWidth: StyleSheet.hairlineWidth
	},
	pseudo: {
		flexShrink: 1, fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowTitle, color: BRAND_COLORS.white
	},
	signature: { alignItems: "flex-end" },
	date: {
		fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, color: BRAND_COLORS.cream
	},
	host: {
		fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption
	}
});

/** Rays fanning out of the emblem, alternately lit, like a seal catching the light. */
function sunburstPath(count: number): string {
	const center = 50;
	const reach = 50;
	const half = Math.PI / count / 2;
	return Array.from({ length: count }, (_, index) => {
		const angle = index * 2 * Math.PI / count;
		const point = (offset: number): string => `${center + reach * Math.cos(angle + offset)} ${center + reach * Math.sin(angle + offset)}`;
		return `M${center} ${center}L${point(-half)}L${point(half)}Z`;
	}).join("");
}

const SUNBURST = sunburstPath(MOMENT_CARD.rayCount);

function CardBackdrop({ palette }: { palette: MomentPalette }): ReactNode {
	return <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 125" preserveAspectRatio="none">
		<Defs>
			<LinearGradient id="momentCardBackground" x1="0" y1="0" x2="0" y2="1">
				<Stop offset="0" stopColor={palette.top} />
				<Stop offset="1" stopColor={palette.bottom} />
			</LinearGradient>
		</Defs>
		<Rect width="100" height="125" fill="url(#momentCardBackground)" />
	</Svg>;
}

function EmblemGlow({ color }: { color: string }): ReactNode {
	return <Svg style={cardStyles.rays} viewBox="0 0 100 100">
		<Defs>
			<RadialGradient id="momentCardGlow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
				{GLOW_STOPS.map(stop => <Stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />)}
			</RadialGradient>
		</Defs>
		<Path d={SUNBURST} fill="url(#momentCardGlow)" />
	</Svg>;
}

function CardMiddle({ content }: { content: MomentCardContent }): ReactNode {
	const { accent } = content.palette;
	return <View style={cardStyles.middle}>
		<View style={[cardStyles.emblem, { borderColor: accent }]}>
			<EmblemGlow color={accent} />
			<TwemojiIcon emoji={content.emoji} size={MOMENT_CARD.emblemEmoji} />
		</View>
		<Text style={[cardStyles.eyebrow, { color: accent }]}>{content.eyebrow}</Text>
		<Text style={cardStyles.title} numberOfLines={2} adjustsFontSizeToFit>{content.title}</Text>
		<TwemojiText containerStyle={cardStyles.subtitleBox} textStyle={cardStyles.subtitle} emojiSize={Theme.fontSize.body} numberOfLines={2}>{content.subtitle}</TwemojiText>
		{content.record
			? <View style={cardStyles.record}>
				<Text style={[cardStyles.recordLevel, { color: accent }]}>{i18n.t("app:inventory.level", { level: content.record.level })}</Text>
				<Text style={cardStyles.recordCaption}>{content.record.caption}</Text>
			</View>
			: null}
	</View>;
}

function CardFooter({
	accent, pseudo, date
}: {
	accent: string; pseudo: string; date: string;
}): ReactNode {
	return <View style={[cardStyles.footer, { borderTopColor: accent }]}>
		<Text style={cardStyles.pseudo} numberOfLines={1}>{pseudo}</Text>
		<View style={cardStyles.signature}>
			<Text style={cardStyles.date}>{date}</Text>
			<Text style={[cardStyles.host, { color: accent }]}>{AppConstants.WEBSITE_HOST}</Text>
		</View>
	</View>;
}

/** The image a player shares: the moment, whose it is and when, signed by the game. */
export function MomentCard({
	content, pseudo, date
}: {
	content: MomentCardContent; pseudo: string; date: string;
}): ReactNode {
	const { accent } = content.palette;
	return <View style={[cardStyles.card, { backgroundColor: content.palette.bottom }]}>
		<CardBackdrop palette={content.palette} />
		<View style={[cardStyles.frame, { borderColor: accent }]} />
		<View style={cardStyles.content}>
			<View style={cardStyles.brand}>
				<Image source={crowniclesCrown} style={cardStyles.logo} contentFit="contain" accessible={false} />
				<Text style={cardStyles.wordmark}>{AppConstants.BRAND_NAME}</Text>
			</View>
			<CardMiddle content={content} />
			<CardFooter accent={accent} pseudo={pseudo} date={date} />
		</View>
	</View>;
}

const styles = StyleSheet.create({
	layer: {
		...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: Theme.spacing.xxl
	},
	backdrop: {
		...StyleSheet.absoluteFill, backgroundColor: BRAND_COLORS.scrim
	},
	actions: {
		gap: Theme.spacing.sm, marginTop: Theme.spacing.xl
	},
	failed: {
		fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, textAlign: "center", color: BRAND_COLORS.cream
	},
	later: {
		alignItems: "center", paddingVertical: Theme.spacing.md
	},
	laterLabel: {
		fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.bodySmall, color: BRAND_COLORS.white
	},
	pressed: { opacity: 0.6 }
});

async function shareCard(card: RefObject<View | null>): Promise<void> {
	if (!await isAvailableAsync()) {
		throw new Error("Sharing is not available on this device");
	}
	const uri = await captureRef(card, {
		format: SHARED_IMAGE.format, quality: 1, result: "tmpfile"
	});
	await shareAsync(uri, {
		mimeType: SHARED_IMAGE.mimeType, UTI: SHARED_IMAGE.uti, dialogTitle: i18n.t("app:moments.share")
	});
}

function useShareCard(card: RefObject<View | null>): {
	share: () => void; sharing: boolean; failed: boolean;
} {
	const [sharing, setSharing] = useState(false);
	const [failed, setFailed] = useState(false);
	const share = useCallback((): void => {
		setSharing(true);
		setFailed(false);
		shareCard(card)
			.catch((error: unknown) => {
				console.warn("Could not share the memorable moment", error);
				setFailed(true);
			})
			.finally(() => setSharing(false));
	}, [card]);
	return {
		share, sharing, failed
	};
}

function useAppearance(): Animated.Value {
	const reducedMotion = useReducedMotion();
	const [shown] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
	useEffect(() => {
		Haptics.notification(NotificationFeedbackType.Success);
		if (reducedMotion) {
			return;
		}
		Animated.timing(shown, {
			toValue: 1, duration: MOMENT_MOTION.appearMs, easing: Easing.out(Easing.back(MOMENT_MOTION.overshoot)), useNativeDriver: true
		}).start();
	}, [reducedMotion, shown]);
	return shown;
}

function MomentActions({
	share, sharing, failed, onClose
}: ReturnType<typeof useShareCard> & { onClose: () => void }): ReactNode {
	return <View style={styles.actions}>
		<ActionBanner icon={Share} label={i18n.t("app:moments.share")} pending={sharing} onPress={share} />
		{failed ? <Text style={styles.failed}>{i18n.t("app:moments.shareFailed")}</Text> : null}
		<Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }): object[] => [styles.later, pressed && styles.pressed].filter(Boolean) as object[]} testID="moment-continue">
			<Text style={styles.laterLabel}>{i18n.t("app:common.continue")}</Text>
		</Pressable>
	</View>;
}

function MemorableMomentWindow({
	moment, onClose
}: {
	moment: MemorableMoment; onClose: () => void;
}): ReactNode {
	const pseudo = usePlayerPseudo();
	const { width } = useWindowDimensions();
	const card = useRef<View>(null);
	const content = useMemo(() => momentContent(moment), [moment]);
	const sharing = useShareCard(card);
	const shown = useAppearance();
	const cardWidth = Math.min(width - 2 * Theme.spacing.xxl, MOMENT_CARD.maxWidth);
	const appearing = {
		width: cardWidth,
		opacity: shown,
		transform: [
			{ scale: shown.interpolate({
				inputRange: [0, 1], outputRange: [MOMENT_MOTION.fromScale, 1]
			}) }
		]
	};
	const shared = <View ref={card} collapsable={false}>
		<MomentCard content={content} pseudo={pseudo} date={momentDate(moment.at)} />
	</View>;
	return <NativeWindow transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
		<View style={styles.layer} accessibilityViewIsModal testID="memorable-moment">
			<Animated.View style={[styles.backdrop, { opacity: shown }]} />
			<Animated.View style={appearing}>
				{shared}
				<MomentActions {...sharing} onClose={onClose} />
			</Animated.View>
		</View>
	</NativeWindow>;
}

const VISIBLE_BADGE_SET = new Set<string>(VISIBLE_BADGES);

/** A badge the profile gains asks Core again which ones are still to celebrate. */
function useBadgeGainRefresh(owned: readonly string[] | null): void {
	const queryClient = useQueryClient();
	const ownedKey = owned?.join() ?? null;
	const previousOwnedKey = useRef(ownedKey);
	useEffect(() => {
		const previous = previousOwnedKey.current;
		previousOwnedKey.current = ownedKey;
		if (previous === null || ownedKey === previous) {
			return;
		}
		queryClient.invalidateQueries({ queryKey: gameKey(GAME_ENTITIES.APP_STATE) })
			.catch((error: unknown) => console.warn("Could not ask which badges to celebrate", error));
	}, [ownedKey, queryClient]);
}

/** Badges the app does not show are acknowledged silently; the others are celebrated. */
function announceUnrevealed(unrevealed: readonly Badge[], owned: readonly string[], change: (change: AppStateChange) => void): void {
	const hidden = unrevealed.filter(badge => !VISIBLE_BADGE_SET.has(badge));
	if (hidden.length > 0) {
		change({ revealedBadges: hidden });
	}
	memorableMomentStore.announceBadges(unrevealed.filter(badge => VISIBLE_BADGE_SET.has(badge)), {
		owned: owned.filter(badge => VISIBLE_BADGE_SET.has(badge)).length,
		total: VISIBLE_BADGES.length
	});
}

/**
 * Core keeps which badges no device of the player celebrated yet, so one won while the app was closed,
 * or celebrated on another phone, is handled once.
 */
function useBadgeMoments(): void {
	const appState = useAppState();
	const profile = usePlayerProfile();
	const change = useAppStateChange();
	const unrevealed = appState.status === "ready" ? appState.data.unrevealedBadges : null;
	const owned = profile.status === "ready" ? profile.data.badges : null;
	useBadgeGainRefresh(owned);
	useEffect(() => {
		if (unrevealed && owned) {
			announceUnrevealed(unrevealed, owned, change);
		}
	}, [
		unrevealed,
		owned,
		change
	]);
}

/** Mythical finds and boss records Core keeps until a device has shown them, even if the app closed first. */
function useRevealedMoments(): void {
	const appState = useAppState();
	const reveals = appState.status === "ready" ? appState.data.reveals : null;
	useEffect(() => {
		if (reveals) {
			memorableMomentStore.announceReveals(reveals);
		}
	}, [reveals]);
}

function acknowledgement(moment: MemorableMoment): AppStateChange {
	return moment.kind === MEMORABLE_MOMENT_KINDS.BADGE ? { revealedBadges: [moment.badge] } : { acknowledged: [moment.revealId] };
}

/** A moment waits for the other announcements and for any fight on screen. */
function momentCanShow(myTurn: boolean, fighting: boolean): boolean {
	return myTurn && !fighting;
}

/** Offers to share a moment worth remembering once the game has nothing else to tell and no fight is shown. */
export function MemorableMomentOverlay(): ReactNode {
	useBadgeMoments();
	useRevealedMoments();
	const moment = useMemorableMoment();
	const myTurn = useAnnouncementTurn();
	const { visible: fighting } = useFight();
	const change = useAppStateChange();
	if (!moment || !momentCanShow(myTurn, fighting)) {
		return null;
	}
	const close = (): void => {
		change(acknowledgement(moment));
		memorableMomentStore.dismiss();
	};
	return <MemorableMomentWindow key={`${moment.kind}-${moment.at}`} moment={moment} onClose={close} />;
}
