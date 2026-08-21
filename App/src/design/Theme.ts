/**
 * Style tokens taken from `App/mockups/mobile.html`. A screen declares no colour and no spacing of
 * its own: it composes these.
 */
export const Theme = {
	fonts: {
		regular: "Inter_400Regular",
		medium: "Inter_500Medium",
		semiBold: "Inter_600SemiBold",
		bold: "Inter_700Bold",
		extraBold: "Inter_800ExtraBold"
	},
	colors: {
		ink: "#0B0B0C",
		muted: "#6E6E73",
		faint: "#8A8A90",
		paper: "#FFFFFF",
		wash: "#F4F4F5",
		line: "#E6E6E8",
		overlay: "rgba(11,11,12,0.35)",
		gold: "#C8963C",
		red: "#D2504B",
		green: "#3F9A5C",
		blue: "#2F6FD0",
		violet: "#6C56C8"
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
		noticeGap: 11,
		tabBarVertical: 7,
		tabBarHorizontal: 6,
		screenTop: 16,
		screenBottom: 26
	},
	dimensions: {
		itemHeight: 80,
		itemMinHeight: 68,
		actionButtonMinWidth: 60,
		tabBarIcon: 18,
		headerIcon: 24
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
		caption: 12,
		sectionHeader: 15.5,
		title: 18,
		hero: 25,
		rowTitle: 14,
		rowSubtitle: 12.5,
		button: 14.5,
		tabLabel: 10.5,
		chevron: 22
	},
	lineHeight: {
		eyebrow: 16,
		note: 18,
		body: 20,
		bodySmall: 18,
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
		eyebrow: 0.9
	}
} as const;
