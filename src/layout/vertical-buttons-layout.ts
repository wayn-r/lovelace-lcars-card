import {
    ButtonLayout,
    LcarsButtonConfig,
    MainHeaderLayout
} from '../types';
import {
    BUTTON_HEIGHT_PX,
    VERTICAL_GAP_PX,
    HORIZONTAL_GAP_PX,
    ELBOW_VERTICAL_WIDTH_PX,
    MAIN_HEADER_BUTTON_GAP_PX,
    DEFAULT_BUTTONS
} from '../constants';

interface VerticalButtonsOptions {
    mainHeaderLayout: MainHeaderLayout;
    buttonsConfig: LcarsButtonConfig[] | undefined;
    vGap?: number; // Optional overrides
    hGap?: number;
    buttonHeight?: number;
    buttonWidth?: number;
    initialGap?: number;
}

/**
 * Calculates the layout for the vertical stack of buttons in the Home view.
 */
export function calculateVerticalButtonsLayout(
    options: VerticalButtonsOptions
): {
    buttons: ButtonLayout[];
    nextAvailableY: number; // Return the Y position after the last button + gap
} {
    const { 
        mainHeaderLayout,
        buttonsConfig
    } = options;

    // Use defaults or provided options
    const currentButtons = buttonsConfig || DEFAULT_BUTTONS;
    const vGap = options.vGap ?? VERTICAL_GAP_PX;
    const hGap = options.hGap ?? HORIZONTAL_GAP_PX;
    const buttonWidth = options.buttonWidth ?? ELBOW_VERTICAL_WIDTH_PX;
    const buttonHeight = options.buttonHeight ?? BUTTON_HEIGHT_PX;
    const initialGap = options.initialGap ?? MAIN_HEADER_BUTTON_GAP_PX;

    const calculatedButtons: ButtonLayout[] = [];
    let currentButtonY = mainHeaderLayout.y + mainHeaderLayout.elbowTotalHeight + initialGap;
    const buttonTextX = buttonWidth - hGap; // Anchor end

    currentButtons.forEach((buttonConfig, index) => {
        const buttonY = currentButtonY;
        const buttonTextY = buttonY + buttonHeight / 2;
        // Determine color: use configured color, fallback to alternating defaults
        const colorVar = buttonConfig.colorVar || (index % 2 === 0 ? '--primary' : '--secondaryBright');
        
        calculatedButtons.push({
            x: 0, 
            y: buttonY, 
            width: buttonWidth, 
            height: buttonHeight,
            text: buttonConfig.text,
            textX: buttonTextX, 
            textY: buttonTextY,
            colorVar: colorVar,
            action: buttonConfig.action
        });
        
        // Increment Y for the next button
        currentButtonY += buttonHeight + vGap;
    });

    // Return the array of calculated button layouts and the next Y position
    return {
        buttons: calculatedButtons,
        nextAvailableY: currentButtonY
    };
} 