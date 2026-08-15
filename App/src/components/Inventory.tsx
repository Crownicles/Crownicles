import React, {useState} from "react";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {DrinkReq} from "ws-packets/src/fromClient/DrinkReq";
import {DrinkNoAvailablePotion} from "ws-packets/src/fromServer/drink/DrinkNoAvailablePotion";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GameClient} from "@/src/networking/GameClient";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {Item} from "@/src/components/Item";
import {i18n} from "@/src/translations/i18n";

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

type InventoryItemType = 'weapon' | 'armor' | 'potion' | 'object';
type BackupItemKey = 'backupWeapons' | 'backupArmors' | 'backupPotions' | 'backupObjects';
type InventorySlotKey = keyof NonNullable<InventoryData['slots']>;

interface BackupItemData {
	display: MainItem | SupportItem;
	slot: number;
}

interface BackupItemTypeConfig {
	type: InventoryItemType;
	backupKey: BackupItemKey;
	slotKey: InventorySlotKey;
}

interface BackupItemActions {
	handleDrink: () => void;
	handleSwitch: (item: MainItem | SupportItem, itemType: InventoryItemType) => void;
	handleSell: (item: MainItem | SupportItem, itemType: InventoryItemType) => void;
}

const BACKUP_ITEM_TYPES: BackupItemTypeConfig[] = [
	{ type: 'weapon', backupKey: 'backupWeapons', slotKey: 'weapons' },
	{ type: 'armor', backupKey: 'backupArmors', slotKey: 'armors' },
	{ type: 'potion', backupKey: 'backupPotions', slotKey: 'potions' },
	{ type: 'object', backupKey: 'backupObjects', slotKey: 'objects' }
];

const FILLED_SLOT_KEY_INDEX = 1;
const EMPTY_SLOT_KEY_INDEX = 2;

function getBackupSlotNumber(item: React.ReactElement): number {
	const key = item.key?.toString() ?? '';
	const keyParts = key.split('-');
	const slotKeyIndex = key.includes('empty') ? EMPTY_SLOT_KEY_INDEX : FILLED_SLOT_KEY_INDEX;
	return parseInt(keyParts[slotKeyIndex] || '0');
}

function sortBackupSlots(items: React.ReactElement[]): React.ReactElement[] {
	return items.sort((firstItem, secondItem) => getBackupSlotNumber(firstItem) - getBackupSlotNumber(secondItem));
}

function createFilledBackupSlotElement(
	type: InventoryItemType,
	item: BackupItemData,
	actions: BackupItemActions
): React.ReactElement {
	const isEmpty = !item.display || item.display.id === 0;
	return (
		<Item
			key={`${type}-${item.slot}`}
			item={item.display}
			itemType={type}
			customKey={`${type}-${item.slot}`}
			isBackupItem
			onDrink={!isEmpty && type === 'potion' ? actions.handleDrink : undefined}
			onSwitch={!isEmpty ? () => actions.handleSwitch(item.display, type) : undefined}
			onSell={!isEmpty ? () => actions.handleSell(item.display, type) : undefined}
		/>
	);
}

function createEmptyBackupSlotElements(
	type: InventoryItemType,
	maxSlots: number,
	filledSlots: Set<number>
): React.ReactElement[] {
	const emptySlotElements: React.ReactElement[] = [];
	for (let slot = 1; slot <= maxSlots; slot++) {
		if (!filledSlots.has(slot)) {
			emptySlotElements.push(
				<Item
					key={`${type}-empty-${slot}`}
					itemType={type}
					isEmpty
					customKey={`${type}-empty-${slot}`}
				/>
			);
		}
	}
	return emptySlotElements;
}

function createBackupSlotElements(
	type: InventoryItemType,
	backupItems: BackupItemData[] | undefined,
	maxSlots: number,
	actions: BackupItemActions
): React.ReactElement[] {
	const filledSlots = new Set(backupItems?.map(item => item.slot) ?? []);
	const filledSlotElements = backupItems?.map(item => createFilledBackupSlotElement(type, item, actions)) ?? [];
	const emptySlotElements = createEmptyBackupSlotElements(type, maxSlots, filledSlots);

	return sortBackupSlots([...filledSlotElements, ...emptySlotElements]);
}

export function Inventory({ inventoryData }: InventoryProps): React.ReactElement {
	const [showBackupItems, setShowBackupItems] = useState<boolean>(false);
	const { track } = useCollectors();

	// The server decides which potions can be drunk and offers them in a collector
	const handleDrink = (): void => {
		GameClient.request(makeFromClientPacket(DrinkReq, {}), ReactionCollectorCreation, [DrinkNoAvailablePotion])
			.then(answer => {
				if (answer.kind === "answer") {
					track(answer.packet);
				}
			});
	};

	const handleSwitch = (item: MainItem | SupportItem, itemType: InventoryItemType): void => {
		console.log(`Switching ${itemType}:`, item);
		// TODO: Implement switch action
	};

	const handleSell = (item: MainItem | SupportItem, itemType: InventoryItemType): void => {
		console.log(`Selling ${itemType}:`, item);
		// TODO: Implement sell action
	};

	const renderItemTypeHeader = (itemType: InventoryItemType, currentCount?: number, maxSlots?: number): React.ReactElement => {
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

	const renderEquippedItemsByType = (): React.ReactElement | null => {
		if (!inventoryData) return null;

		const itemTypes: InventoryItemType[] = ['weapon', 'armor', 'potion', 'object'];

		return (
			<View style={styles.inventoryList}>
				{itemTypes.map(itemType => {
					const item = inventoryData[itemType];
					const isEmpty = !item || item.id === 0;

					return (
						<View key={itemType}>
							{renderItemTypeHeader(itemType)}
							<Item
								item={item}
								itemType={itemType}
								isEmpty={isEmpty}
								onDrink={!isEmpty && itemType === 'potion' ? handleDrink : undefined}
								onSwitch={!isEmpty ? () => handleSwitch(item, itemType) : undefined}
								onSell={!isEmpty ? () => handleSell(item, itemType) : undefined}
							/>
						</View>
					);
				})}
			</View>
		);
	};

	const renderBackupItemType = (
		itemTypeConfig: BackupItemTypeConfig,
		data: InventoryData,
		slots: NonNullable<InventoryData['slots']>
	): React.ReactElement => {
		const backupItems = data[itemTypeConfig.backupKey] as BackupItemData[] | undefined;
		const maxSlots = slots[itemTypeConfig.slotKey];
		const allSlots = createBackupSlotElements(itemTypeConfig.type, backupItems, maxSlots, {
			handleDrink,
			handleSwitch,
			handleSell
		});

		return (
			<View key={itemTypeConfig.type}>
				{renderItemTypeHeader(itemTypeConfig.type, backupItems?.length || 0, maxSlots)}
				{allSlots}
			</View>
		);
	};

	const renderBackupItemsByType = (): React.ReactElement | null => {
		if (!inventoryData?.slots) return null;

		const { slots } = inventoryData;
		return (
			<View style={styles.inventoryList}>
				{BACKUP_ITEM_TYPES.map(itemType => renderBackupItemType(itemType, inventoryData, slots))}
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
