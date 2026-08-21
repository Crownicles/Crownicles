import {StyleSheet} from "react-native";
import {Theme} from "@/src/design/Theme";

const cardSurface = {
	borderWidth: 1,
	borderColor: Theme.colors.line,
	borderRadius: Theme.radius,
	backgroundColor: Theme.colors.paper
};

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Theme.colors.wash
	},
	scroll: {
		flex: 1
	},
	scrollContent: {
		flexGrow: 1,
		paddingTop: Theme.spacing.screenTop,
		paddingHorizontal: Theme.spacing.xl,
		paddingBottom: Theme.spacing.screenBottom
	},
	section: {
		marginTop: Theme.spacing.sectionGap
	},
	centerContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: Theme.spacing.xxl,
		backgroundColor: Theme.colors.wash
	},
	separator: {
		height: 1,
		backgroundColor: Theme.colors.line
	},
	loadingText: {
		marginTop: Theme.spacing.headerGap,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		color: Theme.colors.muted
	},
	loadingIndicator: {
		color: Theme.colors.ink
	},
	errorText: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		color: Theme.colors.red,
		textAlign: "center",
		paddingHorizontal: Theme.spacing.xl
	},
	profileContent: {
		flex: 1
	},
	barsContainer: {
		flexDirection: "row",
		gap: Theme.spacing.sm,
		width: "100%"
	},
	barItem: {
		flex: 1
	},
	progressBarContainer: {
		width: "100%"
	},
	progressLabel: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		color: Theme.colors.muted
	},
	progressBarHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: Theme.spacing.sm,
		marginBottom: Theme.spacing.headerGap
	},
	progressBarBackground: {
		height: 5,
		backgroundColor: Theme.colors.line,
		borderRadius: 3,
		overflow: "hidden"
	},
	progressBarFill: {
		height: "100%",
		borderRadius: 3
	},
	progressValue: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		color: Theme.colors.ink,
		textAlign: "right"
	},
	statsContainer: {
		marginTop: Theme.spacing.sectionGap
	},
	statsTitle: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.sectionHeader,
		color: Theme.colors.ink,
		marginBottom: Theme.spacing.sectionActionGap
	},
	statsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between"
	},
	statItem: {
		...cardSurface,
		width: "31%",
		padding: Theme.spacing.md,
		marginBottom: Theme.spacing.sm,
		alignItems: "center",
		justifyContent: "center"
	},
	statEmoji: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.title,
		textAlign: "center"
	},
	statValue: {
		fontFamily: Theme.fonts.medium,
		fontSize: Theme.fontSize.bodySmall,
		lineHeight: Theme.lineHeight.bodySmall,
		color: Theme.colors.ink,
		marginTop: Theme.spacing.headerGap,
		textAlign: "center"
	},
	currencyContainer: {
		marginTop: Theme.spacing.sectionGap
	},
	currencyTitle: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.sectionHeader,
		color: Theme.colors.ink,
		marginBottom: Theme.spacing.sectionActionGap
	},
	currencyGrid: {
		flexDirection: "row",
		justifyContent: "space-between"
	},
	currencyItem: {
		...cardSurface,
		flex: 1,
		padding: Theme.spacing.md,
		marginHorizontal: Theme.spacing.xs,
		alignItems: "center",
		justifyContent: "center"
	},
	currencyEmoji: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.title
	},
	currencyValue: {
		fontFamily: Theme.fonts.medium,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		color: Theme.colors.ink,
		marginTop: Theme.spacing.headerGap
	},
	scoreRankContainer: {
		marginTop: Theme.spacing.sectionGap
	},
	scoreRankTitle: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.sectionHeader,
		color: Theme.colors.ink,
		marginBottom: Theme.spacing.sectionActionGap
	},
	scoreRankGrid: {
		flexDirection: "row",
		justifyContent: "space-between"
	},
	scoreRankItem: {
		...cardSurface,
		flex: 1,
		padding: Theme.spacing.md,
		marginHorizontal: Theme.spacing.xs,
		alignItems: "center",
		justifyContent: "center"
	},
	scoreRankEmoji: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.title
	},
	scoreRankValue: {
		fontFamily: Theme.fonts.medium,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		color: Theme.colors.ink,
		marginTop: Theme.spacing.headerGap,
		textAlign: "center"
	},
	tooltip: {
		position: "absolute",
		backgroundColor: Theme.colors.ink,
		borderRadius: Theme.radius,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		zIndex: 1000,
		elevation: 4,
		transform: [{translateX: -50}]
	},
	tooltipText: {
		fontFamily: Theme.fonts.semiBold,
		color: Theme.colors.paper,
		fontSize: Theme.fontSize.bodySmall,
		lineHeight: Theme.lineHeight.bodySmall,
		textAlign: "center"
	}
});