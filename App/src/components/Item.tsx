import React, {ReactElement, useState} from "react";
import {Animated, Text, TouchableOpacity, View} from "react-native";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {MainItemStat} from "ws-packets/src/objects/MainItemStat";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {ItemRarity} from "ws-packets/src/objects/ItemRarity";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";
import {styles} from "./Item.styles";

type InventoryItemType = "weapon" | "armor" | "potion" | "object";
type SupportItemType = "potion" | "object";

export interface InventoryItemProps {
	item?: MainItem | SupportItem;
	itemType: InventoryItemType;
	isEmpty?: boolean;
	customKey?: string;
	onDrink?: () => void;
	onSwitch?: () => void;
	onSell?: () => void;
	isBackupItem?: boolean;
}
interface MainItemStatsProps {
	item: MainItem;
}

interface SupportItemEffectProps {
	item: SupportItem;
	itemType: SupportItemType;
}

interface ActionButtonsProps {
	item?: MainItem | SupportItem;
	itemType: InventoryItemType;
	onDrink?: () => void;
	onSwitch?: () => void;
	onSell?: () => void;
	isBackupItem: boolean;
	onFlip: () => void;
}

interface ItemFrontProps {
	item: MainItem | SupportItem;
	itemType: InventoryItemType;
	itemIcon: string;
	rarityIcon: string;
	itemName: string;
	onFlip: () => void;
}

interface ItemFlipState {
	flipAnim: Animated.Value;
	isFlipped: boolean;
	handleFlip: () => void;
}

interface EmptyItemProps {
	itemType: InventoryItemType;
	customKey?: string;
}

interface FilledItemProps {
	item: MainItem | SupportItem;
	itemType: InventoryItemType;
	customKey?: string;
	onDrink?: () => void;
	onSwitch?: () => void;
	onSell?: () => void;
	isBackupItem: boolean;
	flipAnim: Animated.Value;
	isFlipped: boolean;
	onFlip: () => void;
}

function getItemIcon(itemType: InventoryItemType, itemId: number): string {
	return AppIcons.getIconOrNull(`${itemType}s.${itemId}`) || AppIcons.getIcon("inventory.empty");
}

function getRarityIcon(rarity: ItemRarity): string {
	return AppIcons.getIcon(`rarity.${rarity}`);
}

function getItemNatureEffect(nature: ItemNature): string {
	return AppIcons.getIcon(`itemNatures.${nature}`);
}

function useItemFlip(): ItemFlipState {
	const [isFlipped, setIsFlipped] = useState<boolean>(false);
	const [flipAnim] = useState<Animated.Value>(new Animated.Value(0));

	const handleFlip = (): void => {
		const toValue = isFlipped ? 0 : 1;

		Animated.timing(flipAnim, {
			toValue,
			duration: 300,
			useNativeDriver: true,
		}).start();

		setIsFlipped(!isFlipped);
	};

	return {
		flipAnim,
		isFlipped,
		handleFlip
	};
}

function EmptyItem({itemType, customKey}: EmptyItemProps): ReactElement {
	return (
		<View key={customKey || itemType} style={styles.inventoryItem}>
			<Text style={styles.itemIcon}>⬜</Text>
			<View style={styles.itemDetails}>
				<Text style={styles.itemName}>{i18n.t("app:profile.inventory.emptySlot")}</Text>
			</View>
		</View>
	);
}

function formatStatValue(value: number, max: number): { text: string; isNerfed: boolean } {
	if (value > max) {
		return { text: max.toString(), isNerfed: true };
	}
	return { text: value.toString(), isNerfed: false };
}

function renderMainItemStat(icon: string, stat: MainItemStat): ReactElement {
	const value = stat.baseValue + stat.upgradeValue;
	const { text, isNerfed } = formatStatValue(value, stat.maxValue);

	return (
		<Text style={styles.itemStatText}>
			<Text style={styles.itemStatIcon}>{icon}</Text>
			<Text style={[styles.itemStatValue, isNerfed && styles.nerfedStat]}>
				{isNerfed && <Text style={styles.strikethrough}>{value}</Text>} {text}
			</Text>
		</Text>
	);
}

