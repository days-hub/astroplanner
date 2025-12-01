import React from "react";

// Meteocons (filled). These SVGs are animated.
import clearDay from "@bybas/weather-icons/production/fill/all/clear-day.svg?url";
import clearNight from "@bybas/weather-icons/production/fill/all/clear-night.svg?url";
import partlyCloudyDay from "@bybas/weather-icons/production/fill/all/partly-cloudy-day.svg?url";
import partlyCloudyNight from "@bybas/weather-icons/production/fill/all/partly-cloudy-night.svg?url";
import overcast from "@bybas/weather-icons/production/fill/all/overcast.svg?url";
import fog from "@bybas/weather-icons/production/fill/all/fog.svg?url";
import drizzle from "@bybas/weather-icons/production/fill/all/drizzle.svg?url";
import rain from "@bybas/weather-icons/production/fill/all/rain.svg?url";
import sleet from "@bybas/weather-icons/production/fill/all/sleet.svg?url";
import snow from "@bybas/weather-icons/production/fill/all/snow.svg?url";
import thunderstorm from "@bybas/weather-icons/production/fill/all/thunderstorms.svg?url";
import hail from "@bybas/weather-icons/production/fill/all/hail.svg?url";
import notAvailable from "@bybas/weather-icons/production/fill/all/not-available.svg?url";

type Props = {
  weatherCode?: number | null;
  isDay?: boolean | null;
  size?: number;
  title?: string;
};

function pickIcon(weatherCode?: number | null, isDay?: boolean | null): string {
  const day = isDay !== false;

  // Open-Meteo WMO codes reference. :contentReference[oaicite:2]{index=2}
  switch (weatherCode) {
    case 0:
      return day ? clearDay : clearNight;

    case 1:
    case 2:
      return day ? partlyCloudyDay : partlyCloudyNight;

    case 3:
      return overcast;

    case 45:
    case 48:
      return fog;

    case 51:
    case 53:
    case 55:
      return drizzle;

    case 56:
    case 57:
    case 66:
    case 67:
      return sleet;

    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return rain;

    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return snow;

    case 95:
      return thunderstorm;

    case 96:
    case 99:
      return hail;

    default:
      return notAvailable;
  }
}

export default function WeatherIcon({ weatherCode, isDay, size = 56, title }: Props) {
  const src = pickIcon(weatherCode, isDay);
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={title ?? "Weather icon"}
      title={title ?? `Weather code: ${weatherCode ?? "n/a"}`}
      style={{ display: "block", filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.45))" }}
    />
  );
}
