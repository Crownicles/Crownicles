import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {HomeChest} from "@/src/components/HomeChest";
import {HomeCooking} from "@/src/components/HomeCooking";
import {HOME_SERVICES} from "@/src/navigation/HomeServices";
import {DetailScreen} from "@/src/design/DetailScreen";
import {Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

function HomeServiceContent({service}: {service?: string | string[]}): ReactNode {
	switch (service) {
		case HOME_SERVICES.CHEST: return <HomeChest />;
		case HOME_SERVICES.COOKING: return <HomeCooking />;
		default: return <Note>{i18n.t("app:common.error")}</Note>;
	}
}

export default function HomeServiceScreen(): ReactNode {
	const {service} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/");
	};
	const title = service === HOME_SERVICES.CHEST ? "app:homeChest.title" : "app:city.labels.cooking";
	return <DetailScreen eyebrow={i18n.t("app:city.labels.home")} title={i18n.t(title)} onClose={close}><HomeServiceContent service={service} /></DetailScreen>;
}