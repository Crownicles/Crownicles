import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {InventoryReq} from "ws-packets/src/fromClient/InventoryReq";
import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {Inventory, InventoryData} from "@/src/components/Inventory";
import {Missions} from "@/src/components/Missions";
import {Blessing, Guide} from "@/src/components/CharacterReference";
import {DetailScreen} from "@/src/design/DetailScreen";
import {EmptyState, Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

const PROFILE_PAGES = ["inventory", "missions", "guide", "blessing"] as const;
type ProfilePageName = typeof PROFILE_PAGES[number];

function isProfilePage(page: string | string[] | undefined): page is ProfilePageName {
	return typeof page === "string" && (PROFILE_PAGES as readonly string[]).includes(page);
}

function InventorySection({state}: {state: RequestState<InventoryRes>}): ReactNode {
	const inventory = state.status === "ready" ? state.data : null;
	const inventoryData: InventoryData | null = inventory?.data ?? null;
	const emptyMessage = state.status === "failed"
		? i18n.t("app:common.error")
		: state.status === "ready"
			? i18n.t("app:profile.inventory.empty")
			: i18n.t("app:common.loading");
	return inventoryData ? <Inventory
		inventoryData={inventoryData}
		artifacts={inventory ?? {}}
		{...inventory?.dailyBonusAvailableAt === undefined ? {} : {dailyBonusAvailableAt: inventory.dailyBonusAvailableAt}}
	/> : <EmptyState>{emptyMessage}</EmptyState>;
}

function ProfileInventory(): ReactNode {
	const state = useGameQuery<InventoryRes>(
		GAME_ENTITIES.INVENTORY,
		() => GameClient.request(makeFromClientPacket(InventoryReq, {askedPlayer: {}}), InventoryRes, [PlayerNotFound])
	);
	return <InventorySection state={state} />;
}

function ProfilePageContent({page}: {page: ProfilePageName}): ReactNode {
	switch (page) {
		case "inventory": return <ProfileInventory />;
		case "missions": return <Missions />;
		case "guide": return <Guide />;
		default: return <Blessing />;
	}
}

export default function ProfilePageScreen(): ReactNode {
	const {page} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/profile");
	};
	if (!isProfilePage(page)) return <DetailScreen title={i18n.t("app:profile.eyebrow")} eyebrow={i18n.t("app:profile.eyebrow")} onClose={close}><Note>{i18n.t("app:common.error")}</Note></DetailScreen>;
	return <DetailScreen title={i18n.t(`app:profile.titles.${page}`)} eyebrow={i18n.t("app:profile.eyebrow")} onClose={close}><ProfilePageContent page={page} /></DetailScreen>;
}
