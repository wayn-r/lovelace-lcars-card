/**
 * lcars-layout.js
 *
 * Core logic for dynamically generating and positioning LCARS-style SVG elements
 * based on a declarative layout configuration.
 */

// --- Core Classes ---

/**
 * Manages the overall layout process, including observing container size changes,
 * calculating element positions, and rendering the final SVG.
 */
class LayoutEngine {
    /**
     * Creates a LayoutEngine instance.
     * @param {SVGElement} container - The SVG element to render into.
     */
    constructor(container) {
        if (!container || !(container instanceof SVGElement)) {
            throw new Error("LayoutEngine requires a valid SVGElement container.");
        }
        this.container = container;
        this.elements = new Map(); // Stores all LayoutElement instances by ID
        this.groups = [];          // Stores groups of elements
        this.needsLayoutUpdate = true; // Flag to debounce layout updates
        this.isCalculating = false; // Prevent re-entrant calculations

        // Observe container size changes to trigger layout updates
        this.resizeObserver = new ResizeObserver(() => this.requestLayoutUpdate());
        this.resizeObserver.observe(this.container.parentElement || document.body); // Observe parent for size
    }

    /**
     * Adds a Group of elements to the engine.
     * @param {Group} group - The group to add.
     */
    addGroup(group) {
        this.groups.push(group);
        group.elements.forEach(el => {
            if (this.elements.has(el.id)) {
                console.warn(`LayoutEngine: Duplicate element ID "${el.id}". Overwriting.`);
            }
            this.elements.set(el.id, el);
        });
        this.requestLayoutUpdate(); // Trigger layout calculation for the new group
    }

    /**
     * Requests a layout update on the next animation frame.
     * Debounces multiple requests.
     */
    requestLayoutUpdate() {
        if (!this.needsLayoutUpdate) {
            this.needsLayoutUpdate = true;
            requestAnimationFrame(() => this.updateLayout());
        }
    }

    /**
     * Calculates the bounding boxes and positions for all elements.
     * This is the core layout logic. It may need multiple passes to resolve
     * dependencies where one element's position depends on another's.
     */
    calculateBoundingBoxes() {
        
        const containerRect = this.container.getBoundingClientRect();
        const maxPasses = 10; // Limit passes to prevent infinite loops in case of circular dependencies
        let pass = 0;
        let elementsCalculatedInPass = 0;
        let totalCalculated = 0;

        // Reset calculation state for all elements
        this.elements.forEach(el => el.resetLayout());

        do {
            elementsCalculatedInPass = 0;
            pass++;
            

            this.elements.forEach(el => {
                // Skip if already calculated in a previous pass
                if (el.layout.calculated) return;

                // 1. Calculate intrinsic size if needed (e.g., text measurement)
                if (!el.intrinsicSize.calculated) {
                    el.calculateIntrinsicSize(this.container);
                }

                // 2. Attempt to calculate layout based on dependencies
                const canCalculate = el.canCalculateLayout(this.elements);

                if (canCalculate) {
                    el.calculateLayout(this.elements, containerRect);
                    if (el.layout.calculated) {
                        elementsCalculatedInPass++;
                        totalCalculated++;
                        
                    }
                }
            });

            

        } while (elementsCalculatedInPass > 0 && totalCalculated < this.elements.size && pass < maxPasses);

        if (totalCalculated < this.elements.size) {
            console.warn(`LayoutEngine: Could not resolve layout for all elements after ${maxPasses} passes. Check for circular dependencies or missing elements.`);
            this.elements.forEach(el => {
                if (!el.layout.calculated) {
                    console.warn(` -> Failed to calculate: ${el.id}`);
                }
            });
        }
         
    }


    /**
     * Performs the layout calculation and re-renders the SVG content.
     */
    updateLayout() {
        if (!this.needsLayoutUpdate || this.isCalculating) return;

        this.isCalculating = true;
        

        // 1. Calculate all element positions and sizes
        this.calculateBoundingBoxes();

        // 2. Clear previous SVG content (simple approach)
        // More sophisticated updates could involve diffing and updating existing elements
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }

