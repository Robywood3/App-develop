/*
 * Registro delle integrazioni disponibili. Per aggiungerne una nuova:
 * crea un file che estende Integration (vedi base.js e docs/INTEGRAZIONI.md) e aggiungilo qui.
 */
import { DemoIntegration } from './demo.js';
import { ShellyIntegration } from './shelly.js';
import { DaikinLocalIntegration } from './daikin.js';
import { DaikinOnectaIntegration } from './daikin_onecta.js';
import { NetatmoIntegration } from './netatmo.js';
import { TadoIntegration } from './tado.js';
import { TeslaIntegration } from './tesla.js';
import { OpenMeteoIntegration } from './openmeteo.js';
import { WebhookIntegration } from './webhook.js';

export const INTEGRATIONS = Object.fromEntries(
  [
    TeslaIntegration,
    DaikinLocalIntegration,
    DaikinOnectaIntegration,
    NetatmoIntegration,
    TadoIntegration,
    ShellyIntegration,
    WebhookIntegration,
    OpenMeteoIntegration,
    DemoIntegration
  ].map((cls) => [cls.meta.type, cls])
);
