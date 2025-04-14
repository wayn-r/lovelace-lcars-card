import { StateChangedEvent } from "../types";

/**
 * Formats a StateChangedEvent into a log string.
 * Filters out noisy entities.
 * @param event The state changed event.
 * @returns Formatted string (UPPERCASE) or null if filtered.
 */
export function formatStateChangedEvent(event: StateChangedEvent): string | null {
    if (!event || !event.time_fired || !event.data || !event.data.entity_id || !event.data.new_state) {
        return null;
    }
    try {
        const entityId = event.data.entity_id;
        const newState = event.data.new_state.state ?? 'unknown';

        // Filter out common noisy entities
        if (entityId.startsWith('sensor.time') ||
            entityId.startsWith('sun.sun') ||
            entityId.includes('last_seen') ||
            entityId.includes('uptime') ||
            (event.data.old_state?.attributes?.source_type === 'gps')
           ) {
             return null;
        }

        return `${entityId} changed to ${newState}`.toUpperCase();
    } catch (e) {
        console.error("LCARS Card: Error formatting state_changed event:", e, event);
        return `Error formatting state change: ${event.data.entity_id}`.toUpperCase();
    }
}

/**
 * Helper to generate unique IDs (e.g., for log messages).
 * @returns A reasonably unique string.
 */
export function generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
} 