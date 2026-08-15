import {StyleSheet} from "react-native";

const layoutStyles = StyleSheet.create({
	itemContainer: {
		position: 'relative',
		height: 80,
		marginBottom: 8,
	},
	inventoryItem: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		backgroundColor: '#f9f9f9',
		borderRadius: 10,
		marginBottom: 8,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
		minHeight: 68,
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

const textStyles = StyleSheet.create({
	itemIcon: {
		fontSize: 24,
		marginRight: 12,
	},
	itemName: {
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 4,
		color: '#333',
	},
	itemRarity: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 4,
	},
	rarityIcon: {
		fontSize: 12,
		marginRight: 4,
	},
	rarityText: {
		fontSize: 12,
		color: '#666',
	},
	itemStatsContainer: {
		marginTop: 4,
	},
	itemStatText: {
		fontSize: 12,
	},
	itemStatsLine: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 4,
	},
	statSeparator: {
		color: '#999',
	},
	itemStatIcon: {
		fontSize: 12,
		marginRight: 2,
	},
	itemStatValue: {
		fontSize: 12,
		color: '#666',
	},
	nerfedStat: {
		color: '#ff6b6b',
	},
	strikethrough: {
		textDecorationLine: 'line-through',
	},
	itemEffect: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 4,
	},
	itemEffectIcon: {
		fontSize: 12,
		marginRight: 4,
	},
	itemEffectText: {
		fontSize: 12,
		color: '#666',
	},
	clickIndicator: {
		fontSize: 16,
		marginLeft: 8,
		color: '#007AFF',
		opacity: 0.8,
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
		backgroundColor: '#fff',
		borderColor: '#ddd',
		borderWidth: 1,
		borderRadius: 10,
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
		paddingHorizontal: 8,
	},
	actionButton: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		backgroundColor: '#f0f0f0',
		minWidth: 60,
	},
	actionButtonIcon: {
		fontSize: 20,
		marginBottom: 2,
	},
	actionButtonText: {
		fontSize: 10,
		color: '#333',
		textAlign: 'center',
		fontWeight: '500',
	},
});

export const styles = {
	...layoutStyles,
	...textStyles,
	...flipStyles,
	...actionStyles,
};
