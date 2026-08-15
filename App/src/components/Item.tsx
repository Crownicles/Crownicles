import React, {useState} from "react";
import {Animated, Text, TouchableOpacity, View} from "react-native";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {MainItemStat} from "ws-packets/src/objects/MainItemStat";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {ItemRarity} from "ws-packets/src/objects/ItemRarity";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";
import {styles} from "./Item.styles";

export interface InventoryItemProps {
	item?: MainItem | SupportItem;
	itemType: 'weapon' | 'armor' | 'potion' | 'object';
	isEmpty?: boolean;
	customKey?: string;
	onDrink?: () => void;
	onSwitch?: () => void;
	onSell?: () => void;
	isBackupItem?: boolean;
}
export function Item({ item, itemType, isEmpty = false, customKey, onDrink, onSwitch, onSell, isBackupItem = false }: InventoryItemProps) {
	const [isFlipped, setIsFlipped] = useState<boolean>(false);
	const [flipAnim] = useState(new Animated.Value(0));

	const handleFlip = () => {
		const toValue = isFlipped ? 0 : 1;

		Animated.timing(flipAnim, {
			toValue,
			duration: 300,
			useNativeDriver: true,
		}).start();

		setIsFlipped(!isFlipped);
	};

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

	const renderMainItemStat = (key: string, icon: string, stat: MainItemStat) => {
		const value = stat.baseValue + stat.upgradeValue;
		if (value <= 0) {
			return null;
		}

		const { text, isNerfed } = formatStatValue(value, stat.maxValue);
		return (
			<Text key={key} style={styles.itemStatText}>
				<Text style={styles.itemStatIcon}>{icon}</Text>
				<Text style={[styles.itemStatValue, isNerfed && styles.nerfedStat]}>
					{isNerfed && <Text style={styles.strikethrough}>{value}</Text>} {text}
				</Text>
			</Text>
		);
	};

	const renderMainItemStats = (item: MainItem) => {
			const stats = [
			renderMainItemStat("attack", "⚔️", item.attack),
			renderMainItemStat("defense", "🛡️", item.defense),
			renderMainItemStat("speed", "🚀", item.speed)
			].filter((stat): stat is React.ReactElement => stat !== null);

		if (stats.length === 0) return null;

		return (
			<Text style={styles.itemStatsLine}>
				{stats.map((stat, index) => (
					<Text key={stat.key}>
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

	const renderActionButtons = () => {
		if (!item || item.id === 0) return null;

		return (
			<View style={styles.actionButtons}>
				{itemType === 'potion' && onDrink && (
					<TouchableOpacity style={styles.actionButton} onPress={onDrink}>
						<Text style={styles.actionButtonIcon}>🍺</Text>
						<Text style={styles.actionButtonText}>{i18n.t("app:profile.inventory.actions.drink")}</Text>
					</TouchableOpacity>
				)}
				{onSwitch && (
					<TouchableOpacity style={styles.actionButton} onPress={onSwitch}>
						<Text style={styles.actionButtonIcon}>🔄</Text>
						<Text style={styles.actionButtonText}>
							{i18n.t(isBackupItem ? "app:profile.inventory.actions.equip" : "app:profile.inventory.actions.switch")}
						</Text>
					</TouchableOpacity>
				)}
				{onSell && (
					<TouchableOpacity style={styles.actionButton} onPress={onSell}>
						<Text style={styles.actionButtonIcon}>💰</Text>
						<Text style={styles.actionButtonText}>{i18n.t("app:profile.inventory.actions.sell")}</Text>
					</TouchableOpacity>
				)}
				<TouchableOpacity style={styles.actionButton} onPress={handleFlip}>
					<Text style={styles.actionButtonIcon}>❌</Text>
					<Text style={styles.actionButtonText}>{i18n.t("app:profile.inventory.actions.close")}</Text>
				</TouchableOpacity>
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

	const frontRotateY = flipAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ['0deg', '180deg'],
	});

	const backRotateY = flipAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ['180deg', '360deg'],
	});

	return (
		<View key={customKey || itemType} style={styles.itemContainer}>
			{/* Front side - Item display */}
			<Animated.View
				style={[
					styles.inventoryItem,
					styles.flipSide,
					{ transform: [{ rotateY: frontRotateY }] },
					isFlipped && styles.hiddenSide
				]}
			>
				<TouchableOpacity style={styles.itemTouchable} onPress={handleFlip}>
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
					<Text style={styles.clickIndicator}>👆</Text>
				</TouchableOpacity>
			</Animated.View>

			{/* Back side - Action buttons */}
			<Animated.View
				style={[
					styles.inventoryItem,
					styles.flipSide,
					styles.backSide,
					{ transform: [{ rotateY: backRotateY }] },
					!isFlipped && styles.hiddenSide
				]}
			>
				{renderActionButtons()}
			</Animated.View>
		</View>
	);
}
