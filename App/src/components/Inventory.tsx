import React, {useState} from "react";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {Item} from "@/src/components/Item";
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
						<Item
							item={inventoryData[itemType]}
							itemType={itemType}
							isEmpty={!inventoryData[itemType] || inventoryData[itemType]?.id === 0}
						/>
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
							allSlots.push(
								<Item
									key={`${type}-${item.slot}`}
									item={item.display}
									itemType={type}
									customKey={`${type}-${item.slot}`}
								/>
							);
						});
					}

					// Add empty slots
					for (let slot = 1; slot <= maxSlots; slot++) {
						if (!filledSlots.has(slot)) {
							allSlots.push(
								<Item
									key={`${type}-empty-${slot}`}
									itemType={type}
									isEmpty={true}
									customKey={`${type}-empty-${slot}`}
								/>
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
});
