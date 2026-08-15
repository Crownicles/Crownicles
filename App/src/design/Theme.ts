/**
 * Style tokens taken from `App/mockups/mobile.html`. A screen declares no colour and no spacing of
 * its own: it composes these.
 */
export const Theme = {
	colors: {
		ink: "#0B0B0C",
		muted: "#6E6E73",
		faint: "#8A8A90",
		paper: "#FFFFFF",
		wash: "#F4F4F5",
		line: "#E6E6E8",
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
		xxl: 24
	},
	radius: 14,
	fontSize: {
		eyebrow: 11.5,
		note: 12.5,
		body: 13.5,
		sectionHeader: 15.5,
		title: 18,
		hero: 25
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