        // 3. Render elements group by group
        this.groups.forEach(group => {
            const groupSvg = group.render();
            if (groupSvg) {
                this.container.appendChild(groupSvg);
            }
        });

        this.needsLayoutUpdate = false;
        this.isCalculating = false;
        
    }

    /**
     * Cleans up resources, like the ResizeObserver.
     */
    destroy() {
         this.resizeObserver.disconnect();
         this.elements.clear();
         this.groups = [];
         
    }
}

/**
 * Represents a logical grouping of LayoutElements.
 */
class Group {
    /**
     * Creates a Group instance.
     * @param {string} id - A unique identifier for the group.
     * @param {LayoutElement[]} elements - An array of LayoutElement instances.
     */
    constructor(id, elements = []) {
        this.id = id;
        this.elements = elements;
    }

    /**
     * Renders the group and its elements into an SVG <g> element.
     * @returns {SVGGElement | null} The rendered SVG group element or null.
     */
    render() {
        const groupElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
        groupElement.setAttribute('id', this.id);

        let hasRenderedElements = false;
        this.elements.forEach(element => {
            // Only render elements whose layout was successfully calculated
            if (element.layout.calculated) {
                const svgElement = element.render();
                if (svgElement) {
                    groupElement.appendChild(svgElement);
                    hasRenderedElements = true;
                }
            } else {
                 console.warn(`Group ${this.id}: Skipping render for element ${element.id} as layout was not calculated.`);
            }
        });

        return hasRenderedElements ? groupElement : null; // Return null if group is empty or nothing rendered
    }
}

/**
 * Abstract base class for all visual elements in the layout.
 */
class LayoutElement {
    /**
     * Creates a LayoutElement instance.
     * @param {string} id - A unique identifier for the element.
     * @param {object} props - Visual properties (e.g., fill, text, stroke).
     * @param {object} layoutConfig - Configuration for positioning and sizing.
     */
    constructor(id, props = {}, layoutConfig = {}) {
        if (this.constructor === LayoutElement) {
            throw new Error("Abstract class 'LayoutElement' cannot be instantiated directly.");
        }
        this.id = id;
        this.props = props;
        this.layoutConfig = layoutConfig;

        // State properties
        this.resetLayout(); // Initialize layout state
        this.intrinsicSize = { width: 0, height: 0, calculated: false }; // Size based on content
        this.svgElement = null; // Reference to the rendered SVG DOM element
    }

    /**
     * Resets the calculated layout state. Called before each layout pass.
     */
    resetLayout() {
         this.layout = { x: 0, y: 0, width: 0, height: 0, calculated: false };
    }

    /**
     * Calculates the element's intrinsic size based on its content (e.g., text).
     * Subclasses should override this if their size depends on content.
     * @param {SVGElement} container - The SVG container (needed for text measurement).
     */
    calculateIntrinsicSize(container) {
        // Default: Use dimensions from props or layoutConfig if available
        this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 0;
        this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0;
        this.intrinsicSize.calculated = true; // Mark as calculated
    }

    /**
     * Checks if all dependencies required to calculate this element's layout
     * are already calculated.
     * @param {Map<string, LayoutElement>} elementsMap - Map of all elements by ID.
     * @returns {boolean} True if layout can be calculated, false otherwise.
     */
    canCalculateLayout(elementsMap) {
        const { anchorTo, stretchTo } = this.layoutConfig;

        // Check anchor dependency
        if (anchorTo) {
            const targetElement = elementsMap.get(anchorTo);
            if (!targetElement || !targetElement.layout.calculated) {
                //
                return false; // Anchor target not ready
            }
        }

        // Check stretch dependency
        if (stretchTo) {
            const targetElement = elementsMap.get(stretchTo);
            if (!targetElement || !targetElement.layout.calculated) {
                 //
                return false; // Stretch target not ready
            }
        }

        // Check if intrinsic size is known (important for elements sized by content)
        if (!this.intrinsicSize.calculated) {
             //
             return false;
        }


        return true; // All dependencies met
    }


