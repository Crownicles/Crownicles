import {Fragment, ReactNode, useState} from "react";
import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {MaterialQuantity} from "ws-packets/src/objects/MaterialQuantity";
import {InventoryItemRow} from "@/src/components/InventoryItemRow";
import {i18n} from "@/src/translations/i18n";
import {AppIcons} from "@/src/AppIcons";
import {INVENTORY_MENUS, useCommandMenus} from "@/src/store/useInventoryMenus";
import {Note, QuickAction, QuickActions, SectionHeader} from "@/src/design/Primitives";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Clock3} from "@/src/design/FightIcons";
import {formatNumber} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {materialName, plantName} from "@/src/display/Resources";
import {EntryRow, ExpandableList, Fact, Lock, LockHint} from "@/src/design/Sections";

export type InventoryData = NonNullable<InventoryRes["data"]>;
type InventoryArtifacts = Pick<InventoryRes, "hasTalisman" | "hasCloneTalisman" | "hasRemoteHarvestTalisman">;
type InventoryView = "equipped" | "reserve" | "materials" | "plants";
type InventoryCategory = {equipped: "weapon" | "armor" | "potion" | "object"; reserve: "backupWeapons" | "backupArmors" | "backupPotions" | "backupObjects"; slots: keyof InventoryData["slots"]; icon: string};

const EQUIPPED_SLOT_COUNT = 1;
const MILLISECONDS_PER_MINUTE = 60_000;

/** The same emoji the Discord inventory uses, so the two front ends name a category the same way. */
const VIEW_ICONS: Record<InventoryView, string> = {
	equipped: "itemCategories.0",
	reserve: "inventory.stock",
	materials: "inventory.materials",
	plants: "city.homeUpgrades.garden"
};
const INVENTORY_VIEWS: InventoryView[] = ["equipped", "reserve", "materials", "plants"];
const CATEGORIES: InventoryCategory[] = [
	{equipped: "weapon", reserve: "backupWeapons", slots: "weapons", icon: "itemCategories.0"},
	{equipped: "armor", reserve: "backupArmors", slots: "armors", icon: "itemCategories.1"},
	{equipped: "potion", reserve: "backupPotions", slots: "potions", icon: "itemCategories.2"},
	{equipped: "object", reserve: "backupObjects", slots: "objects", icon: "itemCategories.3"}
];

/** A section title wearing the emoji of what it holds, the way the Discord inventory does. */
function CategoryHeader({category, count}: {category: InventoryCategory; count: number}): ReactNode {
	return <SectionHeader icon={AppIcons.getIconOrNull(category.icon) ?? undefined}>{i18n.t(`items:${category.equipped}`, {count})}</SectionHeader>;
}

function InventoryEquipment({data}: {data: InventoryData}): ReactNode {
	return CATEGORIES.map(category => <Fragment key={category.equipped}>
		<CategoryHeader category={category} count={1} />
		<ExpandableList><InventoryItemRow item={data[category.equipped]} location={i18n.t(`items:${category.equipped}`, {count: 1})} /></ExpandableList>
	</Fragment>);
}

function InventoryReserve({data}: {data: InventoryData}): ReactNode {
	return CATEGORIES.map(category => {
		const items = [...data[category.reserve]].sort((first, second) => first.slot - second.slot);
		const maximum = Math.max(0, data.slots[category.slots] - EQUIPPED_SLOT_COUNT);
		return <Fragment key={category.equipped}>
			<CategoryHeader category={category} count={maximum} />
			<ExpandableList>{items.length > 0
				? items.map(item => <InventoryItemRow key={item.slot} item={item.display} location={i18n.t("app:equipment.slot", {slot: item.slot})} />)
				: <Note>{i18n.t("app:equipment.emptyReserve")}</Note>}
			</ExpandableList>
			<Note>{i18n.t("app:equipment.capacity", {count: items.length, max: maximum})}</Note>
		</Fragment>;
	});
}

function InventoryMaterials({materials}: {materials: MaterialQuantity[]}): ReactNode {
	if (materials.length === 0) return <Note>{i18n.t("app:inventory.noMaterials")}</Note>;
	return <ExpandableList>{materials.map(material => <Fact key={material.materialId} label={materialName(material.materialId)} value={formatNumber(material.quantity)} />)}</ExpandableList>;
}

