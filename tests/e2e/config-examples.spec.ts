import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { HomeAssistant, PlaywrightBrowser } from 'hass-taste-test';
import { AnimationTimingCalculator, TestWaitHelper, AnimationTimingInfo } from './test-helpers';
import './test-helpers';

const EXAMPLES_DIR = path.resolve(process.cwd(), 'yaml-config-examples');

const exampleFiles = fs
  .readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => path.join(EXAMPLES_DIR, f));

let hass: HomeAssistant<any>;

test.beforeAll(async () => {
  hass = await HomeAssistant.create('', {
    browser: new PlaywrightBrowser('chromium'),
  });

  const distPath = path.resolve(process.cwd(), 'dist/lovelace-lcars-card.js');
  await hass.addResource(distPath, 'module');
});

test.afterAll(async () => {
  if (hass) await hass.close();
});

type ButtonMetadata = {
  fullId: string;
  targetElementRefs: string[];
};

type ButtonActionConfig = {
  target_element_ref?: string;
};

type ElementConfig = {
  id: string;
  button?: {
    enabled: boolean;
    actions?: {
      tap?: ButtonActionConfig | ButtonActionConfig[];
      hold?: ButtonActionConfig | ButtonActionConfig[];
      double_tap?: ButtonActionConfig | ButtonActionConfig[];
    };
  };
};

type GroupConfig = {
  group_id: string;
  elements: ElementConfig[];
};

type YamlConfig = {
  groups: GroupConfig[];
};

class YamlInteractionAnalyzer {
  static analyzeForInteractions(yamlObj: Record<string, unknown>): ButtonMetadata[] {
    const buttons: ButtonMetadata[] = [];
    const config = yamlObj as YamlConfig;

    if (!config?.groups || !Array.isArray(config.groups)) return buttons;

    for (const group of config.groups) {
      if (!group.elements || !Array.isArray(group.elements)) continue;

      for (const element of group.elements) {
        if (element?.button?.enabled) {
          const fullId = `${group.group_id}.${element.id}`;
          const targetRefs = this.extractTargetReferences(element);
          buttons.push({ fullId, targetElementRefs: targetRefs });
        }
      }
    }

    return buttons;
  }

  private static extractTargetReferences(element: ElementConfig): string[] {
    const targetRefs: string[] = [];
    const actions = element.button?.actions;
    
    if (!actions) return targetRefs;

    const actionContainers = [actions.tap, actions.hold, actions.double_tap].filter(Boolean);

    for (const actionContainer of actionContainers) {
      const actionsArray = Array.isArray(actionContainer) ? actionContainer : [actionContainer];
      
      for (const action of actionsArray) {
        if (action?.target_element_ref) {
          targetRefs.push(action.target_element_ref);
        }
      }
    }

    return targetRefs;
  }
}

for (const filePath of exampleFiles) {
  const fileName = path.basename(filePath);
  const baseName = path.parse(fileName).name;

  test.describe(`${baseName}`, () => {
    test(`baseline & interactions`, async ({ page }) => {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const configObj = yaml.load(raw) as Record<string, unknown>;

      const timingInfo: AnimationTimingInfo = AnimationTimingCalculator.analyzeConfigurationTiming(configObj);

      await hass.callService('input_number', 'set_value', {
        entity_id: 'input_number.kitchen_sink_brightness',
        value: 0,
      });

      const dashboard = await hass.Dashboard([configObj]);
      const url = await dashboard.link();

      await page.goto(url, { timeout: 60_000 });

      const card = page.locator('lovelace-lcars-card').first();
      await card.locator('svg').waitFor();

      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);

      await TestWaitHelper.waitForAnimations(page, timingInfo);

      await expect(card).toHaveScreenshot(`${baseName}-00-initial.png`);

      const buttons = YamlInteractionAnalyzer.analyzeForInteractions(configObj);

      let stepIndex = 1;

      for (const button of buttons) {
        const shapeSelector = `path[id="${button.fullId}__shape"]`;
        const btn = card.locator(shapeSelector);

        try {
          await btn.waitFor({ state: 'attached', timeout: 5000 });
        } catch {
          continue;
        }

        stepIndex = await TestWaitHelper.performClickSequence(page, btn, card, baseName, button.fullId, stepIndex);
        
        for (const targetRef of button.targetElementRefs) {
          await TestWaitHelper.waitForStateChangeAnimations(page, configObj, targetRef);
        }
        
        const paddedStepIndex = stepIndex.toString().padStart(2, '0');
        await expect(card).toHaveScreenshot(`${baseName}-${paddedStepIndex}-${button.fullId}-final-state.png`);

        stepIndex += 1;
      }
    });
  });
} 