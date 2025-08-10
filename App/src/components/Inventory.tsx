import React, {useState} from "react";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {ItemRarity} from "ws-packets/src/objects/ItemRarity";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

export interface InventoryData {
	weapon?: MainItem;
	armor?: MainItem;
	potion?: SupportItem;
	object?: SupportItem;
	backupWeapons?: { display: MainItem; slot: number }[];
	backupArmors?: { display: MainItem; slot: number }[];
	backupPotions?: { display: SupportItem; slot: number }[];
	backupObjects?: { display: SupportItem; slot: number }[];
	slots?: {
		weapons: number;
		armors: number;
		potions: number;
		objects: number;
	};
}

interface InventoryProps {
	inventoryData: InventoryData | null;
}

export function Inventory({ inventoryData }: InventoryProps) {
	const [showBackupItems, setShowBackupItems] = useState<boolean>(false);

	// Helper functions for inventory
	const getItemIcon = (itemType: 'weapon' | 'armor' | 'potion' | 'object', itemId: number): string => {
		return AppIcons.getIconOrNull(`${itemType}s.${itemId}`) || AppIcons.getIcon("inventory.empty");
	};

	const getRarityIcon = (rarity: ItemRarity): string => {
		return AppIcons.getIcon(`rarity.${rarity}`);
	};

	const getItemNatureEffect = (nature: ItemNature): string => {
		return AppIcons.getIcon(`itemNatures.${nature}`);
	};

	const formatStatValue = (value: number, max: number): { text: string; isNerfed: boolean } => {
		if (value > max) {
			return { text: max.toString(), isNerfed: true };
		}
		return { text: value.toString(), isNerfed: false };
	};

	const renderMainItemStats = (item: MainItem) => {
		const stats = [];

		// Attack stat
		if (item.attack.value > 0) {
			const { text, isNerfed } = formatStatValue(item.attack.value, item.attack.max);
			stats.push(
				<Text key="attack" style={styles.itemStatText}>
					<Text style={styles.itemStatIcon}>⚔️</Text>
					<Text style={[styles.itemStatValue, isNerfed && styles.nerfedStat]}>
						{isNerfed && <Text style={styles.strikethrough}>{item.attack.value}</Text>} {text}
					</Text>
				</Text>
			);
		}

		// Defense stat
		if (item.defense.value > 0) {
			const { text, isNerfed } = formatStatValue(item.defense.value, item.defense.max);
			stats.push(
				<Text key="defense" style={styles.itemStatText}>
					<Text style={styles.itemStatIcon}>🛡️</Text>
					<Text style={[styles.itemStatValue, isNerfed && styles.nerfedStat]}>
						{isNerfed && <Text style={styles.strikethrough}>{item.defense.value}</Text>} {text}
					</Text>
				</Text>
			);
		}

		// Speed stat
		if (item.speed.value > 0) {
			const { text, isNerfed } = formatStatValue(item.speed.value, item.speed.max);
			stats.push(
				<Text key="speed" style={styles.itemStatText}>
					<Text style={styles.itemStatIcon}>🚀</Text>
					<Text style={[styles.itemStatValue, isNerfed && styles.nerfedStat]}>
						{isNerfed && <Text style={styles.strikethrough}>{item.speed.value}</Text>} {text}
					</Text>
				</Text>
			);
		}

		if (stats.length === 0) return null;

		return (
			<Text style={styles.itemStatsLine}>
				{stats.map((stat, index) => (
					<Text key={index}>
						{stat}
						{index < stats.length - 1 && <Text style={styles.statSeparator}> • </Text>}
					</Text>
				))}
			</Text>
		);
	};

	const renderSupportItemEffect = (item: SupportItem, itemType: "potion" | "object") => {
		const effectIcon = getItemNatureEffect(item.nature);
		return (
			<View style={styles.itemEffect}>
				<Text style={styles.itemEffectIcon}>{effectIcon}</Text>
				<Text style={styles.itemEffectText}>
					{itemType === "potion" ? i18n.t(`items:potionsNaturesWithoutEmote.${item.nature}`, { power: item.power })
							: i18n.t(`items:objectsNaturesWithoutEmote.${item.nature}`, { power: item.power })}
				</Text>
			</View>
		);
	};

	const renderEquippedItem = (
		itemType: 'weapon' | 'armor' | 'potion' | 'object',
		item: MainItem | SupportItem | undefined
	) => {
		if (!item || item.id === 0) {
			return (
				<View key={itemType} style={styles.inventoryItem}>
					<Text style={styles.itemIcon}>⬜</Text>
					<View style={styles.itemDetails}>
						<Text style={styles.itemName}>{i18n.t("app:profile.inventory.emptySlot")}</Text>
					</View>
				</View>
			);
		}

		const itemIcon = getItemIcon(itemType, item.id);
		const rarityIcon = getRarityIcon(item.rarity);
		const itemName = i18n.t(`models:${itemType}s.${item.id}`);

		return (
			<View key={itemType} style={styles.inventoryItem}>
				<Text style={styles.itemIcon}>{itemIcon}</Text>
				<View style={styles.itemDetails}>
					<Text style={styles.itemName}>{itemName}</Text>
					<View style={styles.itemRarity}>
						<Text style={styles.rarityIcon}>{rarityIcon}</Text>
						<Text style={styles.rarityText}>
							{i18n.t(`items:raritiesWithoutEmote.${item.rarity}`)}
						</Text>
					</View>
					{/* Stats for weapons and armors */}
					{'attack' in item && (
						<View style={styles.itemStatsContainer}>
							{renderMainItemStats(item)}
						</View>
					)}
					{/* Effect for potions and objects */}
					{'nature' in item && renderSupportItemEffect(item, itemType as "potion" | "object")}
				</View>
			</View>
		);
	};

	const renderBackupItem = (
		itemType: 'weapon' | 'armor' | 'potion' | 'object',
		backupItem: { display: MainItem | SupportItem; slot: number }
	) => {
		const item = backupItem.display;
		const itemIcon = getItemIcon(itemType, item.id);
		const rarityIcon = getRarityIcon(item.rarity);
		const itemName = i18n.t(`models:${itemType}s.${item.id}`);

		return (
			<View key={`${itemType}-${backupItem.slot}`} style={styles.inventoryItem}>
				<Text style={styles.itemIcon}>{itemIcon}</Text>
				<View style={styles.itemDetails}>
					<Text style={styles.itemName}>{itemName}</Text>
					<View style={styles.itemRarity}>
						<Text style={styles.rarityIcon}>{rarityIcon}</Text>
						<Text style={styles.rarityText}>
							{i18n.t(`items:raritiesWithoutEmote.${item.rarity}`)}
						</Text>
					</View>
					{/* Stats for weapons and armors */}
					{'attack' in item && (
						<View style={styles.itemStatsContainer}>
							{renderMainItemStats(item)}
						</View>
					)}
					{/* Effect for potions and objects */}
					{'nature' in item && renderSupportItemEffect(item, itemType as "potion" | "object")}
				</View>
			</View>
		);
	};

	const renderItemTypeHeader = (itemType: 'weapon' | 'armor' | 'potion' | 'object', currentCount?: number, maxSlots?: number) => {
		const typeNames = {
			weapon: i18n.t("items:weapon", { count: maxSlots ?? 1 }),
			armor: i18n.t("items:armor", { count: maxSlots ?? 1 }),
			potion: i18n.t("items:potion", { count: maxSlots ?? 1 }),
			object: i18n.t("items:object", { count: maxSlots ?? 1 })
		};

		const headerText = currentCount !== undefined && maxSlots !== undefined
			? `${typeNames[itemType]} (${currentCount}/${maxSlots})`
			: typeNames[itemType];

		return (
			<View style={styles.itemTypeHeader}>
				<Text style={styles.itemTypeHeaderText}>{headerText}</Text>
			</View>
		);
	};

	const renderEquippedItemsByType = () => {
		if (!inventoryData) return null;

		const itemTypes: ('weapon' | 'armor' | 'potion' | 'object')[] = ['weapon', 'armor', 'potion', 'object'];

		return (
			<View style={styles.inventoryList}>
				{itemTypes.map(itemType => (
					<View key={itemType}>
						{renderItemTypeHeader(itemType)}
						{renderEquippedItem(itemType, inventoryData[itemType])}
					</View>
				))}
			</View>
		);
	};

	const renderBackupItemsByType = () => {
		if (!inventoryData || !inventoryData.slots) return null;

		const itemTypes: { type: 'weapon' | 'armor' | 'potion' | 'object', backupKey: keyof InventoryData }[] = [
			{ type: 'weapon', backupKey: 'backupWeapons' },
			{ type: 'armor', backupKey: 'backupArmors' },
			{ type: 'potion', backupKey: 'backupPotions' },
			{ type: 'object', backupKey: 'backupObjects' }
		];

		return (
			<View style={styles.inventoryList}>
				{itemTypes.map(({ type, backupKey }) => {
					const backupItems = inventoryData[backupKey] as { display: MainItem | SupportItem; slot: number }[] | undefined;
					const maxSlots = inventoryData.slots![`${type}s` as keyof typeof inventoryData.slots];
					const currentCount = backupItems?.length || 0;

					// Create array of all slots (filled and empty)
					const allSlots = [];
					const filledSlots = new Set(backupItems?.map(item => item.slot) || []);

					// Add filled slots
					if (backupItems) {
						backupItems.forEach(item => {
							allSlots.push(renderBackupItem(type, item));
						});
					}

					// Add empty slots
					for (let slot = 1; slot <= maxSlots; slot++) {
						if (!filledSlots.has(slot)) {
							allSlots.push(
								<View key={`${type}-empty-${slot}`} style={styles.inventoryItem}>
									<Text style={styles.itemIcon}>⬜</Text>
									<View style={styles.itemDetails}>
										<Text style={styles.itemName}>{i18n.t("app:profile.inventory.emptySlot")}</Text>
									</View>
								</View>
							);
						}
					}

					// Sort slots by slot number
					allSlots.sort((a, b) => {
						const aSlot = a.key?.toString().includes('empty') ?
							parseInt(a.key.toString().split('-')[2]) :
							parseInt(a.key?.toString().split('-')[1] || '0');
						const bSlot = b.key?.toString().includes('empty') ?
							parseInt(b.key.toString().split('-')[2]) :
							parseInt(b.key?.toString().split('-')[1] || '0');
						return aSlot - bSlot;
					});

					return (
						<View key={type}>
							{renderItemTypeHeader(type, currentCount, maxSlots)}
							{allSlots}
						</View>
					);
				})}
			</View>
		);
	};

	if (!inventoryData) {
		return (
			<View style={styles.centerContent}>
				<Text style={styles.placeholderText}>Loading inventory...</Text>
			</View>
		);
	}

	return (
		<View style={styles.inventoryContent}>
			<View style={styles.inventoryHeader}>
				<Text style={styles.inventoryTitle}>
					{showBackupItems
						? i18n.t("app:profile.inventory.backupItems")
						: i18n.t("app:profile.inventory.equippedItems")
					}
				</Text>
				<TouchableOpacity
					style={styles.toggleButton}
					onPress={() => setShowBackupItems(!showBackupItems)}
				>
					<Text style={styles.toggleButtonText}>
						{showBackupItems
							? i18n.t("app:profile.inventory.seeEquippedItems")
							: i18n.t("app:profile.inventory.seeBackupItems")
						}
					</Text>
				</TouchableOpacity>
			</View>
			{showBackupItems ? renderBackupItemsByType() : renderEquippedItemsByType()}
		</View>
	);
}

const styles = StyleSheet.create({
	centerContent: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	placeholderText: {
		fontSize: 16,
		color: '#666',
		textAlign: 'center',
	},
	inventoryContent: {
		padding: 16,
	},
	inventoryTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 16,
		color: '#333',
	},
	inventoryHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	toggleButton: {
		backgroundColor: '#007AFF',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
	},
	toggleButtonText: {
		color: '#fff',
		fontSize: 12,
		fontWeight: '500',
	},
	inventoryList: {
		gap: 16,
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
	},
	itemIcon: {
		fontSize: 24,
		marginRight: 12,
	},
	itemDetails: {
		flex: 1,
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
	itemTypeHeader: {
		backgroundColor: '#e8e8e8',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 6,
		marginBottom: 8,
	},
	itemTypeHeaderText: {
		fontSize: 14,
		fontWeight: 'bold',
		color: '#333'
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
});
