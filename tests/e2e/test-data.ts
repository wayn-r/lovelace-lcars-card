export const mockSensorData = {
    'sensor.living_room_temperature': {
        unit_of_measurement: '°C',
        data: [
            { state: '22.1', last_changed: new Date(Date.now() - 5 * 60000).toISOString() },
            { state: '22.3', last_changed: new Date(Date.now() - 4 * 60000).toISOString() },
            { state: '22.4', last_changed: new Date(Date.now() - 3 * 60000).toISOString() },
            { state: '22.2', last_changed: new Date(Date.now() - 2 * 60000).toISOString() },
            { state: '22.5', last_changed: new Date(Date.now() - 1 * 60000).toISOString() },
        ],
    },
    'sensor.living_room_humidity': {
        unit_of_measurement: '%',
        data: [
            { state: '45', last_changed: new Date(Date.now() - 5 * 60000).toISOString() },
            { state: '48', last_changed: new Date(Date.now() - 4 * 60000).toISOString() },
            { state: '50', last_changed: new Date(Date.now() - 3 * 60000).toISOString() },
            { state: '49', last_changed: new Date(Date.now() - 2 * 60000).toISOString() },
            { state: '47', last_changed: new Date(Date.now() - 1 * 60000).toISOString() },
        ],
    },
    'sensor.kevv_temperature': {
        unit_of_measurement: '°C',
        data: [
            { state: '21.5', last_changed: new Date(Date.now() - 5 * 60000).toISOString() },
            { state: '21.6', last_changed: new Date(Date.now() - 4 * 60000).toISOString() },
            { state: '21.8', last_changed: new Date(Date.now() - 3 * 60000).toISOString() },
            { state: '21.7', last_changed: new Date(Date.now() - 2 * 60000).toISOString() },
            { state: '21.9', last_changed: new Date(Date.now() - 1 * 60000).toISOString() },
        ],
    },
    'sensor.kevv_relative_humidity': {
        unit_of_measurement: '%',
        data: [
            { state: '55', last_changed: new Date(Date.now() - 5 * 60000).toISOString() },
            { state: '54', last_changed: new Date(Date.now() - 4 * 60000).toISOString() },
            { state: '56', last_changed: new Date(Date.now() - 3 * 60000).toISOString() },
            { state: '58', last_changed: new Date(Date.now() - 2 * 60000).toISOString() },
            { state: '57', last_changed: new Date(Date.now() - 1 * 60000).toISOString() },
        ],
    },
    'sensor.ep1_kitchen_temperature': {
        unit_of_measurement: '°C',
        data: [
            { state: '23.0', last_changed: new Date(Date.now() - 5 * 60000).toISOString() },
            { state: '23.1', last_changed: new Date(Date.now() - 4 * 60000).toISOString() },
            { state: '22.9', last_changed: new Date(Date.now() - 3 * 60000).toISOString() },
            { state: '23.2', last_changed: new Date(Date.now() - 2 * 60000).toISOString() },
            { state: '23.3', last_changed: new Date(Date.now() - 1 * 60000).toISOString() },
        ],
    },
}; 