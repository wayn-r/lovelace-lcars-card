import { LayoutElementProps, LayoutState, IntrinsicSize, LayoutConfigOptions } from "../engine";
import { HomeAssistant } from "custom-card-helpers";
import { SVGTemplateResult, svg } from 'lit';
import { StretchContext } from '../engine.js';
import { Button } from '../../utils/button.js';
import { ColorValue } from '../../types';
import { animationManager, AnimationContext } from '../../utils/animation.js';
import { colorResolver } from '../../utils/color-resolver.js';
import { ComputedElementColors, ColorResolutionDefaults } from '../../utils/color.js';
import { OffsetCalculator } from '../../utils/offset-calculator.js';

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
    protected containerRect?: DOMRect;
    
    private isHovering = false;
    private isActive = false;
    private hoverTimeout?: ReturnType<typeof setTimeout>;
    private activeTimeout?: ReturnType<typeof setTimeout>;

    private readonly boundHandleMouseEnter: () => void;
    private readonly boundHandleMouseLeave: () => void;
    private readonly boundHandleMouseDown: () => void;
    private readonly boundHandleMouseUp: () => void;
    private readonly boundHandleTouchStart: () => void;
    private readonly boundHandleTouchEnd: () => void;
    private readonly boundHandleTouchCancel: () => void;

    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        this.id = id;
        this.props = props;
        this.layoutConfig = layoutConfig;
        this.hass = hass;
        this.requestUpdateCallback = requestUpdateCallback;
        this.getShadowElement = getShadowElement;

        this.boundHandleMouseEnter = this.handleMouseEnter.bind(this);
        this.boundHandleMouseLeave = this.handleMouseLeave.bind(this);
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);
        this.boundHandleTouchStart = this.handleTouchStart.bind(this);
        this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
        this.boundHandleTouchCancel = this.handleTouchCancel.bind(this);

        animationManager.initializeElementAnimationTracking(id);

        if (props.button?.enabled) {
            this.button = new Button(id, props, hass, requestUpdateCallback, getShadowElement);
        }

        this.resetLayout();
        this.intrinsicSize = { width: 0, height: 0, calculated: false };
    }

    get elementIsHovering(): boolean {
        return this.isHovering;
    }

    set elementIsHovering(value: boolean) {
        if (this.isHovering !== value) {
            this.isHovering = value;
            
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
                this.hoverTimeout = undefined;
            }
            
            this.requestUpdateCallback?.();
        }
    }

    get elementIsActive(): boolean {
        return this.isActive;
    }

    set elementIsActive(value: boolean) {
        if (this.isActive !== value) {
            this.isActive = value;
            
            if (this.activeTimeout) {
                clearTimeout(this.activeTimeout);
                this.activeTimeout = undefined;
            }
            
            this.requestUpdateCallback?.();
        }
    }

    protected getStateContext() {
        return {
            isCurrentlyHovering: this.isHovering,
            isCurrentlyActive: this.isActive
        };
    }

    protected hasStatefulColors(): boolean {
        const { fill, stroke, textColor } = this.props;
        return this.colorIsStateful(fill) || 
               this.colorIsStateful(stroke) || 
               this.colorIsStateful(textColor);
    }

    private colorIsStateful(color: any): boolean {
        return Boolean(color && typeof color === 'object' && 
                      ('default' in color || 'hover' in color || 'active' in color) &&
                      !('entity' in color) && !('mapping' in color));
    }

    setupInteractiveListeners(): void {
        if (!this.getShadowElement) {
            return;
        }

        this.cleanupInteractiveListeners();

        const element = this.getShadowElement(this.id);
        if (!element) {
            return;
        }

        const hasInteractiveFeatures = this.hasStatefulColors() || 
                                     this.hasButtonConfig() ||
                                     this.hasAnimations();

        if (hasInteractiveFeatures) {
            element.addEventListener('mouseenter', this.boundHandleMouseEnter, { passive: false });
            element.addEventListener('mouseleave', this.boundHandleMouseLeave, { passive: false });
            element.addEventListener('mousedown', this.boundHandleMouseDown, { passive: false });
            element.addEventListener('mouseup', this.boundHandleMouseUp, { passive: false });
            element.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
            element.addEventListener('touchend', this.boundHandleTouchEnd, { passive: true });
            element.addEventListener('touchcancel', this.boundHandleTouchCancel, { passive: true });
        }
    }

    private handleMouseEnter(): void {
        this.elementIsHovering = true;
    }

    private handleMouseLeave(): void {
        this.elementIsHovering = false;
        this.elementIsActive = false;
    }

    private handleMouseDown(): void {
        this.elementIsActive = true;
    }

    private handleMouseUp(): void {
        this.elementIsActive = false;
    }

    private handleTouchStart(): void {
        this.elementIsHovering = true;
        this.elementIsActive = true;
    }

    private handleTouchEnd(): void {
        this.elementIsHovering = false;
        this.elementIsActive = false;
    }

    private handleTouchCancel(): void {
        this.elementIsHovering = false;
        this.elementIsActive = false;
    }

    private cleanupInteractiveListeners(): void {
        const element = this.getShadowElement?.(this.id);
        if (!element) return;

        element.removeEventListener('mouseenter', this.boundHandleMouseEnter);
        element.removeEventListener('mouseleave', this.boundHandleMouseLeave);
        element.removeEventListener('mousedown', this.boundHandleMouseDown);
        element.removeEventListener('mouseup', this.boundHandleMouseUp);
        element.removeEventListener('touchstart', this.boundHandleTouchStart);
        element.removeEventListener('touchend', this.boundHandleTouchEnd);
        element.removeEventListener('touchcancel', this.boundHandleTouchEnd);
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
        return this.checkAnchorDependencies(elementsMap, dependencies) &&
               this.checkStretchDependencies(elementsMap, dependencies) &&
               this.checkSpecialDependencies(elementsMap, dependencies);
    }

    private checkAnchorDependencies(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        const anchorTo = this.layoutConfig.anchor?.anchorTo;
        if (!anchorTo || anchorTo === 'container') return true;
        if (dependencies.includes(anchorTo)) return false;

        const anchorTarget = elementsMap.get(anchorTo);
        if (!anchorTarget) {
            console.warn(`Element '${this.id}' anchor target '${anchorTo}' not found in elements map`);
            dependencies.push(anchorTo);
            return false;
        }

        if (!anchorTarget.layout.calculated) {
            dependencies.push(anchorTo);
            return false;
        }

        return true;
    }

    private checkStretchDependencies(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        return this.validateStretchTarget(this.layoutConfig.stretch?.stretchTo1, 'stretch target1', elementsMap, dependencies) &&
               this.validateStretchTarget(this.layoutConfig.stretch?.stretchTo2, 'stretch target2', elementsMap, dependencies);
    }

    private validateStretchTarget(stretchTo: string | undefined, targetName: string, elementsMap: Map<string, LayoutElement>, dependencies: string[]): boolean {
        if (!stretchTo || stretchTo === 'container' || stretchTo === 'canvas') return true;
        if (dependencies.includes(stretchTo)) return false;

        const stretchTarget = elementsMap.get(stretchTo);
        if (!stretchTarget) {
            console.warn(`Element '${this.id}' ${targetName} '${stretchTo}' not found in elements map`);
            dependencies.push(stretchTo);
            return false;
        }

        if (!stretchTarget.layout.calculated) {
            dependencies.push(stretchTo);
            return false;
        }

        return true;
    }

    private checkSpecialDependencies(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        return true;
    }

    public calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
        if (this.layout.calculated) return;

        this.containerRect = containerRect;

        const { width, height } = this.intrinsicSize;
        let x = this.parseLayoutOffset(this.layoutConfig.offsetX, containerRect.width) || 0;
        let y = this.parseLayoutOffset(this.layoutConfig.offsetY, containerRect.height) || 0;

        const elementWidth = this.calculateElementWidth(containerRect.width);
        const elementHeight = this.calculateElementHeight(containerRect.height);

        const initialPosition = this.calculateInitialPosition(
            elementsMap,
            containerRect.width,
            containerRect.height,
            elementWidth,
            elementHeight
        );

        const context: StretchContext = {
            elementsMap,
            containerWidth: containerRect.width,
            containerHeight: containerRect.height,
            x: initialPosition.x,
            y: initialPosition.y,
            width: elementWidth,
            height: elementHeight
        };

        this.applyStretchConfigurations(context);
        this.finalizeLayout(context.x, context.y, context.width, context.height);
    }

    private calculateElementWidth(containerWidth: number): number {
        let width = this.intrinsicSize.width;
        if (typeof this.layoutConfig.width === 'string' && this.layoutConfig.width.endsWith('%')) {
            width = containerWidth * (parseFloat(this.layoutConfig.width) / 100);
        }
        return width;
    }

    private calculateElementHeight(containerHeight: number): number {
        let height = this.intrinsicSize.height;
        if (typeof this.layoutConfig.height === 'string' && this.layoutConfig.height.endsWith('%')) {
            height = containerHeight * (parseFloat(this.layoutConfig.height) / 100);
        }
        return height;
    }

    private calculateInitialPosition(
        elementsMap: Map<string, LayoutElement>, 
        containerWidth: number, 
        containerHeight: number,
        elementWidth: number,
        elementHeight: number
    ): { x: number, y: number } {
        const anchorConfig = this.layoutConfig.anchor;
        const anchorTo = anchorConfig?.anchorTo;
        const anchorPoint = anchorConfig?.anchorPoint || 'topLeft';
        const targetAnchorPoint = anchorConfig?.targetAnchorPoint || 'topLeft';

        let x = 0;
        let y = 0;

        if (!anchorTo || anchorTo === 'container') {
            const { x: elementX, y: elementY } = this.anchorToContainer(
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
            const result = this.anchorToElement(
                anchorTo,
                anchorPoint,
                targetAnchorPoint,
                elementWidth,
                elementHeight,
                elementsMap
            );

            if (!result) {
                console.warn(`Anchor target '${anchorTo}' not found or not calculated yet.`);
                x = 0;
                y = 0;
            } else {
                x = result.x;
                y = result.y;
            }
        }

        x += this.parseLayoutOffset(this.layoutConfig.offsetX, containerWidth);
        y += this.parseLayoutOffset(this.layoutConfig.offsetY, containerHeight);

        return { x, y };
    }

    private anchorToContainer(
        anchorPoint: string, 
        targetAnchorPoint: string, 
        elementWidth: number, 
        elementHeight: number, 
        containerWidth: number, 
        containerHeight: number
    ): { x: number, y: number } {
        const targetPos = this.getRelativeAnchorPosition(targetAnchorPoint, containerWidth, containerHeight);
        const elementAnchorPos = this.getRelativeAnchorPosition(anchorPoint, elementWidth, elementHeight);
        
        return {
            x: targetPos.x - elementAnchorPos.x,
            y: targetPos.y - elementAnchorPos.y
        };
    }

    private anchorToElement(
        anchorTo: string,
        anchorPoint: string,
        targetAnchorPoint: string,
        elementWidth: number,
        elementHeight: number,
        elementsMap: Map<string, LayoutElement>
    ): { x: number, y: number } | null {
        const targetElement = elementsMap.get(anchorTo);
        if (!targetElement || !targetElement.layout.calculated) {
            return null;
        }

        const targetLayout = targetElement.layout;
        const targetPos = this.getRelativeAnchorPosition(targetAnchorPoint, targetLayout.width, targetLayout.height);
        const elementAnchorPos = this.getRelativeAnchorPosition(anchorPoint, elementWidth, elementHeight);

        return {
            x: targetLayout.x + targetPos.x - elementAnchorPos.x,
            y: targetLayout.y + targetPos.y - elementAnchorPos.y
        };
    }

    private applyStretchConfigurations(context: StretchContext): void {
        const stretchConfig = this.layoutConfig.stretch;
        if (!stretchConfig) return;

        this.processSingleStretch(
            stretchConfig.stretchTo1,
            stretchConfig.targetStretchAnchorPoint1,
            stretchConfig.stretchPadding1,
            context
        );

        this.processSingleStretch(
            stretchConfig.stretchTo2,
            stretchConfig.targetStretchAnchorPoint2,
            stretchConfig.stretchPadding2,
            context
        );
    }

    private finalizeLayout(x: number, y: number, width: number, height: number): void {
        this.layout.x = x;
        this.layout.y = y;
        this.layout.width = Math.max(1, width);
        this.layout.height = Math.max(1, height);
        this.layout.calculated = true;
    }

    private processSingleStretch(
        stretchTo: string | undefined, 
        targetStretchAnchorPoint: string | undefined, 
        stretchPadding: number | undefined,
        context: StretchContext
    ): void {
        if (!stretchTo || !targetStretchAnchorPoint) return;

        const padding = stretchPadding || 0;
        const isHorizontal = this.stretchIsHorizontal(targetStretchAnchorPoint);

        if (isHorizontal) {
            this.applyHorizontalStretch(context, stretchTo, targetStretchAnchorPoint, padding);
        } else {
            this.applyVerticalStretch(context, stretchTo, targetStretchAnchorPoint, padding);
        }
    }

    private stretchIsHorizontal(targetStretchAnchorPoint: string): boolean {
        return ['left', 'right', 'centerLeft', 'centerRight'].includes(targetStretchAnchorPoint);
    }

    private applyHorizontalStretch(
        context: StretchContext,
        stretchTo: string,
        targetStretchAnchorPoint: string,
        padding: number
    ): void {
        const targetCoord = this.getTargetCoordinate(
            stretchTo, 
            targetStretchAnchorPoint, 
            true, 
            context.elementsMap, 
            context.containerWidth
        );

        if (targetCoord !== null) {
            const result = this.applyStretch(
                context.x, 
                context.width, 
                true,
                stretchTo,
                targetStretchAnchorPoint,
                padding,
                context.elementsMap,
                context.containerWidth
            );
            context.x = result.x !== undefined ? result.x : context.x;
            context.width = result.size;
        }
    }

    private applyVerticalStretch(
        context: StretchContext,
        stretchTo: string,
        targetStretchAnchorPoint: string,
        padding: number
    ): void {
        const targetCoord = this.getTargetCoordinate(
            stretchTo, 
            targetStretchAnchorPoint, 
            false, 
            context.elementsMap, 
            context.containerHeight
        );

        if (targetCoord !== null) {
            const result = this.applyStretch(
                context.y, 
                context.height, 
                false,
                stretchTo,
                targetStretchAnchorPoint,
                padding,
                context.elementsMap,
                context.containerHeight
            );
            context.y = result.y !== undefined ? result.y : context.y;
            context.height = result.size;
        }
    }

    private getTargetCoordinate(
        stretchTargetId: string, 
        targetAnchorPoint: string, 
        isHorizontal: boolean,
        elementsMap: Map<string, LayoutElement>,
        containerSize: number
    ): number | null {
        if (stretchTargetId === 'container' || stretchTargetId === 'canvas') {
            return this.getContainerEdgeCoordinate(targetAnchorPoint, isHorizontal, containerSize);
        } else {
            return this.getElementEdgeCoordinate(stretchTargetId, targetAnchorPoint, isHorizontal, elementsMap);
        }
    }

    private getContainerEdgeCoordinate(
        targetAnchorPoint: string, 
        isHorizontal: boolean, 
        containerSize: number
    ): number {
        const mappedAnchorPoint = this.mapSimpleDirectionToAnchorPoint(targetAnchorPoint, isHorizontal);
        
        const position = this.getRelativeAnchorPosition(
            mappedAnchorPoint, 
            isHorizontal ? containerSize : 0, 
            isHorizontal ? 0 : containerSize
        );
        
        return isHorizontal ? position.x : position.y;
    }

    private getElementEdgeCoordinate(
        stretchTargetId: string,
        targetAnchorPoint: string,
        isHorizontal: boolean,
        elementsMap: Map<string, LayoutElement>
    ): number | null {
        const targetElement = elementsMap.get(stretchTargetId);
        if (!targetElement || !targetElement.layout.calculated) {
            console.warn(`Stretch target '${stretchTargetId}' not found or not calculated yet.`);
            return null;
        }

        const targetLayout = targetElement.layout;
        const mappedAnchorPoint = this.mapSimpleDirectionToAnchorPoint(targetAnchorPoint, isHorizontal);
        const relativePos = this.getRelativeAnchorPosition(mappedAnchorPoint, targetLayout.width, targetLayout.height);
        
        return isHorizontal 
            ? targetLayout.x + relativePos.x 
            : targetLayout.y + relativePos.y;
    }

    private mapSimpleDirectionToAnchorPoint(direction: string, isHorizontal: boolean): string {
        const mapping: Record<string, string> = {
            'left': 'centerLeft',
            'right': 'centerRight',
            'top': 'topCenter',
            'bottom': 'bottomCenter'
        };
        
        return mapping[direction] || direction;
    }

    private applyStretch(
        initialPosition: number, 
        initialSize: number, 
        isHorizontal: boolean,
        stretchTo: string,
        targetAnchorPoint: string,
        padding: number,
        elementsMap: Map<string, LayoutElement>,
        containerSize: number
    ): { x?: number, y?: number, size: number } {
        const targetCoord = this.getTargetCoordinate(
            stretchTo, 
            targetAnchorPoint, 
            isHorizontal,
            elementsMap,
            containerSize
        );

        if (targetCoord === null) {
            return { size: initialSize };
        }

        const myAnchorPoint = this.getAnchorAwareStretchEdge(initialPosition, initialSize, targetCoord, isHorizontal);
        const myRelativePos = this.getRelativeAnchorPosition(myAnchorPoint, initialSize, initialSize);
        const currentCoord = initialPosition + (isHorizontal ? myRelativePos.x : myRelativePos.y);
        
        let delta = targetCoord - currentCoord;
        delta = this.applyPadding(delta, myAnchorPoint, padding, containerSize);

        const result = this.applyStretchToEdge(
            initialPosition,
            initialSize,
            delta,
            myAnchorPoint, 
            isHorizontal
        );
        
        return result;
    }

    private applyPadding(
        delta: number, 
        anchorPoint: string, 
        padding: number, 
        containerSize: number
    ): number {
        const paddingOffset = this.parseLayoutOffset(padding, containerSize);
        
        if (anchorPoint.includes('Left') || anchorPoint.includes('Top')) {
            return delta - paddingOffset;
        } else {
            return delta + paddingOffset;
        }
    }

    private applyStretchToEdge(
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

    private getAnchorAwareStretchEdge(
        initialPosition: number, 
        initialSize: number, 
        targetCoord: number, 
        isHorizontal: boolean
    ): string {
        const anchorConfig = this.layoutConfig.anchor;
        
        if (anchorConfig?.anchorTo && anchorConfig.anchorTo !== 'container') {
            const anchorPoint = anchorConfig.anchorPoint || 'topLeft';

            if (isHorizontal) {
                if (anchorPoint.includes('Right')) {
                    return 'centerLeft';
                }
                if (anchorPoint.includes('Left')) {
                    return 'centerRight';
                }
                return this.getTargetBasedStretchEdge(initialPosition, targetCoord, isHorizontal);
            } else {
                if (anchorPoint.includes('bottom')) {
                    return 'topCenter';
                }
                if (anchorPoint.includes('top')) {
                    return 'bottomCenter';
                }
                return this.getTargetBasedStretchEdge(initialPosition, targetCoord, isHorizontal);
            }
        }
        
        return this.getTargetBasedStretchEdge(initialPosition, targetCoord, isHorizontal);
    }

    private getTargetBasedStretchEdge(
        initialPosition: number,
        targetCoord: number,
        isHorizontal: boolean
    ): string {
        return targetCoord > initialPosition ? 
            (isHorizontal ? 'centerRight' : 'bottomCenter') : 
            (isHorizontal ? 'centerLeft' : 'topCenter');
    }

    public getRelativeAnchorPosition(anchorPoint: string, width?: number, height?: number): { x: number; y: number } {
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

    protected abstract renderShape(): SVGTemplateResult | null;

    render(): SVGTemplateResult | null {
        if (!this.layout.calculated) return null;

        const shape = this.renderShape();
        if (!shape) return null;

        if (this.props.cutout && this.hasText()) {
            const textPosition = this.getTextPosition();
            const maskId = `${this.id}__cutout-mask`;

            const textForMask = svg`<text
                x="${textPosition.x}"
                y="${textPosition.y}"
                fill="black"
                font-family="${this.props.fontFamily || 'sans-serif'}"
                font-size="${this.props.fontSize || 16}px"
                font-weight="${this.props.fontWeight || 'normal'}"
                letter-spacing="${this.props.letterSpacing || 'normal'}"
                text-anchor="${this.props.textAnchor || 'middle'}"
                dominant-baseline="${this.props.dominantBaseline || 'middle'}"
                style="pointer-events: none; text-transform: ${this.props.textTransform || 'none'};"
            >
                ${this.props.text}
            </text>`;

            return svg`
                <g id="${this.id}">
                    <defs>
                        <mask id="${maskId}">
                            <rect x="0" y="0" width="100%" height="100%" fill="white" />
                            ${textForMask}
                        </mask>
                    </defs>
                    <g mask="url(#${maskId})">
                        ${shape}
                    </g>
                </g>
            `;
        } else {
            const colors = this.resolveElementColors();
            const textPosition = this.getTextPosition();
            const textElement = this.renderText(textPosition.x, textPosition.y, colors);

            return svg`
                <g id="${this.id}">
                    ${shape}
                    ${textElement}
                </g>
            `;
        }
    }

    animate(property: string, value: any, duration: number = 0.5): void {
        if (!this.layout.calculated) return;
        animationManager.animateElementProperty(this.id, property, value, duration, this.getShadowElement);
    }

    protected resolveDynamicColorWithAnimation(colorConfig: ColorValue, property: 'fill' | 'stroke' = 'fill'): string | undefined {
        const context: AnimationContext = {
            elementId: this.id,
            getShadowElement: this.getShadowElement,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdateCallback
        };
        
        return colorResolver.resolveColor(colorConfig, this.id, property, context, undefined, 'transparent');
    }

    protected resolveElementColors(options: ColorResolutionDefaults = {}): ComputedElementColors {
        const context: AnimationContext = {
            elementId: this.id,
            getShadowElement: this.getShadowElement,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdateCallback
        };
        
        const stateContext = this.getStateContext();
        
        return colorResolver.resolveAllElementColors(this.id, this.props, context, options, stateContext);
    }

    protected createResolvedPropsForButton(): any {
        const context: AnimationContext = {
            elementId: this.id,
            getShadowElement: this.getShadowElement,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdateCallback
        };
        
        const stateContext = this.getStateContext();
        
        return colorResolver.createButtonPropsWithResolvedColors(this.id, this.props, context, stateContext);
    }

    protected resolveDynamicColor(colorConfig: ColorValue): string | undefined {
        return colorResolver.resolveColor(colorConfig, this.id, undefined, undefined, undefined, 'transparent');
    }

    public entityChangesDetected(hass: HomeAssistant): boolean {
        if (!hass) return false;

        let changed = false;

        if (!(this as any).lastResolvedDynamicColors) {
            (this as any).lastResolvedDynamicColors = {
                fill: undefined,
                stroke: undefined,
                textColor: undefined
            };
        }

        const cache = (this as any).lastResolvedDynamicColors as Record<string, string | undefined>;

        const animationContext: any = {
            elementId: this.id,
            hass,
            getShadowElement: this.getShadowElement,
            requestUpdateCallback: this.requestUpdateCallback
        };

        const stateContext = this.getStateContext();

        const checkProp = (propName: 'fill' | 'stroke' | 'textColor') => {
            const value = (this.props as any)[propName];
            if (value === undefined) return;

            if (typeof value === 'object') {
                const resolved = colorResolver.resolveColor(value, this.id, propName as any, animationContext, stateContext, 'transparent');
                if (cache[propName] !== resolved) {
                    cache[propName] = resolved;
                    changed = true;
                }
            }
        };

        checkProp('fill');
        checkProp('stroke');
        checkProp('textColor');

        return changed;
    }

    public cleanupAnimations(): void {
        animationManager.stopAllAnimationsForElement(this.id);
    }

    updateHass(hass?: HomeAssistant): void {
        this.hass = hass;
        if (this.button) {
            this.button.updateHass(hass);
        }
    }

    cleanup(): void {
        this.cleanupInteractiveListeners();
        
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = undefined;
        }
        if (this.activeTimeout) {
            clearTimeout(this.activeTimeout);
            this.activeTimeout = undefined;
        }
        
        if (this.button) {
            this.button.cleanup();
        }
        
        this.cleanupAnimations();
    }

    protected hasText(): boolean {
        return Boolean(this.props.text && this.props.text.trim() !== '');
    }

    protected renderText(x: number, y: number, colors: ComputedElementColors): SVGTemplateResult | null {
        if (!this.hasText()) return null;

        return svg`
          <text
            x="${x}"
            y="${y}"
            fill="${colors.textColor}"
            font-family="${this.props.fontFamily || 'sans-serif'}"
            font-size="${this.props.fontSize || 16}px"
            font-weight="${this.props.fontWeight || 'normal'}"
            letter-spacing="${this.props.letterSpacing || 'normal'}"
            text-anchor="${this.props.textAnchor || 'middle'}"
            dominant-baseline="${this.props.dominantBaseline || 'middle'}"
            style="pointer-events: none; text-transform: ${this.props.textTransform || 'none'};"
          >
            ${this.props.text}
          </text>
        `;
    }

    protected getDefaultTextPosition(): { x: number, y: number } {
        const { x, y, width, height } = this.layout;
        const textAnchor = this.props.textAnchor || 'middle';
        
        let textX: number;
        
        switch (textAnchor) {
            case 'start':
                textX = x;
                break;
            case 'end':
                textX = x + width;
                break;
            case 'middle':
            default:
                textX = x + width / 2;
                break;
        }
        
        return {
            x: textX,
            y: y + height / 2
        };
    }

    protected getTextPosition(): { x: number, y: number } {
        const defaultPosition = this.getDefaultTextPosition();
        return this.applyTextOffsets(defaultPosition);
    }

    protected applyTextOffsets(position: { x: number; y: number }): { x: number; y: number } {
        return OffsetCalculator.applyTextOffsets(
            position,
            this.props.textOffsetX,
            this.props.textOffsetY,
            this.layout.width,
            this.layout.height
        );
    }

    private parseLayoutOffset(offset: string | number | undefined, containerDimension: number): number {
        if (offset === undefined) return 0;
        if (typeof offset === 'number') return offset;
        
        if (typeof offset === 'string' && offset.endsWith('%')) {
            const percentage = parseFloat(offset.slice(0, -1));
            return (percentage / 100) * containerDimension;
        }
        
        return parseFloat(offset as string) || 0;
    }

    private hasButtonConfig(): boolean {
        return Boolean(this.props.button?.enabled);
    }

    private hasAnimations(): boolean {
        return Boolean(this.props.animations);
    }
} 