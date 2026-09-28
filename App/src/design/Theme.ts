import {ColorScheme, THEME_PREFERENCES} from "@/src/design/ThemePreference";

const LIGHT_COLORS = {
	ink: "#0B0B0C",
	muted: "#6E6E73",
	faint: "#8A8A90",
	paper: "#FFFFFF",
	wash: "#F4F4F5",
	line: "#E6E6E8",
	overlay: "rgba(11,11,12,0.35)",
	shadow: "#0B0B0C",
	gold: "#C8963C",
	red: "#D2504B",
	green: "#3F9A5C",
	blue: "#2F6FD0",
	violet: "#6C56C8",

	/** Tints behind a gain or a loss, light enough for the green or red text they carry. */
	greenWash: "#EAF5EE",
	redWash: "#FBEDEC",
	goldWash: "#F8EFDD"
};

export type Palette = typeof LIGHT_COLORS;

/** A colour named by its role, resolved against the palette in use when it is drawn. */
export type PaletteColor = keyof Palette;

/** A colour of its own, the same whatever the theme. */
export type HexColor = `#${string}`;

/** What a drawing may be tinted with: a role that follows the theme, or a fixed colour. */
export type Tint = PaletteColor | HexColor;

/** The same roles at night: ink turns to light text, paper to the raised surface, accents lifted for contrast. */
const DARK_COLORS: Palette = {
	ink: "#F2F2F3",
	muted: "#A1A1A8",
	faint: "#7E7E86",
	paper: "#1C1C20",
	wash: "#101012",
	line: "#2E2E34",
	overlay: "rgba(0,0,0,0.6)",
	shadow: "#000000",
	gold: "#DDAE55",
	red: "#E8716C",
	green: "#5DBE7B",
	blue: "#6A9BEA",
	violet: "#9A87EA",
	greenWash: "#17291E",
	redWash: "#321B1A",
	goldWash: "#2D2414"
};

export const PALETTES: Record<ColorScheme, Palette> = {
	[THEME_PREFERENCES.LIGHT]: LIGHT_COLORS,
	[THEME_PREFERENCES.DARK]: DARK_COLORS
};

/**
 * Style tokens taken from `App/mockups/mobile.html`. A screen declares no colour and no spacing of
 * its own: it composes these. Colours come from `useColors()`, since the palette follows the theme live.
 */
export const Theme = {
	fonts: {
		regular: "Inter_400Regular",
		medium: "Inter_500Medium",
		semiBold: "Inter_600SemiBold",
		bold: "Inter_700Bold",
		extraBold: "Inter_800ExtraBold"
	},
	spacing: {
		xs: 4,
		sm: 8,
		md: 12,
		lg: 14,
		xl: 18,
		xxl: 24,
		headerGap: 5,
		titleGap: 6,
		sectionGap: 22,
		sectionActionGap: 9,
		noteVertical: 11,
		buttonHorizontal: 20,
		quickActionVertical: 11,
		noticeGap: 11,
		tabBarVertical: 7,
		tabBarHorizontal: 6,
		vitalsBottom: 8,
		walletBottom: 10,
		chipVertical: 5,
		chipHorizontal: 10,
		screenTop: 16,
		screenBottom: 26
	},
	dimensions: {
		itemHeight: 80,
		itemMinHeight: 68,
		actionButtonMinWidth: 60,
		tabBarIcon: 18,
		headerIcon: 24,
		travelTrackHeight: 5,
		vitalBarHeight: 5,
		quickActionHeight: 72,
		quickActionIcon: 19
	},
	emoji: {
		iosHeroOffset: 2,
		iosFieldOffset: -2
	},
	radius: 14,
	pillRadius: 999,
	fontSize: {
		eyebrow: 11.5,
		note: 12.5,
		body: 13.5,
		bodySmall: 13,

		/** The one long-form text of the app: the game's own prose, which needs more room than a label. */
		story: 14.5,
		caption: 12,
		sectionHeader: 15.5,
		title: 18,
		hero: 25,
		rowTitle: 14,
		rowSubtitle: 12.5,
		button: 14.5,
		tabLabel: 10.5,
		vitalLabel: 11,
		chevron: 22
	},
	lineHeight: {
		eyebrow: 16,
		note: 18,
		body: 20,
		bodySmall: 18,
		story: 22,
		hero: 29,
		heroSubtitle: 20,
		rowSubtitle: 17,
		tabLabel: 14
	},

	/**
	 * React Native takes absolute points where the mockup uses em, so these are already converted.
	 */
	letterSpacing: {
		hero: -0.9,
		sectionHeader: -0.3,
		eyebrow: 0.9,
		vitalLabel: -0.11,
		chip: -0.12
	}
} as const;
