import { HomeAssistant } from 'custom-card-helpers';

export interface HistoryPoint {
  state: string;
  last_changed: string;
  last_updated: string;
  entity_id: string;
  attributes: {
    unit_of_measurement?: string;
    [key: string]: any;
  };
}

export type HistoryMap = Record<string, HistoryPoint[]>;

export async function getSensorHistory(
  hass: HomeAssistant,
  entityIds: string | string[],
  days: number = 1
): Promise<HistoryMap> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - days);

  const entityIdList = Array.isArray(entityIds) ? entityIds.join(',') : entityIds;
  const url = `history/period/${startDate.toISOString()}?filter_entity_id=${entityIdList}&end_time=${now.toISOString()}&significant_changes_only=false`;

  try {
    const historyData = (await hass.callApi('GET', url)) as HistoryPoint[][];
    const historyMap: HistoryMap = {};

    if (Array.isArray(entityIds)) {
      entityIds.forEach(id => {
        historyMap[id] = historyData.find(h => h.length > 0 && h[0].entity_id === id) || [];
      });
    } else {
      historyMap[entityIds] = historyData.length > 0 ? historyData[0] : [];
    }

    return historyMap;
  } catch (error) {
    const ids = Array.isArray(entityIds) ? entityIds.join(', ') : entityIds;
    console.error(`[DataFetcher] Error fetching history for ${ids}:`, error);
    return {};
  }
} 