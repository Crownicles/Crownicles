import {StyleSheet} from "react-native";
import {Theme} from "@/src/design/Theme";

const layoutStyles = StyleSheet.create({
	itemContainer: {
		position: 'relative',
		height: Theme.dimensions.itemHeight,
		marginBottom: Theme.spacing.sm,
	},
	inventoryItem: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: Theme.spacing.md,
		backgroundColor: Theme.colors.paper,
		borderWidth: 1,
		borderColor: Theme.colors.line,
		borderRadius: Theme.radius,
		marginBottom: Theme.spacing.sm,
		minHeight: Theme.dimensions.itemMinHeight,
	},
	itemDetails: {
		flex: 1,
	},
	itemTouchable: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
});

const itemTextStyles = StyleSheet.create({
	itemIcon: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.hero,
		marginRight: Theme.spacing.md,
	},
	itemName: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.body,
		marginBottom: Theme.spacing.xs,
		color: Theme.colors.ink,
	},
	itemRarity: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: Theme.spacing.xs,
	},
	rarityIcon: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		marginRight: Theme.spacing.xs,
	},
	rarityText: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		color: Theme.colors.muted,
	},
	clickIndicator: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		marginLeft: Theme.spacing.sm,
		color: Theme.colors.blue,
		opacity: 0.8,
	},
});

const statTextStyles = StyleSheet.create({
	itemStatsContainer: {
		marginTop: Theme.spacing.xs,
	},
	itemStatText: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
	},
	itemStatsLine: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: Theme.spacing.xs,
	},
	statSeparator: {
		color: Theme.colors.faint,
	},
	itemStatIcon: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		marginRight: Theme.spacing.xs,
	},
	itemStatValue: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		color: Theme.colors.muted,
	},
	nerfedStat: {
		color: Theme.colors.red,
	},
	strikethrough: {
		textDecorationLine: 'line-through',
	},
});

const effectTextStyles = StyleSheet.create({
	itemEffect: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: Theme.spacing.xs,
	},
	itemEffectIcon: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		marginRight: Theme.spacing.xs,
	},
	itemEffectText: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		color: Theme.colors.muted,
	},
});

const flipStyles = StyleSheet.create({
	flipSide: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backfaceVisibility: 'hidden',
	},
	backSide: {
		backgroundColor: Theme.colors.paper,
		borderColor: Theme.colors.line,
		borderWidth: 1,
		borderRadius: Theme.radius,
		justifyContent: 'center',
	},
	hiddenSide: {
		opacity: 0,
		pointerEvents: 'none',
	},
});

const actionStyles = StyleSheet.create({
	actionButtons: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		width: '100%',
		paddingHorizontal: Theme.spacing.sm,
	},
	actionButton: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: Theme.spacing.sm,
		paddingHorizontal: Theme.spacing.md,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.wash,
		minWidth: Theme.dimensions.actionButtonMinWidth,
	},
	actionButtonIcon: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.title,
		marginBottom: Theme.spacing.xs,
	},
	actionButtonText: {
		fontFamily: Theme.fonts.medium,
		fontSize: Theme.fontSize.eyebrow,
		color: Theme.colors.ink,
		textAlign: 'center',
	},
});

export const styles = {
	...layoutStyles,
	...itemTextStyles,
	...statTextStyles,
	...effectTextStyles,
	...flipStyles,
	...actionStyles,
};
