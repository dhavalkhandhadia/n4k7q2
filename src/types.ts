export type Metrics = {
  pairedHours: number;
  expectedHours: number;
  forecastHours: number;
  actualHours: number;
  maeMw: number | null;
  rmseMw: number | null;
  biasMw: number | null;
  wapePct: number | null;
  p90ShortfallMw: number | null;
  overForecastHours: number;
  meanForecastMw: number | null;
  forecastEnergyMwh: number | null;
  actualEnergyMwh: number | null;
};
export type Hour = {
  startTime: string;
  hour: string;
  forecastMw: number | null;
  actualMw: number | null;
  errorMw: number | null;
  publishTime: string | null;
  leadHours: number | null;
  actualPublishTime: string | null;
  lowerMw?: number | null;
  upperMw?: number | null;
};
export type Day = {
  decisionDate: string;
  deliveryDate: string;
  cutoff: string;
  rows: Hour[];
  metrics: Metrics;
  history: {
    metrics: Metrics;
    rangeAvailable: boolean;
    firstTarget: string | null;
    lastTarget: string | null;
    p10ErrorMw: number | null;
    p90ErrorMw: number | null;
  };
  publicationTimes: string[];
  retrievedAt: string;
};
export type Month = {
  cutoffTime: string;
  days: (Metrics & {
    decisionDate: string;
    deliveryDate: string;
    day: string;
  })[];
  metrics: Metrics;
  byHour: (Metrics & { hour: string })[];
  worstHour: Hour | null;
  retrievedAt: string;
};
