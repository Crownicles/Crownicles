import React from "react";
import {StyleSheet, Text, View} from "react-native";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {ItemRarity} from "ws-packets/src/objects/ItemRarity";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

export interface InventoryItemProps {
	item?: MainItem | SupportItem;
	itemType: 'weapon' | 'armor' | 'potion' | 'object';
	isEmpty?: boolean;
	customKey?: string;
}

export function Item({ item, itemType, isEmpty = false, customKey }: InventoryItemProps) {
	// Helper functions
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

	// Handle empty slot
	if (isEmpty || !item || item.id === 0) {
		return (
			<View key={customKey || itemType} style={styles.inventoryItem}>
				<Text style={styles.itemIcon}>⬜</Text>
				<View style={styles.itemDetails}>
					<Text style={styles.itemName}>{i18n.t("app:profile.inventory.emptySlot")}</Text>
				</View>
			</View>
		);
	}

	// Render filled item
	const itemIcon = getItemIcon(itemType, item.id);
	const rarityIcon = getRarityIcon(item.rarity);
	const itemName = i18n.t(`models:${itemType}s.${item.id}`);

	return (
		<View key={customKey || itemType} style={styles.inventoryItem}>
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
}

const styles = StyleSheet.create({
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