function InventoryPlants({plants}: {plants: InventoryData["plants"]}): ReactNode {
	if (!plants) return <Note>{i18n.t("app:inventory.noPlants")}</Note>;
	return <>
		<ExpandableList>
			<Fact label={i18n.t("app:inventory.seed")} value={plants.seed ? plantName(plants.seed) : i18n.t("app:profile.values.none")} />
			{plants.plantSlots.map(plant => <Fact key={plant.slot} label={plantName(plant.plantId)} value={i18n.t("app:inventory.plantSlot", {slot: plant.slot})} />)}
		</ExpandableList>
		<Note>{i18n.t("app:equipment.capacity", {count: plants.plantSlots.length, max: plants.maxPlantSlots})}</Note>
	</>;
}

const ARTIFACTS = [
	{field: "hasTalisman", name: "expedition", icon: "expedition.talisman"},
	{field: "hasCloneTalisman", name: "clone", icon: "expedition.cloneTalisman"},
	{field: "hasRemoteHarvestTalisman", name: "harvest", icon: "city.gardenStatus.remoteHarvestTalisman"}
] as const;

function InventoryArtifactList({artifacts}: {artifacts: InventoryArtifacts}): ReactNode {
	return <>
		<SectionHeader>{i18n.t("app:inventory.artifacts.title")}</SectionHeader>
		<ExpandableList>{ARTIFACTS.map(artifact => <EntryRow
			key={artifact.field}
			disabled={!artifacts[artifact.field]}
			emblem={<TwemojiIcon emoji={AppIcons.getIcon(artifact.icon)} size={Theme.dimensions.headerIcon} />}
			title={i18n.t(`app:inventory.artifacts.${artifact.name}`)}
			end={i18n.t(artifacts[artifact.field] ? "app:inventory.owned" : "app:inventory.absent")}
		/>)}</ExpandableList>
	</>;
}

function InventoryContent({view, data, artifacts}: {view: InventoryView; data: InventoryData; artifacts?: InventoryArtifacts}): ReactNode {
	switch (view) {
		case "equipped": return <><InventoryEquipment data={data} />{artifacts ? <InventoryArtifactList artifacts={artifacts} /> : null}</>;
		case "reserve": return <InventoryReserve data={data} />;
		case "materials": return <InventoryMaterials materials={data.materials} />;
		default: return <InventoryPlants plants={data.plants} />;
	}
}

const ACTIONS = [
	{menu: INVENTORY_MENUS.EQUIP, label: "equip", icon: "unitValues.attack"},
	{menu: INVENTORY_MENUS.SELL, label: "sell", icon: "unitValues.money"},
	{menu: INVENTORY_MENUS.DRINK, label: "drink", icon: "items.drinkPotion"},
	{menu: INVENTORY_MENUS.DAILY, label: "daily", icon: "unitValues.xp"}
];

/** The daily bonus is the one action with a delay, so the screen says how long it still has to run. */
function dailyBonusLock(availableAt: number | undefined): Lock | undefined {
	const remaining = availableAt === undefined ? 0 : availableAt - Date.now();
	if (remaining <= 0) return undefined;
	return {
		reason: i18n.t("app:dailyBonus.locked", {time: formatDurationMinutes(remaining / MILLISECONDS_PER_MINUTE)}),
		icon: Clock3
	};
}

export function Inventory({inventoryData, artifacts, dailyBonusAvailableAt}: {
	inventoryData: InventoryData | null;
	artifacts?: InventoryArtifacts;
	dailyBonusAvailableAt?: number;
}): ReactNode {
	const [view, setView] = useState<InventoryView>("equipped");
	const {message, pending, open} = useCommandMenus();
	const dailyLock = dailyBonusLock(dailyBonusAvailableAt);
	if (!inventoryData) return <Note>{i18n.t("app:common.loading")}</Note>;
	return <>
		<QuickActions>{ACTIONS.map(action => {
			const locked = action.menu === INVENTORY_MENUS.DAILY && dailyLock !== undefined;
			return <QuickAction
				key={action.label}
				icon={AppIcons.getIcon(action.icon)}
				disabled={pending || locked}
				{...locked ? {} : {onPress: (): Promise<void> => open(action.menu)}}
			>{i18n.t(`app:inventory.actions.${action.label}`)}</QuickAction>;
		})}</QuickActions>
		{dailyLock ? <LockHint lock={dailyLock} /> : null}
		{message ? <Note>{message}</Note> : null}
		<SegmentedControl options={INVENTORY_VIEWS.map(value => ({value, label: i18n.t(`app:inventory.views.${value}`), ...AppIcons.getIconOrNull(VIEW_ICONS[value]) === null ? {} : {icon: AppIcons.getIcon(VIEW_ICONS[value])}}))} value={view} onChange={setView} label={i18n.t("app:profile.titles.inventory")} />
		<InventoryContent view={view} data={inventoryData} artifacts={artifacts} />
	</>;
}
