/*
 * Meteo da Open-Meteo (gratuito, senza chiave): condizioni attuali e previsioni a 5 giorni.
 * La temperatura esterna serve a Casa-Clima per scegliere la stagione (riscaldamento/raffrescamento).
 */
import { Integration } from './base.js';
import { request } from '../core/http.js';
import { round } from '../core/util.js';

// codici WMO -> condizione in stile HA + descrizione italiana
const WMO = {
  0: ['sunny', 'Sereno'], 1: ['sunny', 'Prevalentemente sereno'], 2: ['partlycloudy', 'Parzialmente nuvoloso'], 3: ['cloudy', 'Coperto'],
  45: ['fog', 'Nebbia'], 48: ['fog', 'Nebbia con brina'],
  51: ['rainy', 'Pioviggine debole'], 53: ['rainy', 'Pioviggine'], 55: ['rainy', 'Pioviggine intensa'],
  56: ['snowy-rainy', 'Pioviggine gelata'], 57: ['snowy-rainy', 'Pioviggine gelata'],
  61: ['rainy', 'Pioggia debole'], 63: ['rainy', 'Pioggia'], 65: ['pouring', 'Pioggia forte'],
  66: ['snowy-rainy', 'Pioggia gelata'], 67: ['snowy-rainy', 'Pioggia gelata forte'],
  71: ['snowy', 'Neve debole'], 73: ['snowy', 'Neve'], 75: ['snowy', 'Neve forte'], 77: ['snowy', 'Granelli di neve'],
  80: ['rainy', 'Rovesci'], 81: ['rainy', 'Rovesci'], 82: ['pouring', 'Rovesci violenti'],
  85: ['snowy', 'Rovesci di neve'], 86: ['snowy', 'Rovesci di neve forti'],
  95: ['lightning-rainy', 'Temporale'], 96: ['hail', 'Temporale con grandine'], 99: ['hail', 'Temporale con grandine forte']
};

export function weatherCondition(code, isDay = true) {
  const [cond, label] = WMO[code] || ['cloudy', 'N/D'];
  return { condition: !isDay && cond === 'sunny' ? 'clear-night' : cond, label };
}

export class OpenMeteoIntegration extends Integration {
  static meta = {
    type: 'openmeteo',
    name: 'Meteo (Open-Meteo)',
    icon: 'sun',
    description: 'Meteo attuale e previsioni per la tua posizione. Gratuito, nessuna registrazione.',
    fields: [
      { key: 'latitude', label: 'Latitudine', type: 'number', required: true, placeholder: '45.4642' },
      { key: 'longitude', label: 'Longitudine', type: 'number', required: true, placeholder: '9.1900' },
      { key: 'poll_interval', label: 'Aggiornamento (secondi)', type: 'number', default: 900 }
    ],
    defaultPollInterval: 900,
    multiple: false
  };

  async setup() {
    const dev = this.device('home', { name: 'Meteo', manufacturer: 'Open-Meteo' });
    this.ids = {
      weather: this.entity('weather', 'home', { name: 'Meteo casa', slug: 'casa', device_id: dev }),
      temp: this.entity('sensor', 'temp', { name: 'Temperatura esterna', slug: 'meteo_temperatura', device_id: dev, unit: '°C', device_class: 'temperature' }),
      hum: this.entity('sensor', 'hum', { name: 'Umidità esterna', slug: 'meteo_umidita', device_id: dev, unit: '%', device_class: 'humidity' }),
      feels: this.entity('sensor', 'feels', { name: 'Temperatura percepita', slug: 'meteo_percepita', device_id: dev, unit: '°C', device_class: 'temperature' }),
      sun: this.entity('sensor', 'radiation', { name: 'Irraggiamento solare', slug: 'meteo_irraggiamento', device_id: dev, unit: 'W/m²', device_class: 'irradiance' })
    };
  }

  async update() {
    const d = await request('https://api.open-meteo.com/v1/forecast', {
      query: {
        latitude: this.options.latitude,
        longitude: this.options.longitude,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,wind_speed_10m,pressure_msl,shortwave_radiation',
        hourly: 'temperature_2m,weather_code,precipitation_probability',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
        timezone: 'auto',
        forecast_days: 5
      }
    });
    const c = d.current;
    const w = weatherCondition(c.weather_code, c.is_day === 1);
    const daily = d.daily.time.map((t, i) => ({
      datetime: t,
      ...(({ condition, label }) => ({ condition, label }))(weatherCondition(d.daily.weather_code[i])),
      temperature: d.daily.temperature_2m_max[i],
      templow: d.daily.temperature_2m_min[i],
      precipitation_probability: d.daily.precipitation_probability_max[i]
    }));
    const nowIdx = Math.max(0, d.hourly.time.findIndex((t) => new Date(t) >= new Date(Date.now() - 3600_000)));
    const hourly = d.hourly.time.slice(nowIdx, nowIdx + 24).map((t, i) => ({
      datetime: t,
      temperature: d.hourly.temperature_2m[nowIdx + i],
      condition: weatherCondition(d.hourly.weather_code[nowIdx + i]).condition,
      precipitation_probability: d.hourly.precipitation_probability[nowIdx + i]
    }));
    this.set(this.ids.weather, w.condition, {
      label: w.label,
      temperature: c.temperature_2m,
      apparent_temperature: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      wind_speed: c.wind_speed_10m,
      pressure: c.pressure_msl,
      cloud_cover: c.cloud_cover,
      sunrise: d.daily.sunrise[0],
      sunset: d.daily.sunset[0],
      forecast: daily,
      hourly
    });
    this.set(this.ids.temp, round(c.temperature_2m, 1), {});
    this.set(this.ids.hum, Math.round(c.relative_humidity_2m), {});
    this.set(this.ids.feels, round(c.apparent_temperature, 1), {});
    this.set(this.ids.sun, Math.round(c.shortwave_radiation ?? 0), {});
    this.statusMessage = `${w.label}, ${round(c.temperature_2m, 1)}°C`;
  }
}
