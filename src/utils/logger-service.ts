import { LogMessage } from '../types.js';
import { HomeAssistant } from 'custom-card-helpers';

// Define proper types instead of using 'any'
interface HassEntityState {
  entity_id: string;
  state: string;
  last_changed: string;
  attributes?: {
    friendly_name?: string;
    [key: string]: any;
  };
}

interface StateChangeEventData {
  new_state: HassEntityState | null;
  old_state: HassEntityState | null;
}

class MessageValidationUtils {
  static messageIsDuplicate(candidate: LogMessage, existingMessages: LogMessage[]): boolean {
    return existingMessages.some(message => 
      message.text.toLowerCase() === candidate.text.toLowerCase()
    );
  }

  static entityStateHasChanged(oldState: HassEntityState | null, newState: HassEntityState | null): boolean {
    if (!newState) return false;
    if (!oldState) return true;
    return oldState.state !== newState.state;
  }
}

class MessageFactory {
  static createFromStateChange(entityId: string, newState: HassEntityState): LogMessage {
    const actualEntityId = newState.entity_id || entityId;
    const friendlyName = newState.attributes?.friendly_name || actualEntityId;
    return {
      id: `${actualEntityId}-${newState.last_changed}`,
      text: `${friendlyName}: ${newState.state}`,
      timestamp: new Date(newState.last_changed).getTime()
    };
  }
}

class MessageStore {
  private messages: LogMessage[] = [];
  
  constructor(private maxSize: number) {}

  addMessage(message: LogMessage): boolean {
    if (MessageValidationUtils.messageIsDuplicate(message, this.messages)) {
      return false;
    }

    this.messages.unshift(message);
    
    if (this.messages.length > this.maxSize) {
      this.messages = this.messages.slice(0, this.maxSize);
    }
    
    return true;
  }

  addMessagesInOrder(messages: LogMessage[]): void {
    const allExistingMessages = [...this.messages];
    const uniqueMessages = messages.filter(message => {
      const isDuplicate = MessageValidationUtils.messageIsDuplicate(message, allExistingMessages);
      if (!isDuplicate) {
        allExistingMessages.push(message);
      }
      return !isDuplicate;
    });
    
    this.messages.push(...uniqueMessages);
    
    if (this.messages.length > this.maxSize) {
      this.messages = this.messages.slice(-this.maxSize);
    }
  }

  getMessages(): LogMessage[] {
    return this.messages;
  }

  setMaxSize(newMaxSize: number): void {
    this.maxSize = newMaxSize;
    if (this.messages.length > this.maxSize) {
      this.messages = this.messages.slice(0, this.maxSize);
    }
  }

  clear(): void {
    this.messages = [];
  }
}

export class LoggerService {
  static instance: LoggerService | null = null;
  
  private messageStore: MessageStore;
  private unsubscribe?: () => void;
  private currentHass?: HomeAssistant;
  private lastStateSnapshot?: Record<string, HassEntityState>;
  private processingCallbacks = new Set<(message: LogMessage) => void>();

  constructor() {
    this.messageStore = new MessageStore(5);
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }


  registerWidget(
    maxLines: number,
    onMessageProcessed: (message: LogMessage) => void
  ): () => void {
    this.messageStore.setMaxSize(maxLines);
    this.processingCallbacks.add(onMessageProcessed);
    
    return () => {
      this.processingCallbacks.delete(onMessageProcessed);
    };
  }

  updateHass(hass: HomeAssistant): void {
    if (this.currentHass === hass) return;

    if (this.currentHass && this.lastStateSnapshot) {
      const newMessages = this.detectStateChanges(this.lastStateSnapshot, hass.states);
      newMessages.sort((a, b) => a.timestamp - b.timestamp); // Sort ascending (oldest first)
      newMessages.forEach(message => {
        if (this.messageStore.addMessage(message)) {
          this.processingCallbacks.forEach(callback => callback(message));
        }
      });
    }

    if (!this.unsubscribe && hass.connection) {
      this.setupStateChangeSubscription(hass);
    }

    this.currentHass = hass;
    this.lastStateSnapshot = { ...hass.states };
  }

  getMessages(): LogMessage[] {
    return this.messageStore.getMessages();
  }

  addMessages(messages: LogMessage[]): void {
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp); // Sort ascending
    sortedMessages.forEach(message => {
      if (this.messageStore.addMessage(message)) {
        this.processingCallbacks.forEach(callback => callback(message));
      }
    });
  }

  addMessagesInOrder(messages: LogMessage[]): void {
    this.messageStore.addMessagesInOrder(messages);
  }

  clearMessages(): void {
    this.messageStore.clear();
  }

  destroy(): void {
    this.unsubscribeFromStateChanges();
    this.currentHass = undefined;
    this.lastStateSnapshot = undefined;
    this.processingCallbacks.clear();
  }

  reset(): void {
    this.destroy();
    this.messageStore.clear();
    // For tests requiring a new instance after reset
    LoggerService.instance = null;
  }

  private detectStateChanges(oldStates: Record<string, HassEntityState>, newStates: Record<string, HassEntityState>): LogMessage[] {
    return Object.entries(newStates)
      .filter(([entityId, newState]) => 
        MessageValidationUtils.entityStateHasChanged(oldStates[entityId], newState)
      )
      .map(([entityId, newState]) => 
        MessageFactory.createFromStateChange(entityId, newState)
      );
  }

  private async setupStateChangeSubscription(hass: HomeAssistant): Promise<void> {
    if (!hass.connection || this.unsubscribe) return;

    try {
      this.unsubscribe = await hass.connection.subscribeEvents(
        (event: any) => this.handleStateChangeEvent(event),
        'state_changed'
      );
    } catch (error) {
      console.warn('Logger Service: Failed to subscribe to state changes', error);
    }
  }

  private handleStateChangeEvent(event: { data: StateChangeEventData }): void {
    const newState = event.data.new_state;
    const oldState = event.data.old_state;
    
    if (!newState || (oldState && !MessageValidationUtils.entityStateHasChanged(oldState, newState))) {
      return;
    }

    const message = MessageFactory.createFromStateChange(newState.entity_id, newState);
    
    if (this.messageStore.addMessage(message)) {
      this.processingCallbacks.forEach(callback => callback(message));
    }
    
    if (this.lastStateSnapshot && newState.entity_id) {
      this.lastStateSnapshot[newState.entity_id] = newState;
    }
  }

  private unsubscribeFromStateChanges(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }
}