    /**
     * Calculates the final position (x, y) and dimensions (width, height)
     * based on layoutConfig, intrinsic size, and dependencies.
     * @param {Map<string, LayoutElement>} elementsMap - Map of all elements by ID.
     * @param {DOMRect} containerRect - Bounding rectangle of the SVG container.
     */
    calculateLayout(elementsMap, containerRect) {
        // Ensure intrinsic size is calculated first
        if (!this.intrinsicSize.calculated) {
            console.warn(`Cannot calculate layout for ${this.id}: Intrinsic size not calculated.`);
            return;
        }

        // Start with intrinsic size
        this.layout.width = this.intrinsicSize.width;
        this.layout.height = this.intrinsicSize.height;

        // --- Positioning ---
        let baseX = 0;
        let baseY = 0;

        const {
            anchorTo, anchorPoint = 'topLeft', targetAnchorPoint = 'topLeft',
            offsetX = 0, offsetY = 0,
            anchorLeft, anchorRight, anchorTop, anchorBottom // Container anchoring
        } = this.layoutConfig;

        if (anchorTo) {
            // Anchor to another element
            const targetElement = elementsMap.get(anchorTo);
            if (targetElement && targetElement.layout.calculated) {
                const targetPos = targetElement.getAnchorPosition(targetAnchorPoint);
                const sourceOffset = this.getAnchorOffset(anchorPoint); // Offset from element's top-left

                baseX = targetPos.x - sourceOffset.x + offsetX;
                baseY = targetPos.y - sourceOffset.y + offsetY;
            } else {
                 console.warn(`Layout calculation skipped for ${this.id}: Anchor target '${anchorTo}' not found or not calculated.`);
                 return; // Cannot calculate position yet
            }
        } else {
            // Anchor relative to container
            const sourceOffset = this.getAnchorOffset(anchorPoint);
            if (anchorLeft) baseX = offsetX;
            if (anchorTop) baseY = offsetY;
            // Note: anchorRight and anchorBottom are handled after sizing
             baseX -= sourceOffset.x; // Adjust base by anchor point on self
             baseY -= sourceOffset.y;
        }

        this.layout.x = baseX;
        this.layout.y = baseY;


        // --- Sizing (Stretching) ---
        const { stretchTo, stretchAnchorPoint = 'topRight', targetStretchAnchorPoint = 'topLeft', stretchPaddingX = 0, stretchPaddingY = 0 } = this.layoutConfig;

        if (stretchTo) {
            const stretchTargetElement = elementsMap.get(stretchTo);
            if (stretchTargetElement && stretchTargetElement.layout.calculated) {
                const targetPos = stretchTargetElement.getAnchorPosition(targetStretchAnchorPoint);
                const sourcePos = this.getAnchorPosition(stretchAnchorPoint); // Current position of our stretch point

                // Calculate stretch width
                if (stretchAnchorPoint.includes('Right') && targetStretchAnchorPoint.includes('Left')) {
                    this.layout.width = targetPos.x - this.layout.x - stretchPaddingX;
                } else if (stretchAnchorPoint.includes('Left') && targetStretchAnchorPoint.includes('Right')) {
                     const originalRight = this.layout.x + this.layout.width;
                     this.layout.x = targetPos.x + stretchPaddingX;
                     this.layout.width = originalRight - this.layout.x;
                } // Add vertical stretching if needed (Bottom -> Top, Top -> Bottom)
                 else if (stretchAnchorPoint.includes('Bottom') && targetStretchAnchorPoint.includes('Top')) {
                    this.layout.height = targetPos.y - this.layout.y - stretchPaddingY;
                } else if (stretchAnchorPoint.includes('Top') && targetStretchAnchorPoint.includes('Bottom')) {
                    const originalBottom = this.layout.y + this.layout.height;
                    this.layout.y = targetPos.y + stretchPaddingY;
                    this.layout.height = originalBottom - this.layout.y;
                }


            } else {
                 console.warn(`Layout calculation partial for ${this.id}: Stretch target '${stretchTo}' not found or not calculated.`);
                 // Continue without stretching if target isn't ready
            }
        } else {
             // Container stretching (if anchored to both sides)
             if (anchorLeft && anchorRight) {
                 this.layout.width = containerRect.width - this.layout.x - (offsetX || 0); // Assumes offsetX applies to right anchor
             }
             if (anchorTop && anchorBottom) {
                 this.layout.height = containerRect.height - this.layout.y - (offsetY || 0); // Assumes offsetY applies to bottom anchor
             }
        }

        // Final position adjustments for container anchors (right/bottom)
        if (!anchorTo) {
             if (anchorRight) {
                 this.layout.x = containerRect.width - this.layout.width - (offsetX || 0);
             }
             if (anchorBottom) {
                 this.layout.y = containerRect.height - this.layout.height - (offsetY || 0);
             }
        }


        // Ensure non-negative dimensions
        this.layout.width = Math.max(0, this.layout.width);
        this.layout.height = Math.max(0, this.layout.height);

        this.layout.calculated = true; // Mark layout as complete for this element
    }

