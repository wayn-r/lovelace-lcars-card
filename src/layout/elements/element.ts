import { LayoutElementProps, LayoutState, IntrinsicSize, LayoutConfigOptions } from "../engine";
import { HomeAssistant } from "custom-card-helpers";
import { gsap } from "gsap";
import { generateRectanglePath, generateEndcapPath, generateElbowPath, generateChiselEndcapPath, getTextWidth, measureTextBBox, getFontMetrics } from '../../utils/shapes.js';
import { SVGTemplateResult } from 'lit';
import { LcarsButtonElementConfig } from '../../lovelace-lcars-card.js';
import { StretchContext } from '../engine.js';
import { Button } from './button.js';
import { ColorValue, DynamicColorConfig, isDynamicColorConfig } from '../../types';
import { animationManager, AnimationContext } from '../../utils/animation.js';
import { colorResolver, ComputedElementColors, ColorResolutionDefaults } from '../../utils/color-resolver.js';

export abstract class LayoutElement {
    id: string;
    props: LayoutElementProps;
    layoutConfig: LayoutConfigOptions;
    layout: LayoutState;
    intrinsicSize: IntrinsicSize;
    hass?: HomeAssistant;
    public requestUpdateCallback?: () => void;
    public button?: Button;
    public getShadowElement?: (id: string) => Element | null;

    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        this.id = id;
        this.props = props;
        this.layoutConfig = layoutConfig;
        this.hass = hass;
        this.requestUpdateCallback = requestUpdateCallback;
        this.getShadowElement = getShadowElement;

        // Initialize animation state for this element
        animationManager.initializeElementAnimationTracking(id);

        // Initialize button if button config exists
        if (props.button?.enabled) {
            this.button = new Button(id, props, hass, requestUpdateCallback, getShadowElement);
        }

