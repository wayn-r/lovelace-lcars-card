// Helpers to modify hass-taste-test behaviour for our e2e suite.
// 1) Create a *very* minimal Home Assistant configuration so startup is fast
//    and only the integrations/entities the LCARS examples need are loaded.
// 2) Force each generated Lovelace view into panel-mode so the LCARS card can
//    use the full width in our screenshots. We no longer override the theme or
//    background – the test pages will use Home Assistant's default styles.

import { promises as fs } from 'fs';
import { HomeAssistant } from 'hass-taste-test';

// Prevent double-patching if this file is imported in multiple spec files.
if (!(HomeAssistant as any)._lcarsPatched) {
  //--------------------------------------------------------------------------
  // 1. Patch writeYAMLConfiguration → strip `default_config:` and add only the
  //    integrations we explicitly need.
  //--------------------------------------------------------------------------
  (HomeAssistant.prototype as any).writeYAMLConfiguration = async function (additionalCfg: string) {
    // Core services so Lovelace & HTTP work.
    const base = [
      'frontend:',
      'http:',
      `  server_host: ${this.options.host}`,
      `  server_port: ${this.chosenPort}`,
    ];

    // Lightweight "demo" entities the example dashboards rely on.
    const demoEntities = [
      'input_boolean:',
      '  kitchen_sink_light:',
      '    name: Kitchen Sink Light',
      '',
      'light:',
      '  - platform: template',
      '    lights:',
      '      kitchen_sink_light:',
      "        friendly_name: 'Kitchen Sink Light'",
      "        value_template: '{{ states(\"input_boolean.kitchen_sink_light\") == \"on\" }}'",
      '        turn_on:',
      '          service: input_boolean.turn_on',
      '          target:',
      '            entity_id: input_boolean.kitchen_sink_light',
      '        turn_off:',
      '          service: input_boolean.turn_off',
      '          target:',
      '            entity_id: input_boolean.kitchen_sink_light',
    ];

    const contents = [...base, '', additionalCfg.trim(), '', ...demoEntities, ''].join('\n');
    await fs.writeFile(this.path_confFile(), contents);
  };

  //--------------------------------------------------------------------------
  // 2. Patch setDashboardView → save dashboards in *panel* mode so the LCARS
  //    card always occupies the full browser width.
  //--------------------------------------------------------------------------
  (HomeAssistant.prototype as any).setDashboardView = async function (dashboardPath: string, cards: any[]) {
    await this.ws.sendMessagePromise({
      type: 'lovelace/config/save',
      url_path: dashboardPath,
      config: {
        title: 'LCARS Test',
        views: [
          {
            path: 'default_view',
            title: 'LCARS',
            panel: true,
            cards,
          },
        ],
      },
    });
  };

  (HomeAssistant as any)._lcarsPatched = true;
}