    /**
     * Gets the absolute coordinates {x, y} of a named anchor point on this element.
     * @param {string} anchorPoint - e.g., 'topLeft', 'center', 'bottomRight'.
     * @returns {{x: number, y: number}} Coordinates relative to the SVG container.
     */
    getAnchorPosition(anchorPoint) {
        const { x, y, width, height } = this.layout;
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        switch (anchorPoint) {
            case 'topLeft': return { x: x, y: y };
            case 'topCenter': return { x: x + halfWidth, y: y };
            case 'topRight': return { x: x + width, y: y };
            case 'centerLeft': return { x: x, y: y + halfHeight };
            case 'center': return { x: x + halfWidth, y: y + halfHeight };
            case 'centerRight': return { x: x + width, y: y + halfHeight };
            case 'bottomLeft': return { x: x, y: y + height };
            case 'bottomCenter': return { x: x + halfWidth, y: y + height };
            case 'bottomRight': return { x: x + width, y: y + height };
            default:
                console.warn(`Unknown anchor point: ${anchorPoint}. Defaulting to topLeft.`);
                return { x: x, y: y };
        }
    }

     /**
     * Gets the offset {x, y} of a named anchor point relative to the element's top-left (0,0).
     * Used to calculate positioning adjustments.
     * @param {string} anchorPoint - e.g., 'topLeft', 'center', 'bottomRight'.
     * @returns {{x: number, y: number}} Offset coordinates.
     */
    getAnchorOffset(anchorPoint) {
        const { width, height } = this.layout; // Use calculated layout dimensions
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        switch (anchorPoint) {
            case 'topLeft': return { x: 0, y: 0 };
            case 'topCenter': return { x: halfWidth, y: 0 };
            case 'topRight': return { x: width, y: 0 };
            case 'centerLeft': return { x: 0, y: halfHeight };
            case 'center': return { x: halfWidth, y: halfHeight };
            case 'centerRight': return { x: width, y: halfHeight };
            case 'bottomLeft': return { x: 0, y: height };
            case 'bottomCenter': return { x: halfWidth, y: height };
            case 'bottomRight': return { x: width, y: height };
            default: return { x: 0, y: 0 };
        }
    }


    /**
     * Abstract method to render the element as an SVG DOM node.
     * Subclasses MUST implement this.
     * @returns {SVGElement | null} The rendered SVG element or null if rendering fails.
     */
    render() {
        throw new Error("Method 'render()' must be implemented by subclasses.");
    }

    /**
     * Basic animation hook (placeholder).
     * Integrate with GSAP or similar for real animations.
     * @param {string} property - The CSS or SVG attribute to animate.
     * @param {string | number} value - The target value.
     * @param {number} duration - Duration in seconds.
     */
    animate(property, value, duration) {
        
        if (this.svgElement) {
            // Very basic example - replace with proper animation library
            this.svgElement.style.transition = `${property} ${duration}s ease-in-out`;
            // Need to differentiate between style properties and attributes
            if (property === 'fill' || property === 'opacity' || property === 'stroke') {
                 this.svgElement.style[property] = value;
            } else {
                 this.svgElement.setAttribute(property, value);
            }
        }
    }
}


