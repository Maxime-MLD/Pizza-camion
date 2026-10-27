import { brandConfig } from "../config/brand.config";
import { finalCtaConfig } from "../config/final-cta.config";
import { getTodayDisplay } from "./truckToday";
import { isPlaceholderValue } from "./placeholders";

export interface FinalCtaState {
  description: string;
  serviceLine: string;
  actionLabel: string;
  actionHref: string;
}

const formatTime = (time: string | null): string => (time ?? "").replace(":", "h");
const formatVillageLocation = (village: string): string => {
  if (village.startsWith("Le ")) return `au ${village.slice(3)}`;
  if (village.startsWith("La ")) return `à la ${village.slice(3)}`;
  if (village.startsWith("Les ")) return `aux ${village.slice(4)}`;
  return `à ${village}`;
};

export function getFinalCtaState(now: Date): FinalCtaState {
  const today = getTodayDisplay(now);
  const scheduleHref = isPlaceholderValue(brandConfig.scheduleUrl)
    ? "#village-marquee-title"
    : brandConfig.scheduleUrl;

  if (today.isOpen && today.stop.village) {
    const serviceLine = finalCtaConfig.serviceLine(
      formatVillageLocation(today.stop.village),
      formatTime(today.stop.opens),
      formatTime(today.stop.closes),
    );

    if (!isPlaceholderValue(brandConfig.orderUrl)) {
      return {
        description: finalCtaConfig.descriptionReady,
        serviceLine,
        actionLabel: finalCtaConfig.orderLabel,
        actionHref: brandConfig.orderUrl,
      };
    }

    return {
      description: finalCtaConfig.descriptionUnavailable,
      serviceLine: `${serviceLine} ${finalCtaConfig.menuLine}`,
      actionLabel: finalCtaConfig.menuLabel,
      actionHref: "#la-carte",
    };
  }

  if (!today.isClosedDay && !today.isPastService && today.stop.village) {
    return {
      description: finalCtaConfig.descriptionUnavailable,
      serviceLine: finalCtaConfig.plannedLine(
        formatVillageLocation(today.stop.village),
        formatTime(today.stop.opens),
        formatTime(today.stop.closes),
      ),
      actionLabel: finalCtaConfig.scheduleLabel,
      actionHref: scheduleHref,
    };
  }

  return {
    description: finalCtaConfig.descriptionUnavailable,
    serviceLine: finalCtaConfig.closedLine(
      formatVillageLocation(today.nextStop.village ?? ""),
      today.nextStop.dayLabel.toLocaleLowerCase("fr-FR"),
      formatTime(today.nextStop.opens),
      formatTime(today.nextStop.closes),
    ),
    actionLabel: finalCtaConfig.scheduleLabel,
    actionHref: scheduleHref,
  };
}
