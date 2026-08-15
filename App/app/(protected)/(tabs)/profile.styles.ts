import {StyleSheet, TextStyle, ViewStyle} from "react-native";

const sharedStyles = {
	sectionTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: "#333",
		marginBottom: 10,
	} satisfies TextStyle,
	cardSurface: {
		backgroundColor: "#f9f9f9",
		borderRadius: 10,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	} satisfies ViewStyle,
	cardEmoji: {
		fontSize: 24,
	} satisfies TextStyle,
	cardValue: {
		fontSize: 16,
		fontWeight: "500",
		color: "#333",
		marginTop: 5,
	} satisfies TextStyle,
};

const layoutStyles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	scrollContainer: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
	},
	section: {
		flex: 1,
		minHeight: 200,
		padding: 20,
	},
	centerContent: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	separator: {
		height: 1,
		backgroundColor: '#e0e0e0',
		marginHorizontal: 20,
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: '#666',
	},
	errorText: {
		fontSize: 16,
		color: '#ff4444',
		textAlign: 'center',
		paddingHorizontal: 20,
	},
	placeholderText: {
		fontSize: 16,
		color: '#999',
		textAlign: 'center',
		fontStyle: 'italic',
	},
	profileContent: {
		flex: 1,
		padding: 10,
		justifyContent: 'flex-start',
	},
	levelContainer: {
		alignItems: 'center',
		marginBottom: 20,
	},
	levelText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#666',
	},
});

const progressStyles = StyleSheet.create({
	progressBarContainer: {
		width: '100%',
	},
	progressLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: '#333',
		marginBottom: 8,
	},
	progressBarWrapper: {
		position: 'relative',
	},
	progressBarBackground: {
		height: 20,
		backgroundColor: '#e0e0e0',
		borderRadius: 10,
		overflow: 'hidden',
	},
	progressBarFill: {
		height: '100%',
		borderRadius: 10,
	},
	progressText: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		textAlign: 'center',
		lineHeight: 20,
		fontSize: 12,
		fontWeight: '600',
		color: '#333',
		textShadowColor: 'rgba(255, 255, 255, 0.8)',
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 1,
	},
	experienceBarContainer: {},
	barsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '100%',
	},
	barItem: {
		flex: 1,
		marginHorizontal: 5,
	},
});

const statisticsStyles = StyleSheet.create({
	statsContainer: {
		marginTop: 20,
	},
	statsTitle: sharedStyles.sectionTitle,
	statsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
	},
	statItem: {
		...sharedStyles.cardSurface,
		width: '31%',
		padding: 12,
		marginBottom: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	statEmoji: {...sharedStyles.cardEmoji, textAlign: 'center'},
	statValue: {
		fontSize: 14,
		fontWeight: '500',
		color: '#333',
		marginTop: 5,
		textAlign: 'center',
	},
	itemStat: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 8,
	},
	itemStatIcon: {
		fontSize: 18,
		color: '#333',
		marginRight: 6,
	},
	itemStatValue: {
		fontSize: 16,
		color: '#333',
	},
	nerfedStat: {
		color: '#ff4444',
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
		fontSize: 18,
		color: '#333',
		marginRight: 6,
	},
	itemEffectText: {
		fontSize: 14,
		color: '#666',
	},
});

const currencyStyles = StyleSheet.create({
	currencyContainer: {
		marginTop: 20,
	},
	currencyTitle: sharedStyles.sectionTitle,
	currencyGrid: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	currencyItem: {
		...sharedStyles.cardSurface,
		flex: 1,
		padding: 12,
		marginHorizontal: 5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	currencyEmoji: sharedStyles.cardEmoji,
	currencyValue: sharedStyles.cardValue,
	moneyContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 10,
	},
	moneyText: {
		fontSize: 18,
		fontWeight: '700',
		color: '#333',
	},
});

const scoreStyles = StyleSheet.create({
	scoreRankContainer: {
		marginTop: 20,
	},
	scoreRankTitle: sharedStyles.sectionTitle,
	scoreRankGrid: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	scoreRankItem: {
		...sharedStyles.cardSurface,
		flex: 1,
		padding: 12,
		marginHorizontal: 5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	scoreRankEmoji: sharedStyles.cardEmoji,
	scoreRankValue: {...sharedStyles.cardValue, textAlign: 'center'},
});

const inventoryLayoutStyles = StyleSheet.create({
	inventoryContent: {
		flex: 1,
	},
	inventoryHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	inventoryList: {
		flexDirection: 'column',
		gap: 10,
	},
});

const inventoryControlsStyles = StyleSheet.create({
	inventoryTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#333',
		marginBottom: 10,
	},
	toggleButton: {
		backgroundColor: '#007AFF',
		borderRadius: 10,
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	toggleButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '500',
	},
});

const inventoryItemStyles = StyleSheet.create({
	inventoryItem: {
		...sharedStyles.cardSurface,
		padding: 15,
		flexDirection: 'row',
		alignItems: 'center',
		position: 'relative',
	},
	itemIcon: {
		fontSize: 32,
		marginRight: 15,
	},
	itemDetails: {
		flex: 1,
	},
	itemName: {
		fontSize: 16,
		fontWeight: '600',
		color: '#333',
		marginBottom: 4,
	},
	itemRarity: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
	},
	rarityIcon: {
		fontSize: 14,
		marginRight: 4,
	},
	rarityText: {
		fontSize: 12,
		color: '#666',
		textTransform: 'capitalize',
	},
	itemTypeHeader: {
		backgroundColor: '#f1f1f1',
		padding: 10,
		borderTopLeftRadius: 10,
		borderTopRightRadius: 10,
		marginBottom: 5,
	},
	itemTypeHeaderText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#333',
	},
});

const inventoryStatsStyles = StyleSheet.create({
	itemStatsContainer: {
		flexDirection: 'column',
		marginTop: 4,
	},
	itemStatText: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	itemStatsLine: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'flex-start',
	},
	statSeparator: {
		color: '#999',
	},
});

const tooltipStyles = StyleSheet.create({
	tooltip: {
		position: 'absolute',
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		zIndex: 1000,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
		transform: [{ translateX: -50 }],
	},
	tooltipText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
});

export const styles = {
	...layoutStyles,
	...progressStyles,
	...statisticsStyles,
	...currencyStyles,
	...scoreStyles,
	...inventoryLayoutStyles,
	...inventoryControlsStyles,
	...inventoryItemStyles,
	...inventoryStatsStyles,
	...tooltipStyles,
};