// --- Specific Element Classes ---

/**
 * Renders a simple SVG <rect> element.
 */
class RectangleElement extends LayoutElement {
    render() {
        this.svgElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        this.svgElement.setAttribute('id', this.id + '-svg');
        this.svgElement.setAttribute('x', this.layout.x);
        this.svgElement.setAttribute('y', this.layout.y);
        this.svgElement.setAttribute('width', this.layout.width);
        this.svgElement.setAttribute('height', this.layout.height);
        this.svgElement.setAttribute('fill', this.props.fill || 'gray');
        if (this.props.stroke) this.svgElement.setAttribute('stroke', this.props.stroke);
        if (this.props.strokeWidth) this.svgElement.setAttribute('stroke-width', this.props.strokeWidth);
        if (this.props.rx) this.svgElement.setAttribute('rx', this.props.rx);
        if (this.props.ry) this.svgElement.setAttribute('ry', this.props.ry);
        return this.svgElement;
    }
}

/**
 * Renders an SVG <text> element and calculates its size.
 */
class TextElement extends LayoutElement {
    constructor(id, props, layoutConfig) {
        // Default text styles
        const defaultProps = {
            text: '',
            fontSize: 16,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', // Common LCARS-like font stack
            fill: 'white',
            textAnchor: 'start', // SVG default ('start', 'middle', 'end')
            dominantBaseline: 'auto' // SVG default ('auto', 'middle', 'hanging', 'mathematical')
        };
        super(id, { ...defaultProps, ...props }, layoutConfig);
        this._measurementTextElement = null; // Cache element used for measurement
    }

    calculateIntrinsicSize(container) {
        if (!this._measurementTextElement) {
            this._measurementTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
            // Apply styles relevant to sizing
            this._measurementTextElement.setAttribute('font-size', this.props.fontSize);
            this._measurementTextElement.setAttribute('font-family', this.props.fontFamily);
            this._measurementTextElement.setAttribute('font-weight', this.props.fontWeight || 'normal');
            this._measurementTextElement.setAttribute('letter-spacing', this.props.letterSpacing || 'normal');
            this._measurementTextElement.style.textTransform = this.props.textTransform || 'none';
            // Add to DOM temporarily for measurement (can be off-screen)
            this._measurementTextElement.style.position = 'absolute';
            this._measurementTextElement.style.visibility = 'hidden';
            this._measurementTextElement.style.top = '-9999px';
            this._measurementTextElement.style.left = '-9999px';
            container.appendChild(this._measurementTextElement);
        }

        // Set text content for measurement
        this._measurementTextElement.textContent = this.props.text || '';

        try {
            const bbox = this._measurementTextElement.getBBox();
            this.intrinsicSize.width = bbox.width;
            // BBox height can be unreliable; often better to use font size or line height heuristic
            this.intrinsicSize.height = this.props.height || this.props.fontSize * 1.2; // Approx line height
        } catch (e) {
            console.error(`Error getting BBox for text element ${this.id}:`, e);
            this.intrinsicSize.width = 0;
            this.intrinsicSize.height = this.props.height || this.props.fontSize;
        }

        // Optional: Remove measurement element after use to keep DOM clean
        // container.removeChild(this._measurementTextElement);
        // this._measurementTextElement = null; // Allow recreation if props change

        this.intrinsicSize.calculated = true;
    }