        this.resetLayout();
        this.intrinsicSize = { width: 0, height: 0, calculated: false };
    }

    resetLayout(): void {
        this.layout = { x: 0, y: 0, width: 0, height: 0, calculated: false };
    }

    calculateIntrinsicSize(container: SVGElement): void {
        this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 0;
        this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0;
        this.intrinsicSize.calculated = true;
    }

    canCalculateLayout(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        if (!this._checkAnchorDependencies(elementsMap, dependencies)) return false;
        if (!this._checkStretchDependencies(elementsMap, dependencies)) return false;
        if (!this._checkSpecialDependencies(elementsMap, dependencies)) return false;

        return true;
    }

    private _checkAnchorDependencies(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        if (this.layoutConfig.anchor?.anchorTo && this.layoutConfig.anchor.anchorTo !== 'container') {
            const targetElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
            if (!targetElement || !targetElement.layout.calculated) {
                dependencies.push(this.layoutConfig.anchor.anchorTo);
                return false;
            }
        }
        return true;
    }

    private _checkStretchDependencies(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        if (this.layoutConfig.stretch?.stretchTo1 && 
            this.layoutConfig.stretch.stretchTo1 !== 'canvas' && 
            this.layoutConfig.stretch.stretchTo1 !== 'container') {
            
            const targetElement = elementsMap.get(this.layoutConfig.stretch.stretchTo1);
            if (!targetElement || !targetElement.layout.calculated) {
                dependencies.push(this.layoutConfig.stretch.stretchTo1);
                return false;
            }
        }
        
        if (this.layoutConfig.stretch?.stretchTo2 && 
            this.layoutConfig.stretch.stretchTo2 !== 'canvas' && 
            this.layoutConfig.stretch.stretchTo2 !== 'container') {
            
            const targetElement = elementsMap.get(this.layoutConfig.stretch.stretchTo2);
            if (!targetElement || !targetElement.layout.calculated) {
                dependencies.push(this.layoutConfig.stretch.stretchTo2);
                return false;
            }
        }
        
        return true;
    }

    private _checkSpecialDependencies(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        if (this.constructor.name === 'EndcapElement' && 
            this.layoutConfig.anchor?.anchorTo && 
            this.layoutConfig.anchor.anchorTo !== 'container' && 
            !this.props.height) {
            
            const targetElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
            if (!targetElement || !targetElement.layout.calculated) {
                dependencies.push(this.layoutConfig.anchor.anchorTo);
                return false;
            }
        }
        return true;
    }

    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
        const { width: containerWidth, height: containerHeight } = containerRect;
        let elementWidth = this._calculateElementWidth(containerWidth);
        let elementHeight = this._calculateElementHeight(containerHeight);

        let { x, y } = this._calculateInitialPosition(elementsMap, containerWidth, containerHeight, elementWidth, elementHeight);

        if (this.layoutConfig.stretch) {
            const stretchContext: StretchContext = {
                x,
                y,
                width: elementWidth,
                height: elementHeight,
                elementsMap,
                containerWidth,
                containerHeight
            };
            
            this._applyStretchConfigurations(stretchContext);
            
            x = stretchContext.x;
            y = stretchContext.y;
            elementWidth = stretchContext.width;
            elementHeight = stretchContext.height;
        }

        this._finalizeLayout(x, y, elementWidth, elementHeight);
    }

    private _calculateElementWidth(containerWidth: number): number {
        let width = this.intrinsicSize.width;
        if (typeof this.layoutConfig.width === 'string' && this.layoutConfig.width.endsWith('%')) {
            width = containerWidth * (parseFloat(this.layoutConfig.width) / 100);
        }
        return width;
    }

    private _calculateElementHeight(containerHeight: number): number {
        let height = this.intrinsicSize.height;
        if (typeof this.layoutConfig.height === 'string' && this.layoutConfig.height.endsWith('%')) {
            height = containerHeight * (parseFloat(this.layoutConfig.height) / 100);
        }
        return height;
    }

    private _calculateInitialPosition(
        elementsMap: Map<string, LayoutElement>, 
        containerWidth: number, 
        containerHeight: number,
        elementWidth: number,
        elementHeight: number
    ): { x: number, y: number } {
        let x = 0;
        let y = 0;

        const anchorConfig = this.layoutConfig.anchor;
        const anchorTo = anchorConfig?.anchorTo;
        const anchorPoint = anchorConfig?.anchorPoint || 'topLeft';
        const targetAnchorPoint = anchorConfig?.targetAnchorPoint || 'topLeft';

        if (!anchorTo || anchorTo === 'container') {
            const { x: elementX, y: elementY } = this._anchorToContainer(
                anchorPoint, 
                targetAnchorPoint, 
                elementWidth, 
                elementHeight, 
                containerWidth, 
                containerHeight
            );
            x = elementX;
            y = elementY;
        } else {
            const result = this._anchorToElement(
                anchorTo, 
                anchorPoint, 
                targetAnchorPoint, 
                elementWidth, 
                elementHeight, 
                elementsMap
            );
            
            if (!result) {
                this.layout.calculated = false;
                return { x, y };
            }
            
            x = result.x;
            y = result.y;
        }

        x += this._parseOffset(this.layoutConfig.offsetX, containerWidth);
        y += this._parseOffset(this.layoutConfig.offsetY, containerHeight);

        return { x, y };
    }

    private _anchorToContainer(
        anchorPoint: string, 
        targetAnchorPoint: string, 
        elementWidth: number, 
        elementHeight: number, 
        containerWidth: number, 
        containerHeight: number
    ): { x: number, y: number } {
        const elementAnchorPos = this._getRelativeAnchorPosition(anchorPoint, elementWidth, elementHeight);
        const containerTargetPos = this._getRelativeAnchorPosition(targetAnchorPoint, containerWidth, containerHeight); 

        const x = containerTargetPos.x - elementAnchorPos.x;
        const y = containerTargetPos.y - elementAnchorPos.y;

        return { x, y };
    }

    private _anchorToElement(
        anchorTo: string,
        anchorPoint: string,
        targetAnchorPoint: string,
        elementWidth: number,
        elementHeight: number,
        elementsMap: Map<string, LayoutElement>
    ): { x: number, y: number } | null {
        const targetElement = elementsMap.get(anchorTo);
        if (!targetElement || !targetElement.layout.calculated) {
            console.warn(`[${this.id}] Anchor target '${anchorTo}' not found or not calculated yet.`);
            return null;
        }

        const elementAnchorPos = this._getRelativeAnchorPosition(anchorPoint, elementWidth, elementHeight);
        const targetElementPos = targetElement._getRelativeAnchorPosition(targetAnchorPoint);

        const x = targetElement.layout.x + targetElementPos.x - elementAnchorPos.x;
        const y = targetElement.layout.y + targetElementPos.y - elementAnchorPos.y;

        return { x, y };
    }

    private _applyStretchConfigurations(context: StretchContext): void {
        const stretchConfig = this.layoutConfig.stretch;
        if (!stretchConfig) return;
        
        this._processSingleStretch(
            stretchConfig.stretchTo1, 
            stretchConfig.targetStretchAnchorPoint1, 
            stretchConfig.stretchPadding1,
            context
        );

        this._processSingleStretch(
            stretchConfig.stretchTo2, 
            stretchConfig.targetStretchAnchorPoint2, 
            stretchConfig.stretchPadding2,
            context
        );
    }

    private _finalizeLayout(x: number, y: number, width: number, height: number): void {
        this.layout.x = x;
        this.layout.y = y;
        this.layout.width = Math.max(1, width);
        this.layout.height = Math.max(1, height);
        this.layout.calculated = true;
    }

    private _processSingleStretch(
        stretchTo: string | undefined, 
        targetStretchAnchorPoint: string | undefined, 
        stretchPadding: number | undefined,
        context: StretchContext
    ): void {
        if (!stretchTo || !targetStretchAnchorPoint) return;
        
        const padding = stretchPadding ?? 0;
        const isHorizontal = this._isHorizontalStretch(targetStretchAnchorPoint);
        
        if (isHorizontal) {
            this._applyHorizontalStretch(context, stretchTo, targetStretchAnchorPoint, padding);
        } else {
            this._applyVerticalStretch(context, stretchTo, targetStretchAnchorPoint, padding);
        }
    }

    private _isHorizontalStretch(targetStretchAnchorPoint: string): boolean {
        return ['left', 'right'].some(dir => targetStretchAnchorPoint.toLowerCase().includes(dir));
    }

    private _applyHorizontalStretch(
        context: StretchContext,
        stretchTo: string,
        targetStretchAnchorPoint: string,
        padding: number
    ): void {
        const { x: stretchedX, size: stretchedWidth } = this._applyStretch(
            context.x, 
            context.width, 
            true,
            stretchTo,
            targetStretchAnchorPoint,
            padding,
            context.elementsMap,
            context.containerWidth
        );
        
        if (stretchedX !== undefined) context.x = stretchedX;
        context.width = stretchedWidth;
    }

    private _applyVerticalStretch(
        context: StretchContext,
        stretchTo: string,
        targetStretchAnchorPoint: string,
        padding: number
    ): void {
        const { y: stretchedY, size: stretchedHeight } = this._applyStretch(
            context.y, 
            context.height, 
            false,
            stretchTo,
            targetStretchAnchorPoint,
            padding,
            context.elementsMap,
            context.containerHeight
        );
        
        if (stretchedY !== undefined) context.y = stretchedY;
        context.height = stretchedHeight;
    }

    private _getTargetCoordinate(
        stretchTargetId: string, 
        targetAnchorPoint: string, 
        isHorizontal: boolean,
        elementsMap: Map<string, LayoutElement>,
        containerSize: number
    ): number | null {
        if (stretchTargetId === 'container') {
            return this._getContainerEdgeCoordinate(targetAnchorPoint, isHorizontal, containerSize);
        } else {
            return this._getElementEdgeCoordinate(stretchTargetId, targetAnchorPoint, isHorizontal, elementsMap);
        }
    }

    private _getContainerEdgeCoordinate(
        targetAnchorPoint: string, 
        isHorizontal: boolean, 
        containerSize: number
    ): number {
        if (isHorizontal) {
            if (targetAnchorPoint === 'left' || targetAnchorPoint.includes('Left')) return 0;
            if (targetAnchorPoint === 'right' || targetAnchorPoint.includes('Right')) return containerSize;
            if (targetAnchorPoint === 'center' || targetAnchorPoint.includes('Center')) return containerSize / 2;
            return containerSize;
        } else {
            if (targetAnchorPoint === 'top' || targetAnchorPoint.includes('Top')) return 0;
            if (targetAnchorPoint === 'bottom' || targetAnchorPoint.includes('Bottom')) return containerSize;
            if (targetAnchorPoint === 'center' || targetAnchorPoint.includes('Center')) return containerSize / 2;
            return containerSize;
        }
    }

    private _getElementEdgeCoordinate(
        stretchTargetId: string,
        targetAnchorPoint: string,
        isHorizontal: boolean,
        elementsMap: Map<string, LayoutElement>
    ): number | null {
        const targetElement = elementsMap.get(stretchTargetId);
        if (!targetElement || !targetElement.layout.calculated) {
            console.warn(`[${this.id}] Stretch target '${stretchTargetId}' not found or not calculated yet.`);
            return null; 
        }
        
        const anchorPointToUse = this._mapSimpleDirectionToAnchorPoint(targetAnchorPoint, isHorizontal);
        const targetRelativePos = targetElement._getRelativeAnchorPosition(anchorPointToUse);
        
        return isHorizontal
            ? targetElement.layout.x + targetRelativePos.x
            : targetElement.layout.y + targetRelativePos.y;
    }

    private _mapSimpleDirectionToAnchorPoint(direction: string, isHorizontal: boolean): string {
        if (isHorizontal) {
            if (direction === 'left') return 'centerLeft';
            if (direction === 'right') return 'centerRight';
            if (direction === 'center') return 'center';
        } else {
            if (direction === 'top') return 'topCenter';
            if (direction === 'bottom') return 'bottomCenter';
            if (direction === 'center') return 'center';
        }
        return direction;
    }

    private _applyStretch(
        initialPosition: number, 
        initialSize: number, 
        isHorizontal: boolean,
        stretchTo: string,
        targetAnchorPoint: string,
        padding: number,
        elementsMap: Map<string, LayoutElement>,
        containerSize: number
    ): { x?: number, y?: number, size: number } {
        
        const targetCoord = this._getTargetCoordinate(
            stretchTo, 
            targetAnchorPoint, 
            isHorizontal, 
            elementsMap, 
            containerSize
        );

        if (targetCoord === null) {
            return isHorizontal ? { x: initialPosition, size: initialSize } : { y: initialPosition, size: initialSize };
        }

        const myAnchorPoint = this._getAnchorAwareStretchEdge(initialPosition, initialSize, targetCoord, isHorizontal);
        const myRelativePos = this._getRelativeAnchorPosition(myAnchorPoint, initialSize, initialSize);
        const currentCoord = initialPosition + (isHorizontal ? myRelativePos.x : myRelativePos.y);
        
        let delta = targetCoord - currentCoord;
        delta = this._applyPadding(delta, myAnchorPoint, padding, containerSize);
        
        const result = this._applyStretchToEdge(
            initialPosition, 
            initialSize, 
            delta, 
            myAnchorPoint, 
            isHorizontal
        );
        
        return result;
    }

    private _applyPadding(
        delta: number, 
        anchorPoint: string, 
        padding: number, 
        containerSize: number
    ): number {
        const paddingOffset = this._parseOffset(padding, containerSize);
        
        if (anchorPoint.includes('Left') || anchorPoint.includes('Top')) {
            return delta - paddingOffset;
        } else {
            return delta + paddingOffset;
        }
    }

    private _applyStretchToEdge(
        initialPosition: number,
        initialSize: number,
        delta: number,
        anchorPoint: string,
        isHorizontal: boolean
    ): { x?: number, y?: number, size: number } {
        let newPosition = initialPosition;
        let newSize = initialSize;
        
        if (isHorizontal) {
            if (anchorPoint === 'centerRight') {
                newSize += delta;
            } else {
                if (delta < initialSize) {
                    newPosition += delta;
                    newSize -= delta;
                } else {
                    newPosition += initialSize - 1;
                    newSize = 1;
                }
            }
            
            newSize = Math.max(1, newSize);
            return { x: newPosition, size: newSize };
        } else {
            if (anchorPoint === 'bottomCenter') {
                newSize += delta;
            } else {
                if (delta < initialSize) {
                    newPosition += delta;
                    newSize -= delta;
                } else {
                    newPosition += initialSize - 1;
                    newSize = 1;
                }
            }
            
            newSize = Math.max(1, newSize);
            return { y: newPosition, size: newSize };
        }
    }

    private _getCloserEdge(
        initialPosition: number, 
        initialSize: number, 
        targetCoord: number, 
        isHorizontal: boolean
    ): string {
        if (isHorizontal) {
            const leftEdge = initialPosition;
            const rightEdge = initialPosition + initialSize;
            return (Math.abs(targetCoord - leftEdge) <= Math.abs(targetCoord - rightEdge)) ? 'centerLeft' : 'centerRight';
        } else {
            const topEdge = initialPosition;
            const bottomEdge = initialPosition + initialSize;
            return (Math.abs(targetCoord - topEdge) <= Math.abs(targetCoord - bottomEdge)) ? 'topCenter' : 'bottomCenter';
        }
    }

    private _getAnchorAwareStretchEdge(
        initialPosition: number, 
        initialSize: number, 
        targetCoord: number, 
        isHorizontal: boolean
    ): string {
        // Check if this element has an anchor configuration
        const anchorConfig = this.layoutConfig.anchor;
        
        if (anchorConfig?.anchorTo && anchorConfig.anchorTo !== 'container') {
            // Element is anchored to another element - preserve the anchored edge
            const anchorPoint = anchorConfig.anchorPoint || 'topLeft';
            
            if (isHorizontal) {
                // If anchored on the right side, stretch from left
                if (anchorPoint.includes('Right')) {
                    return 'centerLeft';
                }
                // If anchored on the left side, stretch from right  
                if (anchorPoint.includes('Left')) {
                    return 'centerRight';
                }
                // If anchored in center, use distance-based logic
                return this._getCloserEdge(initialPosition, initialSize, targetCoord, isHorizontal);
            } else {
                // If anchored at the bottom, stretch from top
                if (anchorPoint.includes('bottom')) {
                    return 'topCenter';
                }
                // If anchored at the top, stretch from bottom
                if (anchorPoint.includes('top')) {
                    return 'bottomCenter';
                }
                // If anchored in center, use distance-based logic
                return this._getCloserEdge(initialPosition, initialSize, targetCoord, isHorizontal);
            }
        }
        
        // No anchor constraint or anchored to container - use original distance-based logic
        return this._getCloserEdge(initialPosition, initialSize, targetCoord, isHorizontal);
    }

    private _parseOffset(offset: string | number | undefined, containerDimension: number): number {
        if (offset === undefined) return 0;
        if (typeof offset === 'number') return offset;
        if (typeof offset === 'string') {
            if (offset.endsWith('%')) {
                return (parseFloat(offset) / 100) * containerDimension;
            }
            return parseFloat(offset);
        }
        return 0;
    }

    _getRelativeAnchorPosition(anchorPoint: string, width?: number, height?: number): { x: number; y: number } {
        const w = width !== undefined ? width : this.layout.width;
        const h = height !== undefined ? height : this.layout.height;
        
        switch (anchorPoint) {
            case 'topLeft': return { x: 0, y: 0 };
            case 'topCenter': return { x: w / 2, y: 0 };
            case 'topRight': return { x: w, y: 0 };
            case 'centerLeft': return { x: 0, y: h / 2 };
            case 'center': return { x: w / 2, y: h / 2 };
            case 'centerRight': return { x: w, y: h / 2 };
            case 'bottomLeft': return { x: 0, y: h };
            case 'bottomCenter': return { x: w / 2, y: h };
            case 'bottomRight': return { x: w, y: h };
            default: 
                console.warn(`Unknown anchor point: ${anchorPoint}. Defaulting to topLeft.`);
                return { x: 0, y: 0 };
        }
    }

    abstract render(): SVGTemplateResult | null;

    animate(property: string, value: any, duration: number = 0.5): void {
        if (!this.layout.calculated) return;
        animationManager.animateElementProperty(this.id, property, value, duration, this.getShadowElement);
    }

    /**
     * Resolve and animate color if it's dynamic, return color for template
     */
    protected _resolveDynamicColorWithAnimation(colorConfig: ColorValue, property: 'fill' | 'stroke' = 'fill'): string | undefined {
        const context: AnimationContext = {
            elementId: this.id,
            getShadowElement: this.getShadowElement,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdateCallback
        };
        
        return animationManager.resolveDynamicColorWithAnimation(this.id, colorConfig, property, context);
    }

    /**
     * Resolve all element colors (fill, stroke, strokeWidth) with animation support
     * This is the preferred method for getting all colors at once
     */
    protected _resolveElementColors(options: ColorResolutionDefaults = {}): ComputedElementColors {
        const context: AnimationContext = {
            elementId: this.id,
            getShadowElement: this.getShadowElement,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdateCallback
        };
        
        return colorResolver.resolveAllElementColors(this.id, this.props, context, options);
    }

    /**
     * Create resolved props for button elements
     * This handles the common pattern where buttons need a modified props object
     */
    protected _createResolvedPropsForButton(): any {
        const context: AnimationContext = {
            elementId: this.id,
            getShadowElement: this.getShadowElement,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdateCallback
        };
        
        return colorResolver.createButtonPropsWithResolvedColors(this.id, this.props, context);
    }

    /**
     * Resolve a color value that might be static or dynamic (entity-based)
     */
    protected _resolveDynamicColor(colorConfig: ColorValue): string | undefined {
        return animationManager.resolveDynamicColor(this.id, colorConfig, this.hass);
    }

    /**
     * Check if any monitored entities have changed and trigger update if needed
     */
    public checkEntityChanges(hass: HomeAssistant): boolean {
        return animationManager.checkForEntityStateChanges(this.id, hass);
    }

    /**
     * Clear monitored entities (called before recalculating dynamic colors)
     */
    public clearMonitoredEntities(): void {
        animationManager.clearTrackedEntitiesForElement(this.id);
    }

    /**
     * Clean up any ongoing animations
     */
    public cleanupAnimations(): void {
        animationManager.stopAllAnimationsForElement(this.id);
    }

    updateHass(hass?: HomeAssistant): void {
        this.hass = hass;
        if (this.button) {
            this.button.updateHass(hass);
        }
    }
} 