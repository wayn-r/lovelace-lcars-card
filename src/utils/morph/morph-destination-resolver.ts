import type { LcarsCardConfig } from '../../types.js';
import { CARD_TYPE } from '../../constants.js';

export interface DestinationResolutionResult {
  config: LcarsCardConfig;
  navigationPath: string;
  isValid: boolean;
}

export interface ContainerResizeRequirement {
  requiredWidth: number;
  requiredHeight: number;
  shouldExpand: boolean;
}

export class DestinationResolver {
  static async resolveConfigurationFromNavigationPath(
    navigationPath: string,
    homeAssistantConnection?: import('custom-card-helpers').HomeAssistant
  ): Promise<DestinationResolutionResult> {
    try {
      const pathComponents = this._parseNavigationPath(navigationPath);
      if (!pathComponents.dashboardUrlPath) {
        return {
          config: {} as LcarsCardConfig,
          navigationPath,
          isValid: false
        };
      }

      if (!this._connectionIsAvailable(homeAssistantConnection)) {
        return {
          config: {} as LcarsCardConfig,
          navigationPath,
          isValid: false
        };
      }

      const dashboardConfig = await this._loadDashboardConfiguration(
        pathComponents.dashboardUrlPath, 
        homeAssistantConnection!
      );

      if (!this._dashboardConfigurationIsValid(dashboardConfig)) {
        return {
          config: {} as LcarsCardConfig,
          navigationPath,
          isValid: false
        };
      }

      const targetView = this._selectTargetView(dashboardConfig.views, pathComponents.viewPath);
      if (!targetView) {
        return {
          config: {} as LcarsCardConfig,
          navigationPath,
          isValid: false
        };
      }

      const lcarsCard = this._extractLcarsCardFromView(targetView);
      if (!lcarsCard) {
        return {
          config: {} as LcarsCardConfig,
          navigationPath,
          isValid: false
        };
      }

      return {
        config: lcarsCard as LcarsCardConfig,
        navigationPath,
        isValid: true
      };
    } catch (error) {
      return {
        config: {} as LcarsCardConfig,
        navigationPath,
        isValid: false
      };
    }
  }

  static determineContainerResizeRequirement(
    currentContainerRect: DOMRect,
    fromLayoutBounds: { height: number; width: number },
    toLayoutBounds: { height: number; width: number }
  ): ContainerResizeRequirement {
    const maxRequiredHeight = Math.max(fromLayoutBounds.height, toLayoutBounds.height);
    const maxRequiredWidth = Math.max(fromLayoutBounds.width, toLayoutBounds.width);
    
    const shouldExpand = maxRequiredHeight > currentContainerRect.height || 
                        maxRequiredWidth > currentContainerRect.width;

    return {
      requiredWidth: Math.max(currentContainerRect.width, maxRequiredWidth),
      requiredHeight: Math.max(currentContainerRect.height, maxRequiredHeight),
      shouldExpand
    };
  }

  static async waitForContainerToMeetMinimumHeight(
    containerRectProvider: () => DOMRect | undefined,
    minimumHeight: number,
    timeoutMilliseconds: number = 500
  ): Promise<DOMRect | undefined> {
    const startTime = this._getCurrentTime();
    let currentRect = containerRectProvider();
    
    if (!currentRect) return currentRect;
    if (currentRect.height >= minimumHeight) return currentRect;
    
    const deadline = startTime + timeoutMilliseconds;
    
    while (true) {
      await this._waitForNextAnimationFrame();
      
      currentRect = containerRectProvider();
      if (!currentRect) return currentRect;
      if (currentRect.height >= minimumHeight) return currentRect;
      
      const currentTime = this._getCurrentTime();
      if (currentTime >= deadline) return currentRect;
    }
  }

  private static _parseNavigationPath(navigationPath: string): { dashboardUrlPath: string; viewPath?: string } {
    try {
      const trimmedPath = String(navigationPath || '').trim();
      const pathParts = trimmedPath.replace(/^\/+/, '').split('/');
      const dashboardUrlPath = pathParts[0] || '';
      const viewPath = pathParts.length > 1 ? pathParts.slice(1).join('/') : undefined;
      return { dashboardUrlPath, viewPath };
    } catch {
      return { dashboardUrlPath: '', viewPath: undefined };
    }
  }

  private static _connectionIsAvailable(homeAssistantConnection?: import('custom-card-helpers').HomeAssistant): boolean {
    return Boolean(homeAssistantConnection && (homeAssistantConnection as any).connection);
  }

  private static async _loadDashboardConfiguration(dashboardUrlPath: string, homeAssistant: import('custom-card-helpers').HomeAssistant): Promise<any> {
    return await (homeAssistant as any).connection.sendMessagePromise({
      type: 'lovelace/config',
      url_path: dashboardUrlPath,
    });
  }

  private static _dashboardConfigurationIsValid(dashboardConfig: any): boolean {
    return Boolean(dashboardConfig && Array.isArray(dashboardConfig.views));
  }

  private static _selectTargetView(availableViews: any[], targetViewPath?: string): any | undefined {
    if (!availableViews || availableViews.length === 0) return undefined;
    if (!targetViewPath) return availableViews[0];
    
    const viewMatchingPath = availableViews.find(view => 
      typeof view?.path === 'string' && view.path === targetViewPath
    );
    if (viewMatchingPath) return viewMatchingPath;
    
    const viewMatchingTitle = availableViews.find(view => 
      typeof view?.title === 'string' && 
      String(view.title).toLowerCase() === String(targetViewPath).toLowerCase()
    );
    
    return viewMatchingTitle || availableViews[0];
  }

  private static _extractLcarsCardFromView(viewNode: any): any | undefined {
    if (!viewNode || typeof viewNode !== 'object') return undefined;

    const nodeType = typeof viewNode.type === 'string' ? viewNode.type : '';
    const matchesLcarsCardType = nodeType === CARD_TYPE || nodeType === `custom:${CARD_TYPE}`;
    if (matchesLcarsCardType) return viewNode;

    const cardCollections = Array.isArray(viewNode.cards) 
      ? viewNode.cards 
      : Array.isArray(viewNode['rootCards']) 
        ? viewNode['rootCards'] 
        : undefined;
        
    if (cardCollections && Array.isArray(cardCollections)) {
      for (const cardNode of cardCollections) {
        const foundCard = this._extractLcarsCardFromView(cardNode);
        if (foundCard) return foundCard;
      }
    }
    
    if (viewNode.card && typeof viewNode.card === 'object') {
      const foundCard = this._extractLcarsCardFromView(viewNode.card);
      if (foundCard) return foundCard;
    }
    
    return undefined;
  }

  private static _getCurrentTime(): number {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  private static async _waitForNextAnimationFrame(): Promise<void> {
    return new Promise<void>(resolve => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 16);
      }
    });
  }
}