    render() {
        this.svgElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        this.svgElement.setAttribute('id', this.id + '-svg');

        // Apply layout position - adjust based on alignment properties
        let x = this.layout.x;
        let y = this.layout.y;

        // Adjust x based on text-anchor
        if (this.props.textAnchor === 'middle') {
            x += this.layout.width / 2;
        } else if (this.props.textAnchor === 'end') {
            x += this.layout.width;
        }

        // Adjust y based on dominant-baseline (simplified)
        // 'middle' is common for vertical centering
        if (this.props.dominantBaseline === 'middle') {
             y += this.layout.height / 2;
        } else if (this.props.dominantBaseline === 'auto' || this.props.dominantBaseline === 'hanging') {
             // Approximate baseline position (common for top alignment)
             y += this.props.fontSize * 0.8; // Adjust as needed
        } else {
             y += this.props.fontSize * 0.8; // Default fallback
        }


        this.svgElement.setAttribute('x', x);
        this.svgElement.setAttribute('y', y);
        this.svgElement.setAttribute('font-size', this.props.fontSize);
        this.svgElement.setAttribute('font-family', this.props.fontFamily);
        this.svgElement.setAttribute('fill', this.props.fill);
        this.svgElement.setAttribute('text-anchor', this.props.textAnchor);
        this.svgElement.setAttribute('dominant-baseline', this.props.dominantBaseline);

        // Apply other text styles
        if (this.props.fontWeight) this.svgElement.setAttribute('font-weight', this.props.fontWeight);
        if (this.props.letterSpacing) this.svgElement.setAttribute('letter-spacing', this.props.letterSpacing);
        if (this.props.textTransform) this.svgElement.style.textTransform = this.props.textTransform;


        this.svgElement.textContent = this.props.text || '';
        return this.svgElement;
    }
}

/**
 * Renders an LCARS-style endcap shape using an SVG <path>.
 */
class EndcapElement extends LayoutElement {
    constructor(id, props, layoutConfig) {
        const defaultProps = {
            height: 20,
            fill: 'orange',
            direction: 'left', // 'left' or 'right'
            cornerRadius: null // Defaults to height / 2
        };
        super(id, { ...defaultProps, ...props }, layoutConfig);
    }

    calculateIntrinsicSize(container) {
        // Intrinsic width is determined by the corner radius
        const h = this.props.height;
        const r = this.props.cornerRadius !== null ? this.props.cornerRadius : h / 2;
        this.intrinsicSize.width = Math.min(r, h / 2); // Radius can't be more than half height visually
        this.intrinsicSize.height = h;
        this.intrinsicSize.calculated = true;
    }

    render() {
        this.svgElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.svgElement.setAttribute('id', this.id + '-svg');
        this.svgElement.setAttribute('fill', this.props.fill);

        const x = this.layout.x;
        const y = this.layout.y;
        const w = this.layout.width; // Width is the radius part
        const h = this.layout.height;
        const r = Math.min(w, h / 2); // Effective radius for drawing

        let d = "";
        if (this.props.direction === 'left') {
            // M = Move to | L = Line to | Q = Quadratic Bezier Curve
            // Start top-right corner of the curve part, line left, curve down, line down, curve right, line right, close
            d = `M ${x + w} ${y} ` + // Top-right corner
                `L ${x + r} ${y} ` + // Line left to start of curve
                `Q ${x} ${y} ${x} ${y + r} ` + // Quadratic curve top-left corner
                `L ${x} ${y + h - r} ` + // Line down to start of bottom curve
                `Q ${x} ${y + h} ${x + r} ${y + h} ` + // Quadratic curve bottom-left corner
                `L ${x + w} ${y + h} ` + // Line right to bottom-right corner
                `Z`; // Close path
        } else { // 'right'
            // Start top-left corner, line right, curve down, line down, curve left, line left, close
            d = `M ${x} ${y} ` + // Top-left corner
                `L ${x + w - r} ${y} ` + // Line right to start of curve
                `Q ${x + w} ${y} ${x + w} ${y + r} ` + // Quadratic curve top-right corner
                `L ${x + w} ${y + h - r} ` + // Line down to start of bottom curve
                `Q ${x + w} ${y + h} ${x + w - r} ${y + h} ` + // Quadratic curve bottom-right corner
                `L ${x} ${y + h} ` + // Line left to bottom-left corner
                `Z`; // Close path
        }

        this.svgElement.setAttribute('d', d);
        return this.svgElement;
    }
}

/**
 * Renders a button, typically composed of a background shape and text.
 * Handles click events.
 */
