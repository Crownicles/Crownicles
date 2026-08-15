import {useNavigation} from "expo-router";
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {useEffect, useState} from "react";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {ProfileReq} from "ws-packets/src/fromClient/ProfileReq";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {InventoryReq} from "ws-packets/src/fromClient/InventoryReq";
import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {Inventory, InventoryData} from "@/src/components/Inventory";
import {i18n} from "@/src/translations/i18n";

interface TooltipState {
	visible: boolean;
	text: string;
	x: number;
	y: number;
}


export default function Profile() {
	const profileState = useGameQuery<ProfileRes>(
		GAME_ENTITIES.PROFILE,
		() => GameClient.request(makeFromClientPacket(ProfileReq, { askedPlayer: {} }), ProfileRes, [PlayerNotFound])
	);
	const inventoryState = useGameQuery<InventoryRes>(
		GAME_ENTITIES.INVENTORY,
		() => GameClient.request(makeFromClientPacket(InventoryReq, { askedPlayer: {} }), InventoryRes, [PlayerNotFound])
	);
	const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, text: '', x: 0, y: 0 });
	const [tooltipTimeout, setTooltipTimeout] = useState<number | null>(null);
	const navigation = useNavigation();

	const profile = profileState.status === "ready" ? profileState.data : null;

	// The server leaves the payload out when it has no inventory to show, so its absence is the empty case
	const inventoryData: InventoryData | null = inventoryState.status === "ready" ? inventoryState.data.data ?? null : null;

	useEffect(() => {
		if (profile) {
			navigation.setOptions({ title: profile.pseudo });
		}
	}, [profile, navigation]);

	const renderProgressBar = (current: number, max: number, color: string, label: string) => {
		const percentage = Math.min((current / max) * 100, 100);

		return (
			<View style={styles.progressBarContainer}>
				<Text style={styles.progressLabel}>{label}</Text>
				<View style={styles.progressBarWrapper}>
					<View style={styles.progressBarBackground}>
						<View
							style={[
								styles.progressBarFill,
								{ width: `${percentage}%`, backgroundColor: color }
							]}
						/>
					</View>
					<Text style={styles.progressText}>
						{current} / {max}
					</Text>
				</View>
			</View>
		);
	};

	const showStatTooltip = (statName: string, x: number, y: number, width: number) => {
		// Clear any existing timeout
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
		}

		// Calculate center position above the stat item
		const centerX = x + 50 + width / 2;
		const tooltipY = y - 150; // Show above the stat item

		setTooltip({
			visible: true,
			text: statName,
			x: centerX,
			y: tooltipY
		});

		// Set new timeout and store its reference
		const newTimeout = setTimeout(() => {
			setTooltip(prev => ({ ...prev, visible: false }));
			setTooltipTimeout(null);
		}, 2000);

		setTooltipTimeout(newTimeout);
	};

	const showCurrencyTooltip = (currencyType: 'money' | 'gems', x: number, y: number, width: number) => {
		// Clear any existing timeout
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
		}

		const tooltipText = currencyType === 'money'
			? i18n.t("app:profile.tooltips.money")
			: i18n.t("app:profile.tooltips.gems");

		setTooltip({
			visible: true,
			text: tooltipText,
			x: currencyType === 'money' ? x + width / 2 + 60 : x + width / 2 - 50,
			y: y - 150
		});

		// Set new timeout and store its reference
		const newTimeout = setTimeout(() => {
			setTooltip(prev => ({ ...prev, visible: false }));
			setTooltipTimeout(null);
		}, 3000);

		setTooltipTimeout(newTimeout);
	};

	const showScoreRankTooltip = (type: 'score' | 'rank', x: number, y: number) => {
		// Clear any existing timeout
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
		}

		const tooltipText = type === 'score'
			? i18n.t("app:profile.tooltips.score")
			: i18n.t("app:profile.tooltips.rank");

		setTooltip({
			visible: true,
			text: tooltipText,
			x: x,
			y: y - 50
		});

		// Set new timeout and store its reference
		const newTimeout = setTimeout(() => {
			setTooltip(prev => ({ ...prev, visible: false }));
			setTooltipTimeout(null);
		}, 3000);

		setTooltipTimeout(newTimeout);
	};

	const renderStatItem = (emoji: string, value: string, statName: string) => {
		return (
			<TouchableOpacity
				style={styles.statItem}
				onPress={(event) => {
					// Convert relative coordinates to absolute screen coordinates
					event.currentTarget.measure((fx, fy, width, height, px, py) => {
						showStatTooltip(statName, px, py, width);
					});
				}}
			>
				<Text style={styles.statEmoji}>{emoji}</Text>
				<Text style={styles.statValue}>{value}</Text>
			</TouchableOpacity>
		);
	};

	const renderStatsContainer = () => {
		if (!profile?.stats) return null;

		const { stats } = profile;

		return (
			<View style={styles.statsContainer}>
				<Text style={styles.statsTitle}>{i18n.t("app:profile.titles.statistics")}</Text>
				<View style={styles.statsGrid}>
					{renderStatItem("⚡", `${stats.energy.value} / ${stats.energy.max}`, i18n.t("app:profile.tooltips.energy"))}
					{renderStatItem("🌬️", `${stats.breath.base} / ${stats.breath.max}`, i18n.t("app:profile.tooltips.breath"))}
					{renderStatItem("🫁", `${stats.breath.regen}`, i18n.t("app:profile.tooltips.breathRegen"))}
					{renderStatItem("⚔️", `${stats.attack}`, i18n.t("app:profile.tooltips.attack"))}
					{renderStatItem("🛡️", `${stats.defense}`, i18n.t("app:profile.tooltips.defense"))}
					{renderStatItem("🚀", `${stats.speed}`, i18n.t("app:profile.tooltips.speed"))}
				</View>
			</View>
		);
	};

	const renderProfileSection = () => {
		switch (profileState.status) {
			case 'loading':
				return (
					<View style={styles.centerContent}>
						<ActivityIndicator size="large" color="#007AFF" />
						<Text style={styles.loadingText}>Loading profile...</Text>
					</View>
				);
			case 'empty':
			case 'failed':
				return (
					<View style={styles.centerContent}>
						<Text style={styles.errorText}>
							{profileState.status === 'empty' ? 'Profile not found' : 'Request timed out. Please try again.'}
						</Text>
					</View>
				);
			case 'ready':
				return (
					<View style={styles.profileContent}>
						{profile && (
							<>
								{/* Health and Experience Bars Row */}
								<View style={styles.barsContainer}>
									<View style={styles.barItem}>
										{renderProgressBar(
											profile.health.value,
											profile.health.max,
											'#ff4444',
											i18n.t("app:profile.titles.health")
										)}
									</View>
									<View style={styles.barItem}>
										<View style={styles.experienceBarContainer}>
											<Text style={styles.progressLabel}>{i18n.t("app:profile.titles.experience")}</Text>
											<View style={styles.progressBarWrapper}>
												<View style={styles.progressBarBackground}>
													<View
														style={[
															styles.progressBarFill,
															{ width: `${Math.min((profile.experience.value / profile.experience.max) * 100, 100)}%`, backgroundColor: '#FFDF00' }
														]}
													/>
												</View>
												<Text style={styles.progressText}>
													{profile.experience.value} / {profile.experience.max}
												</Text>
											</View>
										</View>
									</View>
								</View>

								{/* Currency Section */}
								<View style={styles.currencyContainer}>
									<Text style={styles.currencyTitle}>{i18n.t("app:profile.titles.currencies")}</Text>
									<View style={styles.currencyGrid}>
										<TouchableOpacity
												style={styles.currencyItem}
												onPress={(event) => {
													event.currentTarget.measure((fx, fy, width, height, px, py) => {
														showCurrencyTooltip('money', px, py, width);
													});
												}}
										>
											<Text style={styles.currencyEmoji}>💰</Text>
											<Text style={styles.currencyValue}>{profile.money}</Text>
										</TouchableOpacity>

										<TouchableOpacity
												style={styles.currencyItem}
												onPress={(event) => {
													event.currentTarget.measure((fx, fy, width, height, px, py) => {
														showCurrencyTooltip('gems', px, py, width);
													});
												}}
										>
											<Text style={styles.currencyEmoji}>💎</Text>
											<Text style={styles.currencyValue}>{profile.missions.gems}</Text>
										</TouchableOpacity>
									</View>
								</View>

								{/* Score and Rank Section */}
								<View style={styles.scoreRankContainer}>
									<Text style={styles.scoreRankTitle}>{i18n.t("app:profile.titles.scoreAndRank")}</Text>
									<View style={styles.scoreRankGrid}>
										<TouchableOpacity
											style={styles.scoreRankItem}
											onPress={(event) => {
												event.currentTarget.measure((fx, fy, width, height, px, py) => {
													showScoreRankTooltip('score', px + width / 2, py);
												});
											}}
										>
											<Text style={styles.scoreRankEmoji}>🏅</Text>
											<Text style={styles.scoreRankValue}>{profile.rank.score}</Text>
										</TouchableOpacity>

										<TouchableOpacity
											style={styles.scoreRankItem}
											onPress={(event) => {
												event.currentTarget.measure((fx, fy, width, height, px, py) => {
													showScoreRankTooltip('rank', px + width / 2, py);
												});
											}}
										>
											<Text style={styles.scoreRankEmoji}>🏆</Text>
											<Text style={styles.scoreRankValue}>
												{profile.rank.unranked ? 'Unranked' : `${profile.rank.rank} / ${profile.rank.numberOfPlayers}`}
											</Text>
										</TouchableOpacity>
									</View>
								</View>

								{/* Statistics Container */}
								{renderStatsContainer()}
							</>
						)}
					</View>
				);
			default:
				return null;
		}
	};

	const hideTooltip = () => {
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
			setTooltipTimeout(null);
		}
		setTooltip(prev => ({ ...prev, visible: false }));
	};

	return (
		<View style={styles.container}>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				onTouchStart={hideTooltip}
			>
				{/* Profile Section */}
				<View style={styles.section}>
					{renderProfileSection()}
				</View>

				{/* Separator Line */}
				<View style={styles.separator} />

				{/* Inventory Section */}
				<View style={styles.section}>
					<Inventory inventoryData={inventoryData} />
				</View>
			</ScrollView>

			{/* Tooltip Overlay */}
			{tooltip.visible && (
				<TouchableOpacity
					style={[
						styles.tooltip,
						{
							left: tooltip.x - 50,
							top: tooltip.y
						}
					]}
					onPress={hideTooltip}
					activeOpacity={1}
				>
					<Text style={styles.tooltipText}>{tooltip.text}</Text>
				</TouchableOpacity>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
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
	experienceBarContainer: {
		// Removed marginTop to align with health bar
	},
	statsContainer: {
		marginTop: 20,
	},
	statsTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#333',
		marginBottom: 10,
	},
	statsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
	},
	statItem: {
		width: '31%',
		backgroundColor: '#f9f9f9',
		borderRadius: 10,
		padding: 12,
		marginBottom: 10,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	statEmoji: {
		fontSize: 24,
		textAlign: 'center',
	},
	statValue: {
		fontSize: 14,
		fontWeight: '500',
		color: '#333',
		marginTop: 5,
		textAlign: 'center',
	},
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
		transform: [{ translateX: -50 }], // Center the tooltip horizontally
	},
	tooltipText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	currencyContainer: {
		marginTop: 20,
	},
	currencyTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#333',
		marginBottom: 10,
	},
	currencyGrid: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	currencyItem: {
		flex: 1,
		backgroundColor: '#f9f9f9',
		borderRadius: 10,
		padding: 12,
		marginHorizontal: 5,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	currencyEmoji: {
		fontSize: 24,
	},
	currencyValue: {
		fontSize: 16,
		fontWeight: '500',
		color: '#333',
		marginTop: 5,
	},
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
	scoreRankContainer: {
		marginTop: 20,
	},
	scoreRankTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#333',
		marginBottom: 10,
	},
	scoreRankGrid: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	scoreRankItem: {
		flex: 1,
		backgroundColor: '#f9f9f9',
		borderRadius: 10,
		padding: 12,
		marginHorizontal: 5,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	scoreRankEmoji: {
		fontSize: 24,
	},
	scoreRankValue: {
		fontSize: 16,
		fontWeight: '500',
		color: '#333',
		marginTop: 5,
		textAlign: 'center',
	},
	barsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '100%',
	},
	barItem: {
		flex: 1,
		marginHorizontal: 5,
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
	inventoryContent: {
		flex: 1,
	},
	inventoryTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#333',
		marginBottom: 10,
	},
	inventoryHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
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
	inventoryList: {
		flexDirection: 'column',
		gap: 10,
	},
	inventoryItem: {
		backgroundColor: '#f9f9f9',
		borderRadius: 10,
		padding: 15,
		flexDirection: 'row',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
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
