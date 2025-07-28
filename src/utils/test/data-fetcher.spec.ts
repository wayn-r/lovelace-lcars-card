/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSensorHistory, HistoryPoint, HistoryMap } from '../data-fetcher.js';
import { HomeAssistant } from 'custom-card-helpers';

// Mock HomeAssistant
const createMockHass = (callApiMock?: any): HomeAssistant => ({
  states: {},
  connection: null,
  callService: vi.fn(),
  callApi: callApiMock || vi.fn(),
  fetchWithAuth: vi.fn(),
  sendMessage: vi.fn(),
  callWS: vi.fn(),
  auth: {
    accessToken: 'test-token'
  }
} as any as HomeAssistant);

const createMockHistoryPoint = (
  entityId: string, 
  state: string, 
  timestamp: string,
  attributes: Record<string, any> = {}
): HistoryPoint => ({
  entity_id: entityId,
  state,
  last_changed: timestamp,
  last_updated: timestamp,
  attributes: {
    unit_of_measurement: attributes.unit_of_measurement,
    ...attributes
  }
});

describe('DataFetcher', () => {
  let mockHass: HomeAssistant;

  beforeEach(() => {
    mockHass = createMockHass();
    
    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSensorHistory', () => {
    describe('Single Entity', () => {
      it('should fetch history for a single entity successfully', async () => {
        const entityId = 'sensor.temperature';
        const mockHistoryData = [
          [
            createMockHistoryPoint(entityId, '20.5', '2023-01-01T00:00:00Z', { unit_of_measurement: '°C' }),
            createMockHistoryPoint(entityId, '21.0', '2023-01-01T01:00:00Z', { unit_of_measurement: '°C' }),
            createMockHistoryPoint(entityId, '21.5', '2023-01-01T02:00:00Z', { unit_of_measurement: '°C' })
          ]
        ];

        const mockCallApi = vi.fn().mockResolvedValue(mockHistoryData);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityId, 1);

        expect(mockCallApi).toHaveBeenCalledTimes(1);
        expect(mockCallApi).toHaveBeenCalledWith(
          'GET',
          expect.stringMatching(/^history\/period\/.*\?filter_entity_id=sensor\.temperature&end_time=.*&significant_changes_only=false$/)
        );

        expect(result).toEqual({
          [entityId]: mockHistoryData[0]
        });
      });

      it('should handle empty history data for single entity', async () => {
        const entityId = 'sensor.nonexistent';
        const mockCallApi = vi.fn().mockResolvedValue([]);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityId, 1);

        expect(result).toEqual({
          [entityId]: []
        });
      });

      it('should use default 1 day when days parameter is not provided', async () => {
        const entityId = 'sensor.temperature';
        const mockCallApi = vi.fn().mockResolvedValue([[]]);
        mockHass.callApi = mockCallApi;

        await getSensorHistory(mockHass, entityId);

        const callUrl = mockCallApi.mock.calls[0][1] as string;
        
        // Verify the URL contains proper date parameters (approximately 1 day difference)
        const urlParams = new URLSearchParams(callUrl.split('?')[1]);
        const startTime = new Date(decodeURIComponent(callUrl.match(/history\/period\/([^?]+)/)?.[1] || ''));
        const endTime = new Date(urlParams.get('end_time') || '');
        
        const timeDiff = endTime.getTime() - startTime.getTime();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        expect(timeDiff).toBeCloseTo(dayInMs, -3); // Allow small tolerance for test execution time
      });

      it('should respect custom days parameter', async () => {
        const entityId = 'sensor.temperature';
        const mockCallApi = vi.fn().mockResolvedValue([[]]);
        mockHass.callApi = mockCallApi;

        await getSensorHistory(mockHass, entityId, 7);

        const callUrl = mockCallApi.mock.calls[0][1] as string;
        const startTime = new Date(decodeURIComponent(callUrl.match(/history\/period\/([^?]+)/)?.[1] || ''));
        const urlParams = new URLSearchParams(callUrl.split('?')[1]);
        const endTime = new Date(urlParams.get('end_time') || '');
        
        const timeDiff = endTime.getTime() - startTime.getTime();
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        
        expect(timeDiff).toBeCloseTo(weekInMs, -3);
      });
    });

    describe('Multiple Entities', () => {
      it('should fetch history for multiple entities successfully', async () => {
        const entityIds = ['sensor.temperature', 'sensor.humidity', 'sensor.pressure'];
        const mockHistoryData = [
          [
            createMockHistoryPoint(entityIds[0], '20.5', '2023-01-01T00:00:00Z', { unit_of_measurement: '°C' }),
            createMockHistoryPoint(entityIds[0], '21.0', '2023-01-01T01:00:00Z', { unit_of_measurement: '°C' })
          ],
          [
            createMockHistoryPoint(entityIds[1], '45.2', '2023-01-01T00:00:00Z', { unit_of_measurement: '%' }),
            createMockHistoryPoint(entityIds[1], '46.1', '2023-01-01T01:00:00Z', { unit_of_measurement: '%' })
          ],
          [
            createMockHistoryPoint(entityIds[2], '1013.25', '2023-01-01T00:00:00Z', { unit_of_measurement: 'hPa' })
          ]
        ];

        const mockCallApi = vi.fn().mockResolvedValue(mockHistoryData);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityIds, 1);

        expect(mockCallApi).toHaveBeenCalledTimes(1);
        expect(mockCallApi).toHaveBeenCalledWith(
          'GET',
          expect.stringMatching(/filter_entity_id=sensor\.temperature,sensor\.humidity,sensor\.pressure/)
        );

        expect(result).toEqual({
          [entityIds[0]]: mockHistoryData[0],
          [entityIds[1]]: mockHistoryData[1],
          [entityIds[2]]: mockHistoryData[2]
        });
      });

      it('should handle missing entities in multiple entity request', async () => {
        const entityIds = ['sensor.temperature', 'sensor.nonexistent', 'sensor.humidity'];
        const mockHistoryData = [
          [
            createMockHistoryPoint(entityIds[0], '20.5', '2023-01-01T00:00:00Z', { unit_of_measurement: '°C' })
          ],
          [], // Empty array for nonexistent entity
          [
            createMockHistoryPoint(entityIds[2], '45.2', '2023-01-01T00:00:00Z', { unit_of_measurement: '%' })
          ]
        ];

        const mockCallApi = vi.fn().mockResolvedValue(mockHistoryData);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityIds, 1);

        expect(result).toEqual({
          [entityIds[0]]: mockHistoryData[0],
          [entityIds[1]]: [], // Should get empty array for missing entity
          [entityIds[2]]: mockHistoryData[2]
        });
      });

      it('should handle completely empty response for multiple entities', async () => {
        const entityIds = ['sensor.nonexistent1', 'sensor.nonexistent2'];
        const mockCallApi = vi.fn().mockResolvedValue([]);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityIds, 1);

        expect(result).toEqual({
          [entityIds[0]]: [],
          [entityIds[1]]: []
        });
      });

      it('should handle unordered history data for multiple entities', async () => {
        const entityIds = ['sensor.temperature', 'sensor.humidity'];
        const mockHistoryData = [
          [
            createMockHistoryPoint(entityIds[1], '45.2', '2023-01-01T00:00:00Z', { unit_of_measurement: '%' })
          ],
          [
            createMockHistoryPoint(entityIds[0], '20.5', '2023-01-01T00:00:00Z', { unit_of_measurement: '°C' })
          ]
        ];

        const mockCallApi = vi.fn().mockResolvedValue(mockHistoryData);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityIds, 1);

        // Should correctly match entities regardless of order in response
        expect(result).toEqual({
          [entityIds[0]]: mockHistoryData[1], // temperature data
          [entityIds[1]]: mockHistoryData[0]  // humidity data
        });
      });
    });

    describe('Error Handling', () => {
      it('should handle API errors gracefully and return empty object', async () => {
        const entityId = 'sensor.temperature';
        const mockCallApi = vi.fn().mockRejectedValue(new Error('API Error'));
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityId, 1);

        expect(result).toEqual({});
        expect(console.error).toHaveBeenCalledWith(
          '[DataFetcher] Error fetching history for sensor.temperature:',
          expect.any(Error)
        );
      });

      it('should handle API errors for multiple entities gracefully', async () => {
        const entityIds = ['sensor.temperature', 'sensor.humidity'];
        const mockCallApi = vi.fn().mockRejectedValue(new Error('Network Error'));
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityIds, 1);

        expect(result).toEqual({});
        expect(console.error).toHaveBeenCalledWith(
          '[DataFetcher] Error fetching history for sensor.temperature, sensor.humidity:',
          expect.any(Error)
        );
      });

      it('should handle malformed API response', async () => {
        const entityId = 'sensor.temperature';
        const mockCallApi = vi.fn().mockResolvedValue(null);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityId, 1);

        // Should handle gracefully and not crash
        expect(result).toBeDefined();
      });

      it('should handle API response with malformed history points', async () => {
        const entityId = 'sensor.temperature';
        const mockHistoryData = [
          [
            { invalid: 'data' }, // Malformed history point
            createMockHistoryPoint(entityId, '20.5', '2023-01-01T00:00:00Z')
          ]
        ];

        const mockCallApi = vi.fn().mockResolvedValue(mockHistoryData);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityId, 1);

        // Should still return the data, even if some points are malformed
        expect(result[entityId]).toEqual(mockHistoryData[0]);
      });
    });

    describe('URL Construction', () => {
      it('should construct proper URL with correct parameters for single entity', async () => {
        const entityId = 'sensor.temperature';
        const mockCallApi = vi.fn().mockResolvedValue([[]]);
        mockHass.callApi = mockCallApi;

        await getSensorHistory(mockHass, entityId, 3);

        const calledUrl = mockCallApi.mock.calls[0][1] as string;
        
        expect(calledUrl).toMatch(/^history\/period\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
        expect(calledUrl).toContain('filter_entity_id=sensor.temperature');
        expect(calledUrl).toContain('end_time=');
        expect(calledUrl).toContain('significant_changes_only=false');
      });

      it('should construct proper URL for multiple entities with comma separation', async () => {
        const entityIds = ['sensor.temp_1', 'sensor.temp_2', 'binary_sensor.motion'];
        const mockCallApi = vi.fn().mockResolvedValue([]);
        mockHass.callApi = mockCallApi;

        await getSensorHistory(mockHass, entityIds, 1);

        const calledUrl = mockCallApi.mock.calls[0][1] as string;
        
        expect(calledUrl).toContain('filter_entity_id=sensor.temp_1,sensor.temp_2,binary_sensor.motion');
      });

      it('should handle entity IDs with special characters', async () => {
        const entityId = 'sensor.temp_outdoor-main.garage';
        const mockCallApi = vi.fn().mockResolvedValue([[]]);
        mockHass.callApi = mockCallApi;

        await getSensorHistory(mockHass, entityId, 1);

        const calledUrl = mockCallApi.mock.calls[0][1] as string;
        
        expect(calledUrl).toContain('filter_entity_id=sensor.temp_outdoor-main.garage');
      });
    });

    describe('Date Handling', () => {
      it('should use ISO string format for dates', async () => {
        const entityId = 'sensor.temperature';
        const mockCallApi = vi.fn().mockResolvedValue([[]]);
        mockHass.callApi = mockCallApi;

        await getSensorHistory(mockHass, entityId, 1);

        const calledUrl = mockCallApi.mock.calls[0][1] as string;
        
        // Check start date (in URL path)
        const startDateMatch = calledUrl.match(/history\/period\/([^?]+)/);
        expect(startDateMatch).toBeTruthy();
        expect(startDateMatch![1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

        // Check end date (in query params)
        const urlParams = new URLSearchParams(calledUrl.split('?')[1]);
        const endTime = urlParams.get('end_time');
        expect(endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should handle fractional days (note: setDate only supports whole days)', async () => {
        const entityId = 'sensor.temperature';
        const mockCallApi = vi.fn().mockResolvedValue([[]]);
        mockHass.callApi = mockCallApi;

        await getSensorHistory(mockHass, entityId, 0.5); // Half day (but setDate will round down to 0)

        const calledUrl = mockCallApi.mock.calls[0][1] as string;
        const startTime = new Date(decodeURIComponent(calledUrl.match(/history\/period\/([^?]+)/)?.[1] || ''));
        const urlParams = new URLSearchParams(calledUrl.split('?')[1]);
        const endTime = new Date(urlParams.get('end_time') || '');
        
        const timeDiff = endTime.getTime() - startTime.getTime();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        // Note: Due to setDate() behavior, 0.5 days becomes approximately 1 day
        // This is a limitation of the current implementation
        expect(timeDiff).toBeCloseTo(dayInMs, -3);
      });
    });

    describe('Data Types and Interfaces', () => {
      it('should return properly typed HistoryMap', async () => {
        const entityId = 'sensor.temperature';
        const mockHistoryData = [
          [
            createMockHistoryPoint(entityId, '20.5', '2023-01-01T00:00:00Z', { 
              unit_of_measurement: '°C',
              friendly_name: 'Temperature Sensor'
            })
          ]
        ];

        const mockCallApi = vi.fn().mockResolvedValue(mockHistoryData);
        mockHass.callApi = mockCallApi;

        const result: HistoryMap = await getSensorHistory(mockHass, entityId, 1);

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        expect(Array.isArray(result[entityId])).toBe(true);
        
        const historyPoint: HistoryPoint = result[entityId][0];
        expect(historyPoint).toHaveProperty('entity_id');
        expect(historyPoint).toHaveProperty('state');
        expect(historyPoint).toHaveProperty('last_changed');
        expect(historyPoint).toHaveProperty('last_updated');
        expect(historyPoint).toHaveProperty('attributes');
        expect(typeof historyPoint.attributes).toBe('object');
      });

      it('should preserve all attributes from history points', async () => {
        const entityId = 'sensor.temperature';
        const customAttributes = {
          unit_of_measurement: '°C',
          friendly_name: 'Living Room Temperature',
          device_class: 'temperature',
          custom_attribute: 'custom_value'
        };

        const mockHistoryData = [
          [
            createMockHistoryPoint(entityId, '20.5', '2023-01-01T00:00:00Z', customAttributes)
          ]
        ];

        const mockCallApi = vi.fn().mockResolvedValue(mockHistoryData);
        mockHass.callApi = mockCallApi;

        const result = await getSensorHistory(mockHass, entityId, 1);
        const historyPoint = result[entityId][0];

        expect(historyPoint.attributes).toEqual(customAttributes);
      });
    });
  });
}); 