class ButtonElement extends LayoutElement {
    constructor(id, props, layoutConfig, onClick) {
         const defaultProps = {
            paddingX: 10,
            paddingY: 5,
            backgroundProps: { fill: '#0066CC', rx: 4, ry: 4 }, // Default background
            textProps: { text: 'BUTTON', fill: 'white', fontSize: 14, textAnchor: 'middle', dominantBaseline: 'middle' } // Default text
        };
        // Deep merge props (simple version)
        const mergedProps = {
            ...defaultProps,
            ...props,
            backgroundProps: { ...defaultProps.backgroundProps, ...(props.backgroundProps || {}) },
            textProps: { ...defaultProps.textProps, ...(props.textProps || {}) }
        };
        super(id, mergedProps, layoutConfig);

        this.onClick = onClick;

        // Internal elements for rendering composition
        this.background = new RectangleElement(id + '-bg', this.props.backgroundProps);
        this.text = new TextElement(id + '-text', this.props.textProps);
    }

    calculateIntrinsicSize(container) {
        // Calculate text size first
        this.text.calculateIntrinsicSize(container);

        // Button size is text size + padding
        this.intrinsicSize.width = this.text.intrinsicSize.width + this.props.paddingX * 2;
        this.intrinsicSize.height = this.text.intrinsicSize.height + this.props.paddingY * 2;

        // Update background's intrinsic size to match the button
        this.background.intrinsicSize = { ...this.intrinsicSize, calculated: true };
        this.intrinsicSize.calculated = true;
    }

    calculateLayout(elementsMap, containerRect) {
        // 1. Calculate the button's overall layout using the base class method
        super.calculateLayout(elementsMap, containerRect);

        // 2. If button layout is calculated, position internal elements relative to it
        if (this.layout.calculated) {
            // Background takes the full button layout box
            this.background.layout = { ...this.layout, calculated: true };

            // Text is centered within the button layout box
            const textX = this.layout.x + this.layout.width / 2; // Adjusted by textAnchor='middle' in TextElement render
            const textY = this.layout.y + this.layout.height / 2; // Adjusted by dominantBaseline='middle'

            this.text.layout = {
                x: textX, // Pass center point; TextElement adjusts based on its anchors
                y: textY,
                width: this.text.intrinsicSize.width, // Text uses its own intrinsic size
                height: this.text.intrinsicSize.height,
                calculated: true
            };
        }
    }

    render() {
        // Render as a group containing background and text
        this.svgElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svgElement.setAttribute('id', this.id + '-svg');
        this.svgElement.style.cursor = 'pointer'; // Indicate interactivity

        // Render internal components
        const bgSvg = this.background.render();
        const textSvg = this.text.render();

        if (bgSvg) this.svgElement.appendChild(bgSvg);
        if (textSvg) this.svgElement.appendChild(textSvg);

        // Add click listener
        if (this.onClick && typeof this.onClick === 'function') {
            // Use 'pointerdown' or 'click'. 'click' might feel more natural.
            this.svgElement.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent event bubbling if needed
                this.onClick(this.id, this.props); // Pass ID and props to handler
                
                 // Add visual feedback (optional)
                 this.svgElement.style.opacity = '0.7';
                 setTimeout(() => { this.svgElement.style.opacity = '1'; }, 150);
            });
        }

        return this.svgElement;
    }
}


// --- Example Usage ---

