import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from '../elements/element.js';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import type { CardRuntime } from '../../core/runtime.js';
import { SVGTemplateResult, svg } from 'lit';
import { ColorResolver } from '../../utils/color-resolver.js';

const WEATHER_ICONS: { [key: string]: string } = {
    'clear-night': 'mdi:weather-night',
    'cloudy': 'mdi:weather-cloudy',
    'exceptional': 'mdi:alert-circle-outline',
    'fog': 'mdi:weather-fog',
    'hail': 'mdi:weather-hail',
    'lightning': 'mdi:weather-lightning',
    'lightning-rainy': 'mdi:weather-lightning-rainy',
    'partlycloudy': 'mdi:weather-partly-cloudy',
    'pouring': 'mdi:weather-pouring',
    'rainy': 'mdi:weather-rainy',
    'snowy': 'mdi:weather-snowy',
    'snowy-rainy': 'mdi:weather-snowy-rainy',
    'sunny': 'mdi:weather-sunny',
    'windy': 'mdi:weather-windy',
    'windy-variant': 'mdi:weather-windy-variant',
};

const WEATHER_ICONS_NIGHT: { [key: string]: string } = {
    'partlycloudy': 'mdi:weather-night-partly-cloudy',
};


export class WeatherIcon extends LayoutElement {

    constructor(
        id: string,
        props: LayoutElementProps = {},
        layoutConfig: LayoutConfigOptions = {},
        hass?: HomeAssistant,
        requestUpdateCallback?: () => void,
        getShadowElement?: (id: string) => Element | null,
        runtime?: CardRuntime
    ) {
        super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement, runtime);
        // Register ha-icon as a custom element if it hasn't been already
        if (!customElements.get('ha-icon')) {
          customElements.define('ha-icon', class extends HTMLElement {});
        }
    }

    private getIcon(): string {
        const entityId = Array.isArray(this.props.entity) ? this.props.entity[0] as any : (this.props.entity as any);
        if (!entityId || !this.hass || !this.hass.states[entityId]) {
            return 'mdi:weather-sunny';
        }

        const state = this.hass.states[entityId].state;
        const sunState = this.hass.states['sun.sun']?.state;

        if (sunState === 'below_horizon' && WEATHER_ICONS_NIGHT[state]) {
            return WEATHER_ICONS_NIGHT[state];
        }

        return WEATHER_ICONS[state] || 'mdi:weather-sunny';
    }

    protected renderShape(): SVGTemplateResult | null {
        const icon = this.getIcon();
        const width = this.layout.width || 24;
        const height = this.layout.height || 24;

        const fallbackColor = 'var(--lcars-color-environmental-weather-icon)';
        const colors = this.resolveElementColors({ fallbackFillColor: fallbackColor });
        const rawColor = (colors.fillColor ?? fallbackColor).toString().trim();
        let iconColor = rawColor.length > 0 ? rawColor : fallbackColor;

        const resolvedThemeColor = ColorResolver
            .resolve(iconColor)
            .withFallback(iconColor)
            .withDom({ themeOnly: true } as any)
            .toString()
            .trim();
        if (resolvedThemeColor && !resolvedThemeColor.startsWith('var(')) {
            iconColor = resolvedThemeColor;
        }

        const styleSegments = [
            `width: ${width}px`,
            `height: ${height}px`,
            `--mdc-icon-size: ${width}px`,
            'display: block',
            `--icon-color: ${iconColor}`,
            `color: ${iconColor}`,
            `--mdc-icon-color: ${iconColor}`
        ];
        const styleAttribute = `${styleSegments.join('; ')};`;

        return svg`
            <foreignObject x="${this.layout.x}" y="${this.layout.y}" width="${width}" height="${height}">
                <ha-icon
                    .icon=${icon}
                    style="${styleAttribute}"
                ></ha-icon>
            </foreignObject>
        `;
    }
}