function MainItemStats({item}: MainItemStatsProps): ReactElement | null {
	const stats = [
		{key: "attack", icon: "⚔️", stat: item.attack},
		{key: "defense", icon: "🛡️", stat: item.defense},
		{key: "speed", icon: "🚀", stat: item.speed}
	].filter(({stat}) => stat.baseValue + stat.upgradeValue > 0);

	if (stats.length === 0) {
		return null;
	}

	return (
		<Text style={styles.itemStatsLine}>
			{stats.map(({key, icon, stat}, index) => (
				<React.Fragment key={key}>
					{renderMainItemStat(icon, stat)}
					{index < stats.length - 1 && <Text style={styles.statSeparator}> • </Text>}
				</React.Fragment>
			))}
		</Text>
	);
}

function SupportItemEffect({item, itemType}: SupportItemEffectProps): ReactElement {
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
}

function ActionButtons({item, itemType, onDrink, onSwitch, onSell, isBackupItem, onFlip}: ActionButtonsProps): ReactElement | null {
	if (!item || item.id === 0) {
		return null;
	}

	return (
		<View style={styles.actionButtons}>
			{itemType === "potion" && onDrink && (
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
			<TouchableOpacity style={styles.actionButton} onPress={onFlip}>
				<Text style={styles.actionButtonIcon}>❌</Text>
				<Text style={styles.actionButtonText}>{i18n.t("app:profile.inventory.actions.close")}</Text>
			</TouchableOpacity>
		</View>
	);
}

function ItemFront({item, itemType, itemIcon, rarityIcon, itemName, onFlip}: ItemFrontProps): ReactElement {
	return (
		<TouchableOpacity style={styles.itemTouchable} onPress={onFlip}>
			<Text style={styles.itemIcon}>{itemIcon}</Text>
			<View style={styles.itemDetails}>
				<Text style={styles.itemName}>{itemName}</Text>
				<View style={styles.itemRarity}>
					<Text style={styles.rarityIcon}>{rarityIcon}</Text>
					<Text style={styles.rarityText}>
						{i18n.t(`items:raritiesWithoutEmote.${item.rarity}`)}
					</Text>
				</View>
				{"attack" in item && (
					<View style={styles.itemStatsContainer}>
						<MainItemStats item={item} />
					</View>
				)}
				{"nature" in item && <SupportItemEffect item={item} itemType={itemType as SupportItemType} />}
			</View>
			<Text style={styles.clickIndicator}>👆</Text>
		</TouchableOpacity>
	);
}

function FilledItem({
	item,
	itemType,
	customKey,
	onDrink,
	onSwitch,
	onSell,
	isBackupItem,
	flipAnim,
	isFlipped,
	onFlip
}: FilledItemProps): ReactElement {
	const itemIcon = getItemIcon(itemType, item.id);
	const rarityIcon = getRarityIcon(item.rarity);
	const itemName = i18n.t(`models:${itemType}s.${item.id}`);

	const frontRotateY = flipAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["0deg", "180deg"],
	});

	const backRotateY = flipAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["180deg", "360deg"],
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
				<ItemFront
					item={item}
					itemType={itemType}
					itemIcon={itemIcon}
					rarityIcon={rarityIcon}
					itemName={itemName}
					onFlip={onFlip}
				/>
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
				<ActionButtons
					item={item}
					itemType={itemType}
					onDrink={onDrink}
					onSwitch={onSwitch}
					onSell={onSell}
					isBackupItem={isBackupItem}
					onFlip={onFlip}
				/>
			</Animated.View>
		</View>
	);
}

export function Item({
	item,
	itemType,
	isEmpty = false,
	customKey,
	onDrink,
	onSwitch,
	onSell,
	isBackupItem = false
}: InventoryItemProps): ReactElement {
	const {
		flipAnim,
		isFlipped,
		handleFlip
	} = useItemFlip();

	if (isEmpty || !item || item.id === 0) {
		return <EmptyItem itemType={itemType} customKey={customKey} />;
	}

	return (
		<FilledItem
			item={item}
			itemType={itemType}
			customKey={customKey}
			onDrink={onDrink}
			onSwitch={onSwitch}
			onSell={onSell}
			isBackupItem={isBackupItem}
			flipAnim={flipAnim}
			isFlipped={isFlipped}
			onFlip={handleFlip}
		/>
	);
}