document.addEventListener('DOMContentLoaded', () => {
    const svgContainer = document.getElementById('lcars-svg');

    if (svgContainer) {
        // Instantiate the layout engine
        const engine = new LayoutEngine(svgContainer);

        // Define LCARS colors
        const lcarsOrange = '#FF9900';
        const lcarsBlue = '#3399FF';
        const lcarsRed = '#CC0000';
        const lcarsTan = '#FFCC99';
        const lcarsWhite = '#FFFFFF';
        const lcarsBlack = '#000000';

        // Define common text style
        const lcarsTextStyle = {
             fontFamily: '"Antonio", "Helvetica Neue", Helvetica, Arial, sans-serif', // LCARS font if available
             fontSize: 18,
             fill: lcarsBlack, // Text often black on colored backgrounds
             textTransform: 'uppercase',
             letterSpacing: '1px',
             dominantBaseline: 'middle' // Good for vertical centering in shapes
        };

        const headerHeight = 30;
        const endcapRadius = headerHeight / 2;

        // Define the layout structure
        const topHeader = new Group(
            'top-header',
            [
                // Left Endcap (anchored to container top-left)
                new EndcapElement(
                    'left-endcap',
                    { direction: 'left', fill: lcarsOrange, height: headerHeight, cornerRadius: endcapRadius },
                    { anchorTop: true, anchorLeft: true, offsetX: 10, offsetY: 10 }
                ),
                // Left Text (anchored right of left-endcap)
                new TextElement(
                    'left-text',
                    { ...lcarsTextStyle, text: 'USS VOYAGER', fill: lcarsBlack },
                    {
                        anchorTo: 'left-endcap',
                        anchorPoint: 'centerLeft',      // Align the left-center of the text...
                        targetAnchorPoint: 'centerRight', // ...to the right-center of the endcap
                        offsetX: 10                     // Add 10px horizontal space
                    }
                ),
                // Right Endcap (anchored to container top-right)
                new EndcapElement(
                    'right-endcap',
                    { direction: 'right', fill: lcarsOrange, height: headerHeight, cornerRadius: endcapRadius },
                    { anchorTop: true, anchorRight: true, offsetX: 10, offsetY: 10 }
                ),
                 // Right Text (anchored left of right-endcap)
                new TextElement(
                    'right-text',
                    { ...lcarsTextStyle, text: 'NCC-74656', fill: lcarsBlack, textAnchor: 'end' }, // Align text to the right
                    {
                        anchorTo: 'right-endcap',
                        anchorPoint: 'centerRight',     // Align the right-center of the text...
                        targetAnchorPoint: 'centerLeft',  // ...to the left-center of the endcap
                        offsetX: -10                    // Add 10px horizontal space (negative offset)
                    }
                ),
                // Header Bar (stretches between left-text and right-text)
                new RectangleElement(
                    'header-bar',
                    { fill: lcarsOrange, height: headerHeight },
                    {
                        anchorTo: 'left-text',          // Align top-left of bar...
                        anchorPoint: 'centerLeft',
                        targetAnchorPoint: 'centerRight', // ...to top-right of left-text
                        offsetX: 5,                     // Small gap after left text
                        stretchTo: 'right-text',        // Stretch until...
                        stretchAnchorPoint: 'centerRight',// ...the right edge of the bar...
                        targetStretchAnchorPoint: 'centerLeft', // ...meets the left edge of right-text
                        stretchPaddingX: -5             // Small gap before right text
                    }
                ),
                // Example Button below the header
                new ButtonElement(
                    'status-button',
                    {
                        paddingX: 20,
                        paddingY: 8,
                        backgroundProps: { fill: lcarsBlue, rx: 5, ry: 5 },
                        textProps: { ...lcarsTextStyle, text: 'SYSTEM STATUS', fontSize: 16, fill: lcarsWhite }
                    },
                    {
                        anchorTo: 'left-endcap', // Position relative to the bottom-left of the left endcap
                        anchorPoint: 'topLeft',
                        targetAnchorPoint: 'bottomLeft',
                        offsetY: 15 // Space below the header elements
                    },
                    (id) => { // Click handler function
                        alert(`Button '${id}' clicked! Implement status display.`);
                        // Example: Find the text element and change its content
                        const buttonTextElement = engine.elements.get(id + '-text');
                        if (buttonTextElement) {
                             buttonTextElement.props.text = 'STATUS: NOMINAL';
                             buttonTextElement.intrinsicSize.calculated = false; // Force recalculation of size
                             engine.requestLayoutUpdate(); // Update layout to reflect text change
                        }
                    }
                )
            ]
        );

        // Add the group(s) to the engine
        engine.addGroup(topHeader);

        // Make engine accessible globally for debugging (optional)
        window.lcarsEngine = engine;
        

    } else {
        console.error("SVG container element '#lcars-svg' not found.");
    }
});
