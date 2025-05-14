```text
lovelace-lcars-card/
├── .gitignore
├── CHANGELOG.md
├── dist/
├── flatten-codebase.js
├── package.json
├── reference-files/
├── src/
│   ├── constants.ts
│   ├── editor/
│   │   ├── elements/
│   │   │   ├── chisel_endcap.ts
│   │   │   ├── elbow.ts
│   │   │   ├── element.ts
│   │   │   ├── endcap.ts
│   │   │   ├── rectangle.ts
│   │   │   ├── text.ts
│   │   │   └── top_header.ts
│   │   ├── grid-selector.ts
│   │   ├── group.ts
│   │   ├── lcars-card-editor.ts
│   │   ├── properties/
│   │   │   └── properties.ts
│   │   ├── renderer.ts
│   │   └── shared/
│   ├── layout/
│   │   ├── elements/
│   │   │   ├── button.ts
│   │   │   ├── chisel_endcap.ts
│   │   │   ├── elbow.ts
│   │   │   ├── element.ts
│   │   │   ├── endcap.ts
│   │   │   ├── rectangle.ts
│   │   │   ├── text.ts
│   │   │   └── top_header.ts
│   │   ├── engine.ts
│   │   └── parser.ts
│   ├── lovelace-lcars-card.ts
│   ├── styles/
│   │   └── styles.ts
│   ├── types.ts
│   └── utils/
│       ├── fontmetrics.d.ts
│       └── shapes.ts
├── TODO.md
├── tsconfig.json
└── vite.config.ts
```

# Codebase Files

## File: CHANGELOG.md

```markdown
# Changelog

## [Unreleased]
### Fixed
```

## File: flatten-codebase.js

```javascript
// Required Node.js modules using ES Module syntax
import fs from 'fs'; // File System module
import path from 'path'; // Path module for working with file and directory paths
import { execSync } from 'child_process'; // To run external commands (though tree will be replaced)
import { fileURLToPath } from 'url'; // To get __dirname equivalent in ES modules
import ignore from 'ignore'; // To parse .gitignore files

// --- Configuration ---
const sourceDir = '.'; // Operates from the project root
const outputFile = 'flattened_codebase.md';
const langMap = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.css': 'css',
    '.html': 'html',
    '.json': 'json',
    '.md': 'markdown',
};

// ES Module equivalents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- End Configuration ---

/**
 * Generates a string representation of the directory tree, respecting .gitignore.
 * @param {string} currentDirPath - The current directory path to scan (relative to baseSourceDir).
 * @param {import('ignore').Ignore} ig - The ignore instance.
 * @param {string} indentPrefix - The prefix string for indentation.
 * @param {string} baseSourceDir - The root directory of the scan (where .gitignore is located).
 * @returns {string} A string representing the directory tree.
 */
function generateTreeString(currentDirPath, ig, indentPrefix = '', baseSourceDir = '.') {
    let treeString = '';
    let items;
    try {
        // Ensure we are reading relative to the baseSourceDir for initial calls if currentDirPath is '.'
        items = fs.readdirSync(path.resolve(baseSourceDir, currentDirPath));
    } catch (e) {
        console.warn(`Could not read directory ${path.resolve(baseSourceDir, currentDirPath)}: ${e.message}`);
        return `[Error reading directory: ${currentDirPath}]\n`;
    }

    const filteredItems = items.filter(item => {
        // Path for ignore check must be relative to where .gitignore is (baseSourceDir)
        const itemPathRelativeToGitignore = path.relative(baseSourceDir, path.resolve(baseSourceDir, currentDirPath, item)).replace(/\\/g, '/');
        if (itemPathRelativeToGitignore === '' || itemPathRelativeToGitignore === outputFile) return false; // Avoid issues with root itself or the output file
        return !ig.ignores(itemPathRelativeToGitignore);
    });

    filteredItems.forEach((item, index) => {
        const fullItemPath = path.resolve(baseSourceDir, currentDirPath, item); // Absolute path for fs.statSync
        let stats;
        try {
            stats = fs.statSync(fullItemPath);
        } catch (e) {
            console.warn(`Could not stat ${fullItemPath}: ${e.message}`);
            treeString += `${indentPrefix}${isLastItem ? '└── ' : '├── '}[Error stating item: ${item}]\n`;
            return;
        }

        const isLastItem = index === filteredItems.length - 1;
        treeString += indentPrefix;
        treeString += isLastItem ? '└── ' : '├── ';
        treeString += item + (stats.isDirectory() ? '/' : '') + '\n';

        if (stats.isDirectory()) {
            const newIndentPrefix = indentPrefix + (isLastItem ? '    ' : '│   ');
            // For recursion, pass the path relative to baseSourceDir
            treeString += generateTreeString(path.join(currentDirPath, item), ig, newIndentPrefix, baseSourceDir);
        }
    });
    return treeString;
}


/**
 * Recursively gets all files for content inclusion, respecting .gitignore.
 * @param {string} dirPath - The directory to start from (relative to project root).
 * @param {import('ignore').Ignore} ig - The ignore instance.
 * @param {string[]} arrayOfFiles - Accumulator for file paths.
 * @param {string} baseSourceDir - The root directory of the scan.
 * @returns {string[]} An array of full file paths (relative to project root).
 */
function getAllFiles(dirPath, ig, arrayOfFiles = [], baseSourceDir = '.') {
    try {
        const files = fs.readdirSync(path.resolve(baseSourceDir, dirPath));

        files.forEach(function(file) {
            const itemPathRelative = path.join(dirPath, file); // Path relative to baseSourceDir
            const itemPathAbsolute = path.resolve(baseSourceDir, dirPath, file);

            // Path for ignore check should be relative to baseSourceDir
            const pathForIgnoreCheck = path.relative(baseSourceDir, itemPathAbsolute).replace(/\\/g, '/');
            if (pathForIgnoreCheck === '' || ig.ignores(pathForIgnoreCheck)) {
                return; // Skip ignored files/directories
            }

            if (fs.statSync(itemPathAbsolute).isDirectory()) {
                arrayOfFiles = getAllFiles(itemPathRelative, ig, arrayOfFiles, baseSourceDir);
            } else {
                const ext = path.extname(file).toLowerCase();
                if (Object.keys(langMap).includes(ext)) {
                    arrayOfFiles.push(itemPathRelative); // Store path relative to project root
                }
            }
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: Directory "${path.resolve(baseSourceDir, dirPath)}" not found during file scan.`);
        } else {
            console.error(`Error reading directory ${path.resolve(baseSourceDir, dirPath)}: ${error.message}`);
        }
    }
    return arrayOfFiles;
}

try {
    const projectRoot = process.cwd(); // Define project root explicitly

    // --- 0. Initialize .gitignore handler ---
    const ig = ignore();
    const gitignorePath = path.join(projectRoot, '.gitignore');

    if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        ig.add(gitignoreContent);
        console.log('Loaded .gitignore rules.');
    } else {
        console.log('.gitignore file not found. No files will be ignored based on its rules.');
    }
    // Add common patterns that should always be ignored.
    // These paths are relative to the project root.
    ig.add(['node_modules', outputFile, '.git', '.vscode', '.idea']);


    // --- 1. Ensure output directory exists ---
    const absoluteOutputFile = path.resolve(projectRoot, outputFile);
    const absoluteOutputDir = path.dirname(absoluteOutputFile);
    if (!fs.existsSync(absoluteOutputDir)) {
        fs.mkdirSync(absoluteOutputDir, { recursive: true });
        console.log(`Created output directory: ${absoluteOutputDir}`);
    }

    // --- 2. Initialize output file & add directory tree ---
    let outputContent = "```text\n";
    try {
        console.log(`Generating directory tree for: ${projectRoot} (respecting .gitignore)`);
        // Add the root directory name to the tree output manually
        outputContent += path.basename(projectRoot) + '/\n';
        // Call the new function. sourceDir is '.', projectRoot is the base for path resolution.
        const treeOutputString = generateTreeString(sourceDir, ig, '', projectRoot);
        outputContent += treeOutputString;
    } catch (error) {
        console.warn(`Warning: Could not generate directory tree. Error: ${error.message}\n${error.stack}`);
        outputContent += `Directory tree for '${path.basename(projectRoot)}' could not be generated.\n`;
    }
    outputContent += "```\n\n";
    outputContent += "# Codebase Files\n\n";

    fs.writeFileSync(absoluteOutputFile, outputContent, 'utf8');
    console.log(`Initialized ${outputFile} with directory tree and header.`);

    // --- 3. Process each source file ---
    console.log(`Reading files from project root (${projectRoot})...`);
    // Pass sourceDir ('.') and the ignore instance. projectRoot is the base.
    const allSourceFiles = getAllFiles(sourceDir, ig, [], projectRoot);

    if (allSourceFiles.length === 0) {
         console.warn(`No files matching criteria found in project root or subdirectories (after .gitignore filtering).`);
    }

    allSourceFiles.forEach(filePathRelative => { // filePathRelative is relative to projectRoot
        const relativePathForDisplay = filePathRelative.replace(/\\/g, '/');
        const extension = path.extname(filePathRelative).toLowerCase();
        const lang = langMap[extension] || '';

        console.log(`Processing: ${relativePathForDisplay}`);

        let fileBlock = `## File: ${relativePathForDisplay}\n\n`;
        fileBlock += `\`\`\`${lang}\n`;

        try {
            const fileContent = fs.readFileSync(path.resolve(projectRoot, filePathRelative), 'utf8');
            fileBlock += fileContent.trimEnd() + '\n';
        } catch (readError) {
            console.error(`Error reading file ${filePathRelative}: ${readError.message}`);
            fileBlock += `Error reading file: ${readError.message}\n`;
        }
        fileBlock += `\`\`\`\n\n`;

        fs.appendFileSync(absoluteOutputFile, fileBlock, 'utf8');
    });

    console.log(`\nCodebase successfully flattened to ${outputFile}`);

} catch (error) {
    console.error(`An unexpected error occurred: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
}
```

## File: package.json

```json
{
    "name": "lovelace-lcars-card",
    "version": "1.0.0",
    "description": "LCARS themed card for Home Assistant",
    "main": "dist/lovelace-lcars-card.js",
    "module": "dist/lovelace-lcars-card.js",
    "type": "module",
    "scripts": {
        "predev": "node flatten-codebase.js",
        "dev": "vite",
        "prestart": "node flatten-codebase.js",
        "start": "vite",
        "build": "tsc && vite build",
        "preview": "vite preview"
    },
    "keywords": [
        "home-assistant",
        "lovelace",
        "card",
        "lcars"
    ],
    "author": "",
    "license": "MIT",
    "devDependencies": {
        "@mermaid-js/mermaid-cli": "^11.4.2",
        "@types/sortablejs": "^1.15.8",
        "custom-card-helpers": "^1.9.0",
        "lit": "^3.0.0",
        "tplant": "^3.1.3",
        "ts-morph": "^25.0.1",
        "typescript": "^5.0.0",
        "vite": "^5.0.0"
    },
    "dependencies": {
        "fontfaceobserver": "^2.3.0",
        "fontmetrics": "^1.0.0",
        "gsap": "^3.12.7",
        "ignore": "^7.0.4",
        "lit": "^3.0.0",
        "sortablejs": "^1.15.6"
    }
}
```

## File: src/constants.ts

```typescript
// Card name
export const CARD_NAME = "LCARS Card";

// Card type
export const CARD_TYPE = "lovelace-lcars-card";

// Default values
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_TITLE = "LCARS Card";
export const DEFAULT_TEXT = "Hello from LCARS";
```

## File: src/editor/elements/chisel_endcap.ts

```typescript
import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
    Direction, 
    Width, 
    Height,
    Fill,
    ButtonEnabled,
    ButtonCutoutText,
    ButtonTextColor,
    ButtonFontFamily,
    ButtonFontSize,
    ButtonFontWeight,
    ButtonLetterSpacing,
    ButtonTextTransform,
    ButtonTextAnchor,
    ButtonDominantBaseline,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActiveTransform,
    ButtonActionType,
    ButtonText,
    OffsetX,
    OffsetY,
    Layout
} from '../properties/properties';

export class ChiselEndcap extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.ANCHOR]: {
                properties: []
            },
            [PropertyGroup.STRETCH]: {
                properties: []
            },
            [PropertyGroup.BUTTON]: {
                properties: [
                    ButtonEnabled, 
                    ButtonText, 
                    ButtonCutoutText, 
                    ButtonTextColor,
                    ButtonFontFamily, 
                    ButtonFontSize, 
                    ButtonFontWeight,
                    ButtonLetterSpacing,
                    ButtonTextTransform,
                    ButtonTextAnchor,
                    ButtonDominantBaseline,
                    ButtonHoverFill,
                    ButtonActiveFill,
                    ButtonHoverTransform,
                    ButtonActiveTransform,
                    ButtonActionType
                ]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Width, Height]
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill, Direction]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}
EditorElement.registerEditorElement('chisel-endcap', ChiselEndcap);
```

## File: src/editor/elements/elbow.ts

```typescript
import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import {
    Orientation, 
    Width, 
    Height,
    BodyWidth, 
    ArmHeight, 
    ElbowTextPosition,
    Fill,
    ButtonEnabled,
    OffsetX,
    OffsetY,
    ButtonCutoutText,
    ButtonTextColor,
    ButtonFontFamily,
    ButtonFontSize,
    ButtonFontWeight,
    ButtonLetterSpacing,
    ButtonTextTransform,
    ButtonTextAnchor,
    ButtonDominantBaseline,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActiveTransform,
    ButtonActionType,
    ButtonText
} from '../properties/properties';

export class Elbow extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.ANCHOR]: {
                properties: []
            },
            [PropertyGroup.STRETCH]: {
                properties: []
            },
            [PropertyGroup.BUTTON]: {
                properties: [
                    ButtonEnabled, 
                    ButtonText, 
                    ButtonCutoutText, 
                    ButtonTextColor,
                    ButtonFontFamily, 
                    ButtonFontSize, 
                    ButtonFontWeight,
                    ButtonLetterSpacing,
                    ButtonTextTransform,
                    ButtonTextAnchor,
                    ButtonDominantBaseline,
                    ButtonHoverFill,
                    ButtonActiveFill,
                    ButtonHoverTransform,
                    ButtonActiveTransform,
                    ButtonActionType,
                    ElbowTextPosition
                ]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Width, Height, BodyWidth, ArmHeight]
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill, Orientation]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            }
        };
    }
}
EditorElement.registerEditorElement('elbow', Elbow);
```

## File: src/editor/elements/element.ts

```typescript
import {
    Type,
    AnchorTo, AnchorPoint, TargetAnchorPoint,
    StretchTarget, StretchDirection, StretchPadding,
    ButtonEnabled, 
    PropertySchemaContext, HaFormSchema, LcarsPropertyBase,
    PropertyGroup, Layout
} from '../properties/properties';
import { LcarsGroup } from '../group';

export type PropertyClass = new () => LcarsPropertyBase;
export type PropertyClassOrFactory = (new () => LcarsPropertyBase) | (() => LcarsPropertyBase);

const editorElementRegistry: Record<string, new (config: any) => EditorElement> = {};

// Define PropertyGroup enum for readability and type safety
export { PropertyGroup } from '../properties/properties';

// Helper interface for defining property group requirements
export interface PropertyGroupDefinition {
    properties: PropertyClassOrFactory[];
    // For conditional groups based on config values
    isEnabled?: (config: any) => boolean;
}

export abstract class EditorElement {
    id: string;
    type: string;
    config: any;

    isCollapsed: boolean = true;
    isEditingId: boolean = false;
    currentIdInput: string = '';
    idEditErrorMessage: string = '';

    constructor(config: any) {
        this.id = config.id;
        this.type = config.type;
        this.config = config;

        if (!this.config.layout) this.config.layout = {};
        if (!this.config.layout.stretch) this.config.layout.stretch = {};
        if (!this.config.button) this.config.button = {};

        this.currentIdInput = this.getBaseId();
    }

    getBaseId(): string {
        const parts = this.id.split('.');
        return parts.length > 1 ? parts[1] : this.id || '';
    }

    getGroupId(): string {
        const parts = this.id.split('.');
        return parts.length > 1 ? parts[0] : '__ungrouped__';
    }

    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {};
    }

    /**
     * Stretch properties need special handling due to their indexed nature (StretchTarget(0), StretchTarget(1)).
     * This method provides the factory functions for them.
     */
    get stretchPropertyFactories(): (() => LcarsPropertyBase)[] {
        return [
            () => new StretchTarget(0),
            () => new StretchDirection(0),
            () => new StretchPadding(0),
            () => new StretchTarget(1),
            () => new StretchDirection(1),
            () => new StretchPadding(1),
        ];
    }

    private getButtonProperties(groupDef: PropertyGroupDefinition | null): PropertyClassOrFactory[] {
        if (!this.config.button?.enabled) {
            return [ButtonEnabled];
        }
        
        // If custom properties are defined, use those
        if (groupDef && groupDef.properties && groupDef.properties.length > 0) {
            // Make sure ButtonEnabled is included
            if (!groupDef.properties.includes(ButtonEnabled)) {
                return [ButtonEnabled, ...groupDef.properties];
            }
            return groupDef.properties;
        }

        // Otherwise return only ButtonEnabled (no default button properties)
        return [ButtonEnabled];
    }

    /**
     * Helper to get stretch-related properties based on the element's config
     */
    private getStretchProperties(): PropertyClassOrFactory[] {
        const stretchProps: PropertyClassOrFactory[] = [];
        const layoutData = this.config.layout || {};
        const stretch = layoutData.stretch || {};
        const factories = this.stretchPropertyFactories;

        // Always add the first stretch target to allow setting it
        stretchProps.push(factories[0]); // StretchTarget(0)
        
        // Add first stretch direction and padding if target is set
        if (stretch.stretchTo1) {
            stretchProps.push(factories[1]); // StretchDirection(0)
            stretchProps.push(factories[2]); // StretchPadding(0)
            
            // Add second stretch target if first one is configured
            stretchProps.push(factories[3]); // StretchTarget(1)
            
            // Add second stretch direction and padding if second target is set
            if (stretch.stretchTo2) {
                stretchProps.push(factories[4]); // StretchDirection(1)
                stretchProps.push(factories[5]); // StretchPadding(1)
            }
        }

        return stretchProps;
    }

    /**
     * Collects all property classes from the enabled property groups
     */
    private getAllPropertyClasses(): PropertyClassOrFactory[] {
        // Always include Type property at the beginning
        let allProperties: PropertyClassOrFactory[] = [Type];
        
        // Get property groups as defined by the element
        const groups = this.getPropertyGroups();
        
        // Add properties from each group
        for (const [groupKey, groupDef] of Object.entries(groups)) {
            const propertyGroup = groupKey as PropertyGroup;

            if (propertyGroup === PropertyGroup.ANCHOR) {
                if (groupDef === null || groupDef) {
                    allProperties.push(AnchorTo, AnchorPoint, TargetAnchorPoint);
                }
                continue;
            }
            if (propertyGroup === PropertyGroup.STRETCH) {
                if (groupDef === null || groupDef) {
                    allProperties.push(...this.getStretchProperties());
                }
                continue;
            }
            // Handle BUTTON group
            if (propertyGroup === PropertyGroup.BUTTON) {
                allProperties.push(...this.getButtonProperties(groupDef));
                continue;
            }
            
            // Handle all other groups - only include if defined with properties
            if (groupDef && groupDef.properties.length > 0) {
                // Check custom isEnabled condition if provided
                if (groupDef.isEnabled && !groupDef.isEnabled(this.config)) {
                    continue;
                }
                
                allProperties.push(...groupDef.properties);
            }
        }
        
        // Ensure uniqueness
        return Array.from(new Set(allProperties));
    }

    getSchema(context?: PropertySchemaContext): HaFormSchema[] {
        const layoutData = this.config.layout || {};
        const propsData = this.config.props || {};
        const buttonData = this.config.button || {};
        const fullContext = { ...context, layoutData, propsData, buttonData };
        
        // Get all property classes from enabled groups
        const propertyClasses = this.getAllPropertyClasses();
        
        // Generate schema from property instances
        const schema = propertyClasses.map(PropClassOrFactory => {
            try {
                let instance: LcarsPropertyBase;
                // Check if it's a class constructor or a factory function
                if (PropClassOrFactory.prototype && typeof PropClassOrFactory.prototype.getSchema === 'function') {
                    instance = new (PropClassOrFactory as new () => LcarsPropertyBase)();
                } else {
                    instance = (PropClassOrFactory as () => LcarsPropertyBase)();
                }
                return instance.getSchema(fullContext);
            } catch (e) {
                console.error(`Error instantiating or getting schema for ${ (PropClassOrFactory as any).name || 'Unknown Property Class'}`, e);
                return null;
            }
        }).filter((item): item is HaFormSchema => item !== null);
        
        return schema;
    }

    getPropertiesMap(): Map<string, LcarsPropertyBase> {
        const map = new Map<string, LcarsPropertyBase>();
        
        // Get all property classes from enabled groups
        const propertyClasses = this.getAllPropertyClasses();

        propertyClasses.forEach(PropClassOrFactory => {
            try {
                let instance: LcarsPropertyBase;
                if (PropClassOrFactory.prototype && typeof PropClassOrFactory.prototype.getSchema === 'function') {
                    instance = new (PropClassOrFactory as new () => LcarsPropertyBase)();
                } else {
                    instance = (PropClassOrFactory as () => LcarsPropertyBase)();
                }
                map.set(instance.name, instance);
            } catch (e) {
                console.error(`Error instantiating property from ${ (PropClassOrFactory as any).name || 'factory' }`, e);
            }
        });
        return map;
    }

    getFormData(): Record<string, any> {
        const formData: Record<string, any> = {};
        const propertiesMap = this.getPropertiesMap();
        
        const getDeepValue = (obj: any, parts: string[]): any => {
            let current = obj;
            for (const part of parts) {
                if (current === null || current === undefined) return undefined;
                current = current[part];
            }
            return current;
        };

        propertiesMap.forEach((propInstance, propName) => {
            const pathParts = propInstance.configPath.split('.');
            let value = getDeepValue(this.config, pathParts);

            if (propInstance.formatValueForForm) {
                value = propInstance.formatValueForForm(value);
            }
            if (propInstance instanceof StretchTarget && value === undefined) {
                value = '';
            }
            if (value !== undefined) {
                formData[propInstance.name] = value;
            }
        });
        return formData;
    }

    processDataUpdate(newData: any): any {
        let data = { ...newData };

        if (!data.anchorTo || data.anchorTo === '') {
            delete data.anchorPoint;
            delete data.targetAnchorPoint;
        } else {
            if (!data.anchorPoint) data.anchorPoint = 'center';
            if (!data.targetAnchorPoint) data.targetAnchorPoint = 'center';
        }

        if (!data.layout) data.layout = {};
        if (!data.layout.stretch) data.layout.stretch = {};

        const processStretchGroup = (index: number) => {
            const suffix = index === 0 ? '1' : '2';
            const stretchToName = `stretchTo${suffix}`;
            const directionName = `stretchDirection${suffix}`;
            const paddingName = `stretchPadding${suffix}`;

            const stretchToValue = data[stretchToName];
            const directionValue = data[directionName];
            const paddingValue = data[paddingName];

            if (!stretchToValue || stretchToValue === '') {
                delete data.layout.stretch[`stretchTo${suffix}`];
                delete data.layout.stretch[`targetStretchAnchorPoint${suffix}`];
                delete data.layout.stretch[`stretchAxis${suffix}`];
                delete data.layout.stretch[`stretchPadding${suffix}`];
                delete data[directionName];
                delete data[paddingName];
            } else {
                data.layout.stretch[`stretchTo${suffix}`] = stretchToValue;
                if (directionValue) {
                    data.layout.stretch[`targetStretchAnchorPoint${suffix}`] = directionValue;
                    data.layout.stretch[`stretchAxis${suffix}`] = this._isHorizontalDirection(directionValue) ? 'X' : 'Y';
                    data.layout.stretch[`stretchPadding${suffix}`] = paddingValue ?? 0;
                } else {
                    delete data.layout.stretch[`targetStretchAnchorPoint${suffix}`];
                    delete data.layout.stretch[`stretchAxis${suffix}`];
                    delete data.layout.stretch[`stretchPadding${suffix}`];
                    delete data[directionName];
                    delete data[paddingName];
                }
            }
        };

        if ('stretchTo2' in data && data.stretchTo2 !== '') {
            data.layout.stretch.stretchTo2 = data.stretchTo2;
        }
        processStretchGroup(0);
        processStretchGroup(1);

        if (data['button.enabled'] === false) {
            Object.keys(data).forEach(key => {
                if (key.startsWith('button.') && key !== 'button.enabled') {
                    delete data[key];
                }
            });
            // Explicitly clear action_config sub-properties from data being prepared for setDeep
            const actionConfigPrefix = 'button.action_config.';
            Object.keys(data).forEach(key => {
                if (key.startsWith(actionConfigPrefix)) {
                    delete data[key];
                }
            });
        } else if (data['button.enabled'] === true) {
            // Ensure transform properties are preserved if they exist, or initialized
            if (data['button.hover_transform'] === undefined) data['button.hover_transform'] = this.config.button?.hover_transform || '';
            if (data['button.active_transform'] === undefined) data['button.active_transform'] = this.config.button?.active_transform || '';

            if (!data['button.action_config.type'] || data['button.action_config.type'] === 'none') {
                delete data['button.action_config.service'];
                delete data['button.action_config.service_data'];
                delete data['button.action_config.navigation_path'];
                delete data['button.action_config.url_path'];
                delete data['button.action_config.entity'];
            }
        }
        return data;
    }


    toggleCollapse(): void { this.isCollapsed = !this.isCollapsed; }
    startEditingId(): void {
        this.isEditingId = true;
        this.currentIdInput = this.getBaseId();
        this.idEditErrorMessage = '';
    }
    cancelEditingId(): void {
        this.isEditingId = false;
        this.idEditErrorMessage = '';
    }
    updateIdInput(value: string): void {
        this.currentIdInput = value;
        this.validateIdInput();
    }

    validateIdInput(): boolean {
        const validationResult = LcarsGroup.validateIdentifier(this.currentIdInput, "Element base ID");
        if (!validationResult.isValid) {
            this.idEditErrorMessage = validationResult.error || 'Invalid Element base ID.';
            return false;
        }
        this.idEditErrorMessage = '';
        return true;
    }

    confirmEditId(): { oldId: string, newId: string } | null {
        if (!this.isEditingId || !this.validateIdInput()) return null;
        const newBaseId = this.currentIdInput;
        const oldBaseId = this.getBaseId();
        if (newBaseId === oldBaseId) {
            this.cancelEditingId();
            return null;
        }
        const groupId = this.getGroupId();
        const oldFullId = this.id;
        const newFullId = `${groupId}.${newBaseId}`;
        const result = { oldId: oldFullId, newId: newFullId };
        this.isEditingId = false;
        this.idEditErrorMessage = '';
        return result;
    }

    requestDelete(): { elementId: string } { return { elementId: this.id }; }

    private _isHorizontalDirection(targetAnchorPoint: string): boolean {
        return targetAnchorPoint === 'left' || targetAnchorPoint === 'right' || targetAnchorPoint === 'center' ||
               targetAnchorPoint.includes('Left') || targetAnchorPoint.includes('Right') || targetAnchorPoint.includes('Center');
    }

    // --- Static Factory & Registry ---
    public static registerEditorElement(type: string, elementClass: new (config: any) => EditorElement) {
        if (editorElementRegistry[type]) {
            console.warn(`EditorElement type "${type}" is being overwritten.`);
        }
        editorElementRegistry[type] = elementClass;
    }

    public static create(config: any): EditorElement | null {
        const ElementClass = editorElementRegistry[config?.type];
        if (ElementClass) {
            return new ElementClass(config);
        }
        console.warn(`Unknown element type for editor: ${config?.type}`);
        return null;
    }
}
```

## File: src/editor/elements/endcap.ts

```typescript
import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
    ButtonActiveTransform,
    ButtonCutoutText,
    ButtonEnabled,
    ButtonFontFamily,
    ButtonFontSize,
    ButtonFontWeight,
    ButtonLetterSpacing,
    ButtonTextTransform,
    ButtonTextAnchor,
    ButtonDominantBaseline,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActionType,
    ButtonTextColor,
    ButtonText,
    Direction, 
    Width, 
    Height,
    Fill,
    OffsetX,
    OffsetY
} from '../properties/properties';

export class Endcap extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.ANCHOR]: {
                properties: []
            },
            [PropertyGroup.STRETCH]: {
                properties: []
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill, Direction]
            },
            [PropertyGroup.BUTTON]: {
                properties: [
                    ButtonEnabled, 
                    ButtonText, 
                    ButtonCutoutText, 
                    ButtonTextColor,
                    ButtonFontFamily, 
                    ButtonFontSize, 
                    ButtonFontWeight,
                    ButtonLetterSpacing,
                    ButtonTextTransform,
                    ButtonTextAnchor,
                    ButtonDominantBaseline,
                    ButtonHoverFill,
                    ButtonActiveFill,
                    ButtonHoverTransform,
                    ButtonActiveTransform,
                    ButtonActionType
                ]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Width, Height]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}
EditorElement.registerEditorElement('endcap', Endcap);
```

## File: src/editor/elements/rectangle.ts

```typescript
import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
    Width, 
    Height,
    Fill,
    ButtonEnabled,
    ButtonCutoutText,
    ButtonTextColor,
    ButtonFontFamily,
    ButtonFontSize,
    ButtonFontWeight,
    ButtonLetterSpacing,
    ButtonTextTransform,
    ButtonTextAnchor,
    ButtonDominantBaseline,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActiveTransform,
    ButtonActionType,
    ButtonText,
    OffsetX,
    OffsetY
} from '../properties/properties';

export class Rectangle extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.ANCHOR]: null,
            [PropertyGroup.STRETCH]: {
                properties: []
            },
            [PropertyGroup.BUTTON]: {
                properties: [
                    ButtonEnabled, 
                    ButtonText, 
                    ButtonCutoutText, 
                    ButtonTextColor,
                    ButtonFontFamily, 
                    ButtonFontSize, 
                    ButtonFontWeight,
                    ButtonLetterSpacing,
                    ButtonTextTransform,
                    ButtonTextAnchor,
                    ButtonDominantBaseline,
                    ButtonHoverFill,
                    ButtonActiveFill,
                    ButtonHoverTransform,
                    ButtonActiveTransform,
                    ButtonActionType
                ]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Width, Height]
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}

EditorElement.registerEditorElement('rectangle', Rectangle);
```

## File: src/editor/elements/text.ts

```typescript
import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import {
    TextContent, 
    FontSize, 
    FontFamily, 
    FontWeight, 
    LetterSpacing, 
    TextAnchor, 
    DominantBaseline, 
    TextTransform,
    Fill,
    ButtonEnabled,
    ButtonCutoutText,
    ButtonTextColor,
    ButtonFontFamily,
    ButtonFontSize,
    ButtonFontWeight,
    ButtonLetterSpacing,
    ButtonTextTransform,
    ButtonTextAnchor,
    ButtonDominantBaseline,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActiveTransform,
    ButtonActionType,
    ButtonText,
    OffsetX,
    OffsetY,
    Height,
    Width
} from '../properties/properties';

export class Text extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.ANCHOR]: {
                properties: []
            },
            [PropertyGroup.STRETCH]: {
                properties: []
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Height, Width]
            },
            [PropertyGroup.BUTTON]: {
                properties: [
                    ButtonEnabled, 
                    ButtonText, 
                    ButtonCutoutText, 
                    ButtonTextColor,
                    ButtonFontFamily, 
                    ButtonFontSize, 
                    ButtonFontWeight,
                    ButtonLetterSpacing,
                    ButtonTextTransform,
                    ButtonTextAnchor,
                    ButtonDominantBaseline,
                    ButtonHoverFill,
                    ButtonActiveFill,
                    ButtonHoverTransform,
                    ButtonActiveTransform,
                    ButtonActionType
                ]
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill]
            },
            [PropertyGroup.TEXT]: {
                properties: [
                    TextContent,
                    FontSize, 
                    FontFamily, 
                    FontWeight, 
                    LetterSpacing, 
                    TextAnchor, 
                    DominantBaseline, 
                    TextTransform
                ]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}
EditorElement.registerEditorElement('text', Text);
```

## File: src/editor/elements/top_header.ts

```typescript
import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import {
    Height,
    LeftTextContent,
    RightTextContent,
    FontFamily,
    FontWeight,
    LetterSpacing,
    TextTransform,
    OffsetY
} from '../properties/properties';

export class TopHeader extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetY]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Height]
            },
            [PropertyGroup.TEXT]: {
                properties: [
                    LeftTextContent,
                    RightTextContent,
                    FontFamily,
                    FontWeight,
                    LetterSpacing,
                    TextTransform
                ]
            }
        };
    }
}

EditorElement.registerEditorElement('top_header', TopHeader);
```

## File: src/editor/grid-selector.ts

```typescript
import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { fireEvent } from 'custom-card-helpers';

@customElement('lcars-grid-selector')
export class LcarsGridSelector extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) labelCenter = false;
  @property({ type: Boolean }) disableCorners = false;

  static styles = css`
    .anchor-grid-label {
      font-weight: bold;
      margin-bottom: 4px;
      display: block;
    }
    .anchor-grid-label.center {
        text-align: center;
        width: 100%;
    }
    .anchor-grid {
      display: grid;
      grid-template-columns: repeat(3, var(--lcars-grid-selector-size, 28px));
      grid-template-rows: repeat(3, var(--lcars-grid-selector-size, 28px));
      gap: 4px;
      margin-bottom: 8px;
      justify-content: center; /* Center grid horizontally */
    }
    .anchor-grid-btn {
      width: var(--lcars-grid-selector-size, 28px);
      height: var(--lcars-grid-selector-size, 28px);
      border: 1.5px solid var(--divider-color, #888);
      background: var(--card-background-color, #222);
      border-radius: 6px;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      position: relative; /* For tooltip positioning */
    }
    .anchor-grid-btn:focus-visible {
      border-color: var(--primary-color, #ff9800);
    }
    .anchor-grid-btn.selected {
      border-color: var(--primary-color, #ff9800);
      background: var(--primary-color, #ff9800);
    }
    .anchor-grid-btn.selected ha-icon {
      color: #fff !important; /* Ensure icon color contrasts with selected background */
    }
    .anchor-grid-btn[disabled] {
      cursor: not-allowed;
      opacity: 0.3;
    }
    ha-icon {
      font-size: calc(var(--lcars-grid-selector-size, 28px) * 0.7); /* Scale icon size */
      color: var(--secondary-text-color, #bbb);
      transition: color 0.2s;
    }
    .center-icon {
        opacity: 0.7;
    }
    .center-selected-indicator {
        font-size: calc(var(--lcars-grid-selector-size, 28px) * 0.7);
        position: absolute;
        color: #fff; /* White indicator for center */
    }
  `;

  private _handleClick(point: string): void {
    if (this.disabled) return;

    const isCorner = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].includes(point);
    if (this.disableCorners && isCorner) {
        return;
    }

    const newValue = this.value === point ? '' : point;
    if (newValue !== this.value) {
        this.value = newValue;
        fireEvent(this, 'value-changed', { value: this.value });
    }
  }

  protected render(): TemplateResult {
    const points = [
      'topLeft', 'topCenter', 'topRight',
      'centerLeft', 'center', 'centerRight',
      'bottomLeft', 'bottomCenter', 'bottomRight'
    ];

    const iconMap: Record<string, string> = {
      topLeft: 'mdi:arrow-top-left',
      topCenter: 'mdi:arrow-up',
      topRight: 'mdi:arrow-top-right',
      centerLeft: 'mdi:arrow-left',
      center: 'mdi:circle-small',
      centerRight: 'mdi:arrow-right',
      bottomLeft: 'mdi:arrow-bottom-left',
      bottomCenter: 'mdi:arrow-down',
      bottomRight: 'mdi:arrow-bottom-right',
    };

    return html`
      ${this.label ? html`<span class="anchor-grid-label ${this.labelCenter ? 'center' : ''}">${this.label}</span>` : ''}
      <div class="anchor-grid">
        ${points.map(pt => {
          const isSelected = this.value === pt;
          const isCorner = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].includes(pt);
          const isDisabled = this.disabled || (this.disableCorners && isCorner);
          const isCenter = pt === 'center';

          return html`
            <button
              id="button-${pt}"
              class="anchor-grid-btn ${isSelected ? 'selected' : ''}"
              title=${pt}
              ?disabled=${isDisabled}
              @click=${() => this._handleClick(pt)}
              type="button"
            >
              <ha-icon
                class="${isCenter ? 'center-icon' : ''}"
                icon="${iconMap[pt]}"
              ></ha-icon>
              ${isSelected && isCenter ? html`<ha-icon class="center-selected-indicator" icon="mdi:circle"></ha-icon>` : ''}
            </button>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-grid-selector': LcarsGridSelector;
  }
}
```

## File: src/editor/group.ts

```typescript
export class LcarsGroup {
    id: string;

    isCollapsed: boolean = true;
    isEditingName: boolean = false;
    isDeleteWarningVisible: boolean = false;
    currentNameInput: string = '';
    editErrorMessage: string = '';

    constructor(id: string) {
        this.id = id;
        this.currentNameInput = id;
    }

    toggleCollapse(): void {
        this.isCollapsed = !this.isCollapsed;
    }

    startEditingName(): void {
        this.isEditingName = true;
        this.currentNameInput = this.id;
        this.editErrorMessage = '';
    }

    cancelEditingName(): void {
        this.isEditingName = false;
        this.editErrorMessage = '';
    }

    updateNameInput(value: string): void {
        this.currentNameInput = value;
        const validationResult = LcarsGroup.validateIdentifier(this.currentNameInput, "Group ID");
        this.editErrorMessage = validationResult.error || '';
    }

    requestDelete(): void {
        this.isDeleteWarningVisible = true;
    }

    cancelDelete(): void {
        this.isDeleteWarningVisible = false;
    }

    confirmEditName(existingGroupIds: Set<string>): { oldId: string, newId: string } | null {
        const validationResult = LcarsGroup.validateIdentifier(this.currentNameInput, "Group ID", existingGroupIds);
        if (!this.isEditingName || !validationResult.isValid) {
             this.editErrorMessage = validationResult.error || 'Validation failed.'; 
            return null;
        }
        const newId = this.currentNameInput;
        if (newId === this.id) {
            this.cancelEditingName();
            return null;
        }

        const result = { oldId: this.id, newId: newId };
        this.isEditingName = false;
        this.editErrorMessage = '';
        return result;
    }

    confirmDelete(): { groupId: string } {
         const result = { groupId: this.id };
         this.isDeleteWarningVisible = false;
         return result;
    }
    
    requestAddElement(baseId: string, existingElementIdsInGroup: Set<string>): { newElementConfig?: any, error?: string } {
        const trimmedBaseId = baseId.trim();

        // Use the new generalized validation for the base ID part
        // For element base IDs, uniqueness is checked against other base IDs *within the group context later*,
        // or against fully qualified names if `existingElementIdsInGroup` contains them.
        // Here, we're primarily checking format of the baseId.
        const baseIdValidation = LcarsGroup.validateIdentifier(trimmedBaseId, "Element base ID");
        if (!baseIdValidation.isValid) {
            return { error: baseIdValidation.error };
        }

        // The old duplicate check, now using the generalized uniqueness validator
        // We need to ensure the `existingElementIdsInGroup` contains fully qualified names.
        const fullId = `${this.id}.${trimmedBaseId}`;
        const uniquenessValidation = LcarsGroup._validateIsUnique(fullId, "Element ID", existingElementIdsInGroup);
        if (!uniquenessValidation.isValid) {
            return { error: uniquenessValidation.error };
        }

        const newElementConfig = {
            id: `${this.id}.${trimmedBaseId}`,
            type: 'rectangle', 
            props: { fill: '#FF9900' },
            layout: { width: 100, height: 30 },
        };

        return { newElementConfig };
    }
    
    private static _validateNotEmpty(name: string, entityType: string): { isValid: boolean, error?: string } {
        if (!name.trim()) {
            return { isValid: false, error: `${entityType} cannot be empty.` };
        }
        return { isValid: true };
    }

    private static _validateNoLeadingTrailingSpaces(name: string, entityType: string): { isValid: boolean, error?: string } {
        if (name !== name.trim()) {
            return { isValid: false, error: `${entityType} cannot have leading or trailing spaces.` };
        }
        return { isValid: true };
    }

    private static _validateAllowedCharacters(name: string, entityType: string): { isValid: boolean, error?: string } {
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            return { isValid: false, error: `${entityType} must only contain letters, numbers, underscores (_), or hyphens (-).` };
        }
        return { isValid: true };
    }

    private static _validateIsUnique(name: string, entityType: string, existingIds?: Set<string>): { isValid: boolean, error?: string } {
        if (existingIds && existingIds.has(name)) {
            return { isValid: false, error: `${entityType} '${name}' already exists.` };
        }
        return { isValid: true };
    }
    
    static validateIdentifier(name: string, entityType: string, existingIds?: Set<string>): { isValid: boolean, error?: string } {
        const trimmedName = name.trim();

        let validationResult = LcarsGroup._validateNotEmpty(trimmedName, entityType);
        if (!validationResult.isValid) return validationResult;

        // Note: The original check was `name !== trimmedName`. If `trimmedName` is used for subsequent checks,
        // this effectively means we're checking against a version of the name that *would* be valid
        // regarding leading/trailing spaces. If the intent is to fail if the *original* input `name`
        // had leading/trailing spaces, this check should use `name`.
        // For now, assuming we validate the original `name` for spaces.
        validationResult = LcarsGroup._validateNoLeadingTrailingSpaces(name, entityType);
        if (!validationResult.isValid) return validationResult;
        
        validationResult = LcarsGroup._validateAllowedCharacters(trimmedName, entityType);
        if (!validationResult.isValid) return validationResult;
        
        validationResult = LcarsGroup._validateIsUnique(trimmedName, entityType, existingIds);
        if (!validationResult.isValid) return validationResult;
        
        return { isValid: true };
    }
}
```

## File: src/editor/lcars-card-editor.ts

```typescript
import { LitElement, html, TemplateResult, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
import { LcarsCardConfig } from '../lovelace-lcars-card.js';

import { editorStyles } from '../styles/styles.js';
import { 
  renderGroup, 
  renderNewGroupForm
} from './renderer.js';

import './grid-selector.js';
import { EditorElement } from './elements/element.js';
import './elements/rectangle.js';
import './elements/text.js';
import './elements/elbow.js';
import './elements/endcap.js';
import './elements/chisel_endcap.js';
import './elements/top_header.js';

import { LcarsGroup } from './group.js';
import { Rectangle } from './elements/rectangle.js';

function setDeep(obj: any, path: string | string[], value: any): void {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    let current = obj;
    for (let i = 0; i < pathArray.length - 1; i++) {
        const key = pathArray[i];
        if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
            current[key] = {};
        }
        current = current[key];
    }
    if (current && typeof current === 'object') {
       current[pathArray[pathArray.length - 1]] = value;
    } else {
        console.error("Error in setDeep: final path segment is not an object", obj, path, value);
    }
}
function unsetDeep(obj: any, path: string | string[]): boolean {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    let current = obj;
    for (let i = 0; i < pathArray.length - 1; i++) {
        const key = pathArray[i];
        if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
            return false;
        }
        current = current[key];
    }
    const finalKey = pathArray[pathArray.length - 1];
    if (current && typeof current === 'object' && finalKey in current) {
        delete current[finalKey];
        return true;
    }
    return false;
}

@customElement('lcars-card-editor')
export class LcarsCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: LcarsCardConfig;
  @state() private _selectedTabIndex: number = 0;

  @state() private _groups: string[] = [];
  @state() private _groupInstances: Map<string, LcarsGroup> = new Map();
  @state() private _collapsedGroups: { [groupId: string]: boolean } = {};
  @state() private _newGroupDraft: string | null = null;
  @state() private _newGroupInput: string = '';
  @state() private _editingGroup: string | null = null;
  @state() private _editingGroupInput: string = '';
  @state() private _deleteWarningGroup: string | null = null;
  @state() private _groupIdWarning: string = '';

  @state() private _collapsedElements: { [elementId: string]: boolean } = {};
  @state() private _editingElementId: string | null = null;
  @state() private _editingElementIdInput: string = '';
  @state() private _elementIdWarning: string = '';
  @state() private _addElementDraftGroup: string | null = null;
  @state() private _addElementInput: string = '';
  @state() private _addElementWarning: string = '';

  private _draggedElementId: string | null = null;
  private _dragOverElementId: string | null = null;

  public setConfig(config: LcarsCardConfig): void {
    const prevConfig = this._config;
    this._config = {
        ...config,
        elements: config.elements || []
    };
    this._extractGroupsAndInitState(prevConfig?.elements);
  }

  private _extractGroupsAndInitState(prevElements?: any[]): void {
    if (!this._config?.elements) {
        this._groups = [];
        this._groupInstances.clear();
        this._collapsedGroups = {};
        this._collapsedElements = {};
        return;
    }

    const currentElements = this._config.elements;
    const currentGroupIds = new Set<string>();
    const currentElementMap = new Map<string, any>();

    currentElements.forEach(el => {
        if (el?.id) {
            currentElementMap.set(el.id, el);
            const groupId = el.id.split('.')[0];
            if (groupId) {
                currentGroupIds.add(groupId);
            }
        }
    });

    const newGroups = Array.from(currentGroupIds).sort();
    const newGroupInstances = new Map<string, LcarsGroup>();
    const newCollapsedGroups: { [groupId: string]: boolean } = {};
    const newCollapsedElements: { [elementId: string]: boolean } = {};

    newGroups.forEach(gid => {
        let instance = this._groupInstances.get(gid);
        if (!instance) {
            instance = new LcarsGroup(gid);
        } else {
             instance.id = gid;
        }
        newGroupInstances.set(gid, instance);
        newCollapsedGroups[gid] = this._collapsedGroups[gid] ?? instance.isCollapsed; 
        instance.isCollapsed = newCollapsedGroups[gid];
    });

    currentElements.forEach(el => {
        if (el?.id) {
            newCollapsedElements[el.id] = this._collapsedElements[el.id] ?? true;
        }
    });

    this._groups = newGroups;
    this._groupInstances = newGroupInstances;
    this._collapsedGroups = newCollapsedGroups;
    this._collapsedElements = newCollapsedElements;
  }

  private _updateConfig(newElements: any[]): void {
      
      const oldElementIds = this._config?.elements?.map(el => el.id) || [];
      
      this._config = { ...(this._config || { type: 'lcars-card' }), elements: newElements };
      
      const newElementIds = newElements.map(el => el.id);
      const addedIds = newElementIds.filter(id => !oldElementIds.includes(id));
      const removedIds = oldElementIds.filter(id => !newElementIds.includes(id));
      
      this._extractGroupsAndInitState();
      fireEvent(this, 'config-changed', { config: this._config });
  }

  private _findElementIndex(elementId: string): number {
      return this._config?.elements?.findIndex(el => el.id === elementId) ?? -1;
  }

  private _toggleGroupCollapse(groupId: string): void { 
      this._collapsedGroups = { ...this._collapsedGroups, [groupId]: !this._collapsedGroups[groupId] };
      if (this._editingGroup === groupId) {
           this._cancelEditGroup();
      }
      if (this._deleteWarningGroup === groupId) {
           this._cancelDeleteGroup();
      }
      this.requestUpdate();
  }
  
  private async _addGroup(): Promise<void> { 
       if (this._newGroupDraft) return;
      this._newGroupDraft = '__new__';
      this._newGroupInput = '';
      this._groupIdWarning = '';
      await this.requestUpdate();
  }
  private _confirmNewGroup(): void { 
      const name = this._newGroupInput;
      const validation = LcarsGroup.validateIdentifier(name, "Group ID", new Set(this._groups));

      if (!validation.isValid) {
          this._groupIdWarning = validation.error || 'Invalid group name.';
          this.requestUpdate();
          return;
      }
      
      const newInstance = new LcarsGroup(name);
      this._groups = [...this._groups, name].sort();
      this._groupInstances.set(name, newInstance);
      this._collapsedGroups = { ...this._collapsedGroups, [name]: false };
      
      this._newGroupDraft = null;
      this._newGroupInput = '';
      this._groupIdWarning = '';

      this.requestUpdate(); 
  }
  private _cancelNewGroup(): void {
      this._newGroupDraft = null;
      this._newGroupInput = '';
      this._groupIdWarning = '';
      this.requestUpdate();
  }
  private _startEditGroup(groupId: string): void {
      const groupInstance = this._groupInstances.get(groupId);
      if (!groupInstance) {
          console.error(`Cannot start editing non-existent group: ${groupId}`);
          return;
      }
      
      groupInstance.startEditingName();
      
      this._editingGroup = groupId;
      this._editingGroupInput = groupId;
      this._groupIdWarning = groupInstance.editErrorMessage;
      this.requestUpdate();
  }
  private _handleConfirmEditGroup(groupId: string): void { 
       if (!groupId) {
           console.error("Cannot confirm edit for null/empty group ID");
           this._cancelEditGroup();
           return;
       }

       const groupInstance = this._groupInstances.get(groupId);
       if (!groupInstance) {
           console.error(`Cannot confirm edit for non-existent group instance: ${groupId}`);
           this._cancelEditGroup();
           return;
       }

       groupInstance.updateNameInput(this._editingGroupInput);

       const result = groupInstance.confirmEditName(new Set(this._groups));

       if (!result) {
            this._groupIdWarning = groupInstance.editErrorMessage;
            if (!groupInstance.isEditingName) { 
                 this._cancelEditGroup(); 
            }
            this.requestUpdate();
            return;
       }

       const { oldId, newId } = result; 

       if (this._groups.includes(newId)) {
           groupInstance.editErrorMessage = 'Group name already exists.'; 
           groupInstance.isEditingName = true; 
           this._groupIdWarning = groupInstance.editErrorMessage; 
           this.requestUpdate();
           return; 
       }

       this._groups = this._groups.map(g => g === oldId ? newId : g).sort();
       const { [oldId]: oldVal, ...rest } = this._collapsedGroups;
       this._collapsedGroups = { ...rest, [newId]: oldVal ?? false }; 
       
       this._groupInstances.delete(oldId); 
       groupInstance.id = newId; 
       this._groupInstances.set(newId, groupInstance); 
       
       const currentElements = this._config?.elements || [];
       const newElements = currentElements.map(el => {
           let updatedEl = { ...el };
           if (updatedEl.id?.startsWith(oldId + '.')) {
               const baseId = updatedEl.id.substring(oldId.length + 1);
               updatedEl.id = `${newId}.${baseId}`;
           }
           
           if (updatedEl.layout?.anchor?.anchorTo?.startsWith(oldId + '.')) {
               const targetBaseId = updatedEl.layout.anchor.anchorTo.substring(oldId.length + 1);
               if (!updatedEl.layout) updatedEl.layout = {};
               if (!updatedEl.layout.anchor) updatedEl.layout.anchor = { anchorTo: '', anchorPoint: '', targetAnchorPoint: '' };
               updatedEl.layout.anchor.anchorTo = `${newId}.${targetBaseId}`;
           }
           if (updatedEl.layout?.stretch?.stretchTo1?.startsWith(oldId + '.')) {
               const targetBaseId = updatedEl.layout.stretch.stretchTo1.substring(oldId.length + 1);
               if (!updatedEl.layout) updatedEl.layout = {};
               if (!updatedEl.layout.stretch) updatedEl.layout.stretch = { stretchTo1: '', targetStretchAnchorPoint1: '' };
               updatedEl.layout.stretch.stretchTo1 = `${newId}.${targetBaseId}`;
           }
           return updatedEl;
       });

       this._editingGroup = null;
       this._editingGroupInput = '';
       this._groupIdWarning = '';
       
       this._updateConfig(newElements);
   }
  private _cancelEditGroup(): void { 
      this._editingGroup = null;
      this._editingGroupInput = '';
      this._groupIdWarning = '';
      this.requestUpdate();
  }
  private _requestDeleteGroup(groupId: string): void { 
      const hasElements = (this._config?.elements || []).some(el => el.id?.startsWith(groupId + '.'));
      if (hasElements) {
          this._deleteWarningGroup = groupId;
          this.requestUpdate();
      } else {
          this._handleConfirmDeleteGroup(groupId); 
      }
  }
  private _handleConfirmDeleteGroup(groupId: string): void {
       this._groups = this._groups.filter(g => g !== groupId);
       const { [groupId]: _removed, ...rest } = this._collapsedGroups;
       this._collapsedGroups = rest;

       const currentElements = this._config?.elements || [];
       const elementsToRemove = new Set(currentElements.filter(el => el.id?.startsWith(groupId + '.')).map(el => el.id));
       const elementsToKeep = currentElements.filter(el => 
           !el.id?.startsWith(groupId + '.') &&
           !(el.layout?.anchor?.anchorTo && elementsToRemove.has(el.layout.anchor.anchorTo)) &&
           !(el.layout?.stretch?.stretchTo1 && elementsToRemove.has(el.layout.stretch.stretchTo1))
       );
       
       if (this._editingGroup === groupId) this._cancelEditGroup(); 
       this._deleteWarningGroup = null;

       this._updateConfig(elementsToKeep);
  }
  private _cancelDeleteGroup(): void { 
      this._deleteWarningGroup = null;
      this.requestUpdate();
  }

  private _toggleElementCollapse(elementId: string): void { 
      this._collapsedElements = { ...this._collapsedElements, [elementId]: !this._collapsedElements[elementId] };
      if (this._editingElementId === elementId) {
           this._cancelEditElementId();
      }
      this.requestUpdate();
  }
  
  private async _addElement(groupId: string): Promise<void> { 
       if (this._addElementDraftGroup) return;
      this._addElementDraftGroup = groupId;
      this._addElementInput = ''; 
      this._addElementWarning = '';
      await this.requestUpdate();
  }
  private _confirmAddElement(): void {
      const groupId = this._addElementDraftGroup;
      const baseId = this._addElementInput.trim();
      if (!groupId) {
          console.error("Cannot add element without target group ID");
          this._cancelAddElement();
          return;
      }

      const groupInstance = this._groupInstances.get(groupId);
      if (!groupInstance) {
          console.error(`Could not find group instance for ID: ${groupId}`);
          this._addElementWarning = `Error finding group ${groupId}`;
          this.requestUpdate();
          return;
      }

      const existingElementIdsInGroup = new Set(
          (this._config?.elements || [])
              .filter(el => el.id?.startsWith(groupId + '.'))
              .map(el => el.id)
      );

      const result = groupInstance.requestAddElement(baseId, existingElementIdsInGroup);

      if (result.error) {
          this._addElementWarning = result.error;
          this.requestUpdate();
          return; 
      }

      if (result.newElementConfig) {
          const currentElements = this._config?.elements || [];
          const newElements = [...currentElements, result.newElementConfig];
          
          this._collapsedElements = { ...(this._collapsedElements || {}), [result.newElementConfig.id]: false }; 
          this._addElementDraftGroup = null;
          this._addElementInput = '';
          this._addElementWarning = '';
          
          this._updateConfig(newElements);
      } else {
           console.warn("requestAddElement returned no config and no error");
           this._cancelAddElement(); 
      }
  }
  private _cancelAddElement(): void { 
      this._addElementDraftGroup = null;
      this._addElementInput = '';
      this._addElementWarning = '';
      this.requestUpdate();
  }
  private _handleDeleteElement(elementId: string): void {
      const currentElements = this._config?.elements || [];
      const newElements = currentElements.filter(el => 
           el.id !== elementId && 
           el.layout?.anchor?.anchorTo !== elementId && 
           el.layout?.stretch?.stretchTo1 !== elementId
      );

      const { [elementId]: _r, ...restCol } = this._collapsedElements;
      this._collapsedElements = restCol;

      if (this._editingElementId === elementId) {
          this._cancelEditElementId();
      }

      this._updateConfig(newElements);
  }
  private _startEditElementId(elementId: string): void { 
      const elementInstance = this._getElementInstance(elementId); 
      if (!elementInstance) {
          console.error(`Cannot start editing non-existent element: ${elementId}`);
          return;
      }
      
      elementInstance.startEditingId();
      
      this._editingElementId = elementId;
      this._editingElementIdInput = elementInstance.getBaseId(); 
      this._elementIdWarning = elementInstance.idEditErrorMessage;
      this.requestUpdate();
  }
  private _handleConfirmEditElementId(elementInstance: EditorElement): void { 
      const elementId = this._editingElementId;
      if (!elementId) {
          console.error("Trying to confirm edit for null element ID");
          this._cancelEditElementId();
          return;
      }

      elementInstance.updateIdInput(this._editingElementIdInput);
      
      elementInstance.isEditingId = true;
      
      const result = elementInstance.confirmEditId();
      if (!result) { 
          this._elementIdWarning = elementInstance.idEditErrorMessage;
          if (elementInstance.idEditErrorMessage === '') { 
              this._cancelEditElementId();
          }
          this.requestUpdate();
          return;
      }

      const { oldId, newId } = result;

      if (this._config?.elements?.some(el => el.id === newId && el.id !== oldId)) {
          this._elementIdWarning = 'ID already exists in this group.';
          this.requestUpdate();
          return;
      }

      const currentElements = this._config?.elements || [];
      
      const index = this._findElementIndex(oldId);
      if (index === -1) {
          console.error(`Could not find element with ID ${oldId} in config`);
          this._elementIdWarning = 'Element not found in config';
          this.requestUpdate();
          return;
      }
      
      const newElements = [...currentElements];
      
      const updatedElement = { ...newElements[index], id: newId };
      newElements[index] = updatedElement;
      
      for (let i = 0; i < newElements.length; i++) {
          if (i === index) continue; 
          
          const el = newElements[i];
          let needsUpdate = false;
          
          let updatedLayout = el.layout;
          
          if (el.layout?.anchor?.anchorTo === oldId) {
              if (!needsUpdate) {
                  updatedLayout = { ...el.layout };
                  if (updatedLayout && !updatedLayout.anchor) updatedLayout.anchor = { anchorTo: '' };
                  needsUpdate = true;
              }
              if(updatedLayout?.anchor) updatedLayout.anchor.anchorTo = newId;
          }
          
          if (el.layout?.stretch?.stretchTo1 === oldId) {
              if (!needsUpdate) {
                  updatedLayout = { ...el.layout };
                  if (updatedLayout && !updatedLayout.stretch) updatedLayout.stretch = { stretchTo1: '', targetStretchAnchorPoint1: '' };
                  needsUpdate = true;
              }
              if(updatedLayout?.stretch) updatedLayout.stretch.stretchTo1 = newId;
          }
          
          if (needsUpdate) {
              newElements[i] = { ...el, layout: updatedLayout };
          }
      }

      const { [oldId]: oldCollapseVal, ...restCol } = this._collapsedElements;
      this._collapsedElements = { ...restCol, [newId]: oldCollapseVal ?? false }; 
      
      this._editingElementId = null;
      this._editingElementIdInput = '';
      this._elementIdWarning = '';

      this._updateConfig(newElements);
  }
  private _cancelEditElementId(): void { 
      this._editingElementId = null;
      this._editingElementIdInput = '';
      this._elementIdWarning = '';
      this.requestUpdate();
  }

  private _getElementInstance(elementId: string): EditorElement | null {
      const index = this._findElementIndex(elementId);
      if (index === -1 || !this._config?.elements) {
          console.error(`Element with ID ${elementId} not found in config.`);
          return null;
      }
      const elementConfig = this._config.elements[index];
      const instance = EditorElement.create(elementConfig);
      if (!instance) {
           console.error(`Could not create instance for element ID ${elementId} with type ${elementConfig?.type}`);
      }
      return instance;
  }

  private _onDragStart(ev: DragEvent, elementId: string): void { 
       this._draggedElementId = elementId;
      if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = 'move';
          
          const draggedEl = this.renderRoot.querySelector(`.element-editor[data-element-id="${elementId}"]`) as HTMLElement | null;
          if (draggedEl) {
              const ghost = draggedEl.cloneNode(true) as HTMLElement;
              ghost.style.position = 'absolute';
              ghost.style.top = '-9999px';
              ghost.style.left = '-9999px';
              ghost.style.width = `${draggedEl.offsetWidth}px`;
              ghost.style.height = 'auto';
              ghost.style.opacity = '0.7';
              ghost.style.pointerEvents = 'none';
              ghost.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              ghost.style.background = getComputedStyle(draggedEl).background;
              
              document.body.appendChild(ghost);
              
              const rect = draggedEl.getBoundingClientRect();
              const offsetX = ev.clientX - rect.left;
              const offsetY = ev.clientY - rect.top;
              
              ev.dataTransfer.setDragImage(ghost, offsetX, offsetY);
              
              setTimeout(() => {
                  document.body.removeChild(ghost);
              }, 0);
          }
      }
  }
  private _onDragOver(ev: DragEvent, targetElementId: string): void { 
       ev.preventDefault();
      if (this._draggedElementId === targetElementId) {
          this._dragOverElementId = null;
          return;
      }
      const draggedGroup = this._draggedElementId?.split('.')[0];
      const targetGroup = targetElementId.split('.')[0];
      if (draggedGroup === targetGroup) {
           this._dragOverElementId = targetElementId;
           if(ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      } else {
           this._dragOverElementId = null;
           if(ev.dataTransfer) ev.dataTransfer.dropEffect = 'none';
      }
      this.requestUpdate();
  }
  private _onDrop(ev: DragEvent, targetElementId: string): void { 
      ev.preventDefault();
      if (!this._draggedElementId || this._draggedElementId === targetElementId) {
          this._onDragEnd(ev);
          return;
      }
      const draggedGroup = this._draggedElementId.split('.')[0];
      const targetGroup = targetElementId.split('.')[0];
      if (draggedGroup !== targetGroup) {
          this._onDragEnd(ev);
          return;
      }
      const elements = [...(this._config?.elements || [])];
      const draggedIndex = elements.findIndex(el => el.id === this._draggedElementId);
      const targetIndex = elements.findIndex(el => el.id === targetElementId);
      if (draggedIndex === -1 || targetIndex === -1) {
          this._onDragEnd(ev);
          return;
      }
      
      const [movedElement] = elements.splice(draggedIndex, 1);
      elements.splice(targetIndex, 0, movedElement);
      
      this._draggedElementId = null;
      this._dragOverElementId = null;
      this._updateConfig(elements);
  }
  private _onDragEnd(ev: DragEvent): void { 
      this._draggedElementId = null;
      this._dragOverElementId = null;
      
      this.requestUpdate();
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    return html`
      <div class="card-config">
        <ha-tabs
          scrollable
          .selected=${this._selectedTabIndex}
          @iron-select=${(ev: CustomEvent) => (this._selectedTabIndex = parseInt(ev.detail.item.getAttribute('data-tab-index'), 10))}
        >
            <paper-tab data-tab-index="0">
                LCARS Elements (${this._config.elements?.length || 0})
            </paper-tab>
            <paper-tab data-tab-index="1">
                Card Config (TBD)
            </paper-tab>
        </ha-tabs>

        ${this._selectedTabIndex === 0 ? this._renderGroupListUsingModules() : this._renderCardConfigEditor()}
      </div>
    `;
  }

  private _renderCardConfigEditor(): TemplateResult {
      return html`<p style="padding: 16px;">Card configuration options will go here.</p>`;
  }

  private _renderGroupListUsingModules(): TemplateResult {
    const elements = this._config?.elements || [];
    const groupedElements: { [groupId: string]: any[] } = {};

    elements.forEach(el => {
        const gid = el.id?.split('.')[0] || '__ungrouped__';
        if (!groupedElements[gid]) groupedElements[gid] = [];
        groupedElements[gid].push(el);
    });

    this._groups.forEach(gid => {
        if (!groupedElements[gid]) groupedElements[gid] = [];
    });

    const editorContext = {
        hass: this.hass,
        cardConfig: this._config,
        handleFormValueChanged: this._handleFormValueChanged.bind(this),
        getElementInstance: this._getElementInstance.bind(this),
        onDragStart: this._onDragStart.bind(this),
        onDragOver: this._onDragOver.bind(this),
        onDrop: this._onDrop.bind(this),
        onDragEnd: this._onDragEnd.bind(this),
        toggleElementCollapse: this._toggleElementCollapse.bind(this),
        startEditElementId: this._startEditElementId.bind(this),
        handleDeleteElement: this._handleDeleteElement.bind(this),
        handleConfirmEditElementId: this._handleConfirmEditElementId.bind(this),
        cancelEditElementId: this._cancelEditElementId.bind(this),
        updateElementIdInput: this._updateElementIdInput.bind(this),
        updateElementConfigValue: this._updateElementConfigValue.bind(this),
        
        editingElementId: this._editingElementId,
        editingElementIdInput: this._editingElementIdInput,
        elementIdWarning: this._elementIdWarning,
        collapsedElements: this._collapsedElements,
        draggedElementId: this._draggedElementId,
        dragOverElementId: this._dragOverElementId
    };

    const groupContext = {
        toggleGroupCollapse: this._toggleGroupCollapse.bind(this),
        startEditGroup: this._startEditGroup.bind(this),
        requestDeleteGroup: this._requestDeleteGroup.bind(this),
        addElement: this._addElement.bind(this),
        handleConfirmEditGroup: this._handleConfirmEditGroup.bind(this),
        cancelEditGroup: this._cancelEditGroup.bind(this),
        handleConfirmDeleteGroup: this._handleConfirmDeleteGroup.bind(this),
        cancelDeleteGroup: this._cancelDeleteGroup.bind(this),
        confirmAddElement: this._confirmAddElement.bind(this),
        cancelAddElement: this._cancelAddElement.bind(this),
        updateGroupNameInput: this._updateGroupNameInput.bind(this),
        updateNewElementInput: this._updateNewElementInput.bind(this),
        confirmNewGroup: this._confirmNewGroup.bind(this),
        cancelNewGroup: this._cancelNewGroup.bind(this),
        addGroup: this._addGroup.bind(this),
        
        collapsedGroups: this._collapsedGroups,
        editingGroup: this._editingGroup,
        editingGroupInput: this._editingGroupInput,
        groupIdWarning: this._groupIdWarning,
        deleteWarningGroup: this._deleteWarningGroup,
        addElementDraftGroup: this._addElementDraftGroup,
        addElementInput: this._addElementInput,
        addElementWarning: this._addElementWarning,
        groupInstances: this._groupInstances,
        newGroupInput: this._newGroupInput
    };

    return html`
      <div class="groups-container">
          <div class="add-group-section" style="margin-bottom: 16px;">
              <ha-button outlined @click=${() => this._addGroup()}>Add New Group</ha-button>
          </div>

          ${this._newGroupDraft ? renderNewGroupForm(groupContext) : ''}

          ${Object.keys(groupedElements).sort().map(groupId => 
            renderGroup(groupId, groupedElements[groupId], editorContext, groupContext)
          )}

          ${groupedElements['__ungrouped__'] && groupedElements['__ungrouped__'].length > 0
              ? renderGroup('__ungrouped__', groupedElements['__ungrouped__'], editorContext, groupContext)
              : ''}
      </div>
    `;
  }

  static styles = editorStyles;

private _handleFormValueChanged(ev: CustomEvent, elementId: string): void {
    if (!this._config?.elements) return;
    ev.stopPropagation();
    const index = this._findElementIndex(elementId);
    if (index === -1) return;

    const formData = ev.detail.value;

    if (Object.keys(formData).length === 1 && formData.hasOwnProperty('type')) {
        const newType = formData.type;
        if (!newType) {
            console.warn('Type selection cleared, no update performed.');
            return;
        }

        const newElementsConfig = structuredClone(this._config.elements);
        const elementToUpdate = newElementsConfig[index];
        elementToUpdate.type = newType;

        this._updateConfig(newElementsConfig);
        this.requestUpdate();
        return;
    }

    const currentElementConfig = this._config.elements[index];
    const elementInstance = EditorElement.create(currentElementConfig);
    if (!elementInstance) {
        console.error(`Could not get element instance for handler (Element ID: ${elementId})`);
        return;
    }

    const cleanedData = elementInstance.processDataUpdate(formData);

    let newElementConfig: any = { id: currentElementConfig.id, type: currentElementConfig.type };

    const propertiesMap = elementInstance.getPropertiesMap();

    propertiesMap.forEach((propInstance, key) => {
        if (cleanedData.hasOwnProperty(key)) {
            let value = cleanedData[key];

            if (key === 'fill' && Array.isArray(value) && value.length === 3) {
                value = this._rgbArrayToHex(value);
            }

            setDeep(newElementConfig, propInstance.configPath, value);
        }
    });
    
    // --- Special handling to preserve stretchTo2 if it already exists ---
    // This might need to be revisited if processDataUpdate handles it sufficiently.
    // If stretchTo2 is part of formData and processDataUpdate processes it, this might be redundant
    // or could conflict if processDataUpdate decides to remove it.
    // However, if processDataUpdate *doesn't* receive stretchTo2 from formData (because it wasn't in the schema that caused the event)
    // but it *was* in the original config, this preserves it.
    // Given that stretchTo2 is now part of getFormData and getSchema, it should be in formData.
    // Let's assume processDataUpdate and the loop above handle it correctly.
    // This specific preservation might no longer be needed if stretchTo2 is always in `cleanedData` when appropriate.
    // For safety, we can keep it, but if stretchTo2 is *cleared* via the form, this would incorrectly add it back.
    //
    // Revised approach: rely on `processDataUpdate` and `setDeep`.
    // If `currentElementConfig.layout?.stretch?.stretchTo2` existed and `cleanedData` doesn't clear it,
    // and `stretchTo2` is a property in `propertiesMap`, `setDeep` will handle it.
    // If `cleanedData` *does* clear it (because the form cleared it), `setDeep` won't set it.
    // The key is that `processDataUpdate` correctly reflects the intent from `formData`.

    if (newElementConfig.props && Object.keys(newElementConfig.props).length === 0) {
        delete newElementConfig.props;
    }
    if (newElementConfig.layout) {
        if (Object.keys(newElementConfig.layout).length === 0) {
            delete newElementConfig.layout;
        } else if (newElementConfig.layout.stretch && Object.keys(newElementConfig.layout.stretch).length === 0) {
            delete newElementConfig.layout.stretch;
            if (Object.keys(newElementConfig.layout).length === 0) {
                delete newElementConfig.layout;
            }
        }
    }

    const updatedElementsArray = [...this._config.elements];
    updatedElementsArray[index] = newElementConfig;

    this._updateConfig(updatedElementsArray);
    this.requestUpdate();
}
  
  private _rgbArrayToHex(rgb: number[]): string {
      return '#' + rgb.map(val => {
          const hex = Math.max(0, Math.min(255, val)).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
      }).join('');
  }
  
  private _updateElementConfigValue(elementConfig: any, path: string, value: any): void {
      const pathParts = path.split('.');
      if (pathParts.length === 1) {
          elementConfig[pathParts[0]] = value;
      } else if (pathParts.length === 2) {
          const [section, property] = pathParts;
          if (!elementConfig[section]) {
              elementConfig[section] = {};
          }
          elementConfig[section][property] = value;
      }
  }

  private _updateElementIdInput(value: string): void {
    this._editingElementIdInput = value;
    
    if (this._editingElementId) {
      const elementInstance = this._getElementInstance(this._editingElementId);
      if (elementInstance) {
        elementInstance.currentIdInput = value;
        elementInstance.validateIdInput();
        this._elementIdWarning = elementInstance.idEditErrorMessage;
      }
    }
    
    this.requestUpdate();
  }

  private _updateGroupNameInput(value: string): void {
    if (this._editingGroup) {
      this._editingGroupInput = value;
      
      const groupInstance = this._groupInstances.get(this._editingGroup);
      if (groupInstance) {
        groupInstance.updateNameInput(value);
        this._groupIdWarning = groupInstance.editErrorMessage;
      }
    } else if (this._newGroupDraft) {
      this._newGroupInput = value;
      
      const validation = LcarsGroup.validateIdentifier(value, "Group ID", new Set(this._groups));
      this._groupIdWarning = validation.error || '';
    }
    
    this.requestUpdate();
  }
  
  private _updateNewElementInput(value: string): void {
    this._addElementInput = value;
    
    const tempElement = new Rectangle({ id: '', type: 'rectangle' });
    tempElement.currentIdInput = value;
    tempElement.validateIdInput();
    this._addElementWarning = tempElement.idEditErrorMessage;
    
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-card-editor': LcarsCardEditor;
  }
}
```

## File: src/editor/properties/properties.ts

```typescript
export interface HaFormSchema {
    name: string;
    label?: string;
    selector: any;
    type?: 'string' | 'integer' | 'float' | 'boolean' | 'grid' | 'custom';
    required?: boolean;
    default?: any;
    context?: Record<string, any>;
    options?: { value: string; label: string }[] | Record<string, string>;
    column_min_width?: string;
    schema?: HaFormSchema[];
    element?: string; 
    config?: Record<string, any>;
    grid_columns?: number;
    grid_column_span?: number;
    grid_column_start?: number;
}

export enum PropertyGroup {
    TYPE = 'type',
    ANCHOR = 'anchor',
    STRETCH = 'stretch',
    BUTTON = 'button',
    POSITIONING = 'positioning',
    DIMENSIONS = 'dimensions',
    APPEARANCE = 'appearance',
    TEXT = 'text'
}

export enum Layout {
    FULL = 'full-width',
    HALF = 'half-width',
    HALF_LEFT = 'half-width-left',
    HALF_RIGHT = 'half-width-right',
    CUSTOM = 'custom',
}

export interface PropertySchemaContext {
    otherElementIds?: { value: string; label: string }[];
    layoutData?: any;
}

export interface LcarsPropertyBase {
    name: string;
    label: string;
    configPath: string; 
    propertyGroup: PropertyGroup;
    layout: Layout;
    getSchema(context?: PropertySchemaContext): HaFormSchema;
    formatValueForForm?(value: any): any;
}

// --- UNIFIED STRETCH CLASSES ---

export class StretchTarget implements LcarsPropertyBase {
    name: string;
    label: string;
    configPath: string;
    index: number;
    propertyGroup: PropertyGroup = PropertyGroup.STRETCH;
    layout: Layout = Layout.CUSTOM;

    constructor(index: number = 0) {
        this.index = index;
        const suffix = index === 0 ? '1' : '2';
        
        this.name = `stretchTo${suffix}`;
        this.label = index === 0 ? 'Stretch To' : `Stretch To ${suffix}`;
        this.configPath = `layout.stretch.stretchTo${suffix}`;
    }

    getSchema(context?: PropertySchemaContext): HaFormSchema {
        const options = [
            { value: '', label: '' }, 
            { value: 'container', label: 'Container' },
            ...(context?.otherElementIds || [])
        ];

        const currentValue = context?.layoutData?.stretch?.[`stretchTo${this.index === 0 ? '1' : '2'}`];

        return {
            name: this.name,
            label: this.label,
            column_min_width: '100px',
            grid_column_span: 2,
            selector: { select: { options: options, mode: 'dropdown' } },
            required: false,
            default: ''
        };
    }
}
export class StretchDirection implements LcarsPropertyBase {
    name: string;
    label: string;
    configPath: string;
    index: number;
    propertyGroup: PropertyGroup = PropertyGroup.STRETCH;
    layout: Layout = Layout.CUSTOM;

    constructor(index: number = 0) {
        this.index = index;
        const suffix = index === 0 ? '1' : '2';
        
        this.name = `stretchDirection${suffix}`;
        this.label = 'Direction';
        this.configPath = `layout.stretch.targetStretchAnchorPoint${suffix}`;
    }

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom',
            column_min_width: '100px',
            grid_column_start: 2, 
            grid_column_span: 1, 
            grid_columns: 2, 
            selector: { 
                lcars_grid: { 
                    labelCenter: true,
                    clearable: true,
                    required: false,
                    disableCorners: true, 
                    disableCenter: true,
                    onlyCardinalDirections: true,
                    stretchMode: true
                } 
            }
        };
    }
}
export class StretchPadding implements LcarsPropertyBase {
    name: string;
    label: string;
    configPath: string;
    index: number;
    propertyGroup: PropertyGroup = PropertyGroup.STRETCH;
    layout: Layout = Layout.CUSTOM;

    constructor(index: number = 0) {
        this.index = index;
        const suffix = index === 0 ? '1' : '2';
        
        this.name = `stretchPadding${suffix}`;
        this.label = 'Padding (px)';
        this.configPath = `layout.stretch.stretchPadding${suffix}`;
    }

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            column_min_width: '100px',
            grid_column_start: 1, 
            grid_column_span: 1, 
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}

// --- Common Layout Property Classes ---

export class Width implements LcarsPropertyBase {
    name = 'width';
    label = 'Width (px)';
    configPath = 'layout.width';
    propertyGroup: PropertyGroup = PropertyGroup.DIMENSIONS;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}
export class Height implements LcarsPropertyBase {
    name = 'height';
    label = 'Height (px)';
    configPath = 'layout.height';
    propertyGroup: PropertyGroup = PropertyGroup.DIMENSIONS;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}
export class OffsetX implements LcarsPropertyBase {
    name = 'offsetX';
    label = 'Offset X (px)';
    configPath = 'layout.offsetX';
    propertyGroup: PropertyGroup = PropertyGroup.DIMENSIONS;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}
export class OffsetY implements LcarsPropertyBase {
    name = 'offsetY';
    label = 'Offset Y (px)';
    configPath = 'layout.offsetY';
    propertyGroup: PropertyGroup = PropertyGroup.DIMENSIONS;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}

// --- Anchor/Stretch Layout Properties ---

export class AnchorTo implements LcarsPropertyBase {
    name = 'anchorTo';
    label = 'Anchor To';
    configPath = 'layout.anchor.anchorTo';
    propertyGroup: PropertyGroup = PropertyGroup.ANCHOR;
    layout: Layout = Layout.CUSTOM;

    getSchema(context?: PropertySchemaContext): HaFormSchema {
        const options = [
            { value: '', label: '' },
            { value: 'container', label: 'Container' },
            ...(context?.otherElementIds || [])
        ];
        return {
            name: this.name,
            label: this.label,
            selector: { select: { options: options, mode: 'dropdown' } }
        };
    }
}
export class AnchorPoint implements LcarsPropertyBase {
    name = 'anchorPoint';
    label = 'Anchor Point';
    configPath = 'layout.anchor.anchorPoint';
    propertyGroup: PropertyGroup = PropertyGroup.ANCHOR;
    layout: Layout = Layout.CUSTOM;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom',
            selector: { lcars_grid: { labelCenter: true } }
        };
    }
}
export class TargetAnchorPoint implements LcarsPropertyBase {
    name = 'targetAnchorPoint';
    label = 'Target Point';
    configPath = 'layout.anchor.targetAnchorPoint';
    propertyGroup: PropertyGroup = PropertyGroup.ANCHOR;
    layout: Layout = Layout.CUSTOM;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom',
            selector: { lcars_grid: { labelCenter: true } }
        };
    }
}

// --- Common Props Property Classes ---

export class Fill implements LcarsPropertyBase {
    name = 'fill';
    label = 'Fill Color';
    configPath = 'props.fill';
    propertyGroup: PropertyGroup = PropertyGroup.APPEARANCE;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { color_rgb: {} }
        };
    }
    
    formatValueForForm(value: any): any {
        if (Array.isArray(value) && value.length === 3) {
            return value;
        }
        
        if (typeof value === 'string' && value.startsWith('#')) {
            return this.hexToRgb(value);
        }
        
        return value;
    }
    
    private hexToRgb(hex: string): number[] {
        hex = hex.replace(/^#/, '');
        
        if (hex.length === 3) {
            return [
                parseInt(hex[0] + hex[0], 16),
                parseInt(hex[1] + hex[1], 16),
                parseInt(hex[2] + hex[2], 16)
            ];
        } else if (hex.length === 6) {
            return [
                parseInt(hex.substring(0, 2), 16),
                parseInt(hex.substring(2, 4), 16),
                parseInt(hex.substring(4, 6), 16)
            ];
        }
        
        return [0, 0, 0];
    }
}

// --- Top Header Element Props ---

export class LeftTextContent implements LcarsPropertyBase {
    name = 'leftText';
    label = 'Left Text Content';
    configPath = 'props.leftText';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} }
        };
    }
}
export class RightTextContent implements LcarsPropertyBase {
    name = 'rightText';
    label = 'Right Text Content';
    configPath = 'props.rightText';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} }
        };
    }
}

// --- Text Element Props ---

export class TextContent implements LcarsPropertyBase {
    name = 'text';
    label = 'Text Content';
    configPath = 'props.text';
    propertyGroup: PropertyGroup = PropertyGroup.TEXT;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} }
        };
    }
}
export class FontSize implements LcarsPropertyBase {
    name = 'fontSize';
    label = 'Font Size (px)';
    configPath = 'props.fontSize';
    propertyGroup: PropertyGroup = PropertyGroup.TEXT;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 1 } }
        };
    }
}
export class FontFamily implements LcarsPropertyBase {
    name = 'fontFamily';
    label = 'Font Family';
    configPath = 'props.fontFamily';
    propertyGroup: PropertyGroup = PropertyGroup.TEXT;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} }
        };
    }
}
export class FontWeight implements LcarsPropertyBase {
    name = 'fontWeight';
    label = 'Font Weight';
    configPath = 'props.fontWeight';
    propertyGroup: PropertyGroup = PropertyGroup.TEXT;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
              select: {
                options: [
                  { value: '', label: '' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'bold', label: 'Bold' },
                  { value: 'bolder', label: 'Bolder' },
                  { value: 'lighter', label: 'Lighter' },
                  { value: '100', label: '100' }, { value: '200', label: '200' }, { value: '300', label: '300' },
                  { value: '400', label: '400' }, { value: '500', label: '500' }, { value: '600', label: '600' },
                  { value: '700', label: '700' }, { value: '800', label: '800' }, { value: '900', label: '900' },
                ],
              },
            }
        };
    }
}
export class LetterSpacing implements LcarsPropertyBase {
    name = 'letterSpacing';
    label = 'Letter Spacing';
    configPath = 'props.letterSpacing';
    propertyGroup: PropertyGroup = PropertyGroup.TEXT;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}
export class TextAnchor implements LcarsPropertyBase {
    name = 'textAnchor';
    label = 'Text Anchor';
    configPath = 'props.textAnchor';
    propertyGroup: PropertyGroup = PropertyGroup.TEXT;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
              select: {
                options: [
                  { value: '', label: '' },
                  { value: 'start', label: 'Start' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'end', label: 'End' },
                ],
                mode: 'dropdown'
              },
            }
        };
    }
}
export class DominantBaseline implements LcarsPropertyBase {
    name = 'dominantBaseline';
    label = 'Dominant Baseline';
    configPath = 'props.dominantBaseline';
    propertyGroup: PropertyGroup = PropertyGroup.TEXT;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
              select: {
                options: [
                  { value: '', label: '' },
                  { value: 'auto', label: 'Auto' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'central', label: 'Central' },
                  { value: 'hanging', label: 'Hanging' },
                ],
                mode: 'dropdown'
              },
            }
        };
    }
}
export class TextTransform implements LcarsPropertyBase {
    name = 'textTransform';
    label = 'Text Transform';
    configPath = 'props.textTransform';
    propertyGroup: PropertyGroup = PropertyGroup.TEXT;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} }
        };
    }
}

// --- Elbow Element Props ---

export class Orientation implements LcarsPropertyBase {
    name = 'orientation';
    label = 'Orientation';
    configPath = 'props.orientation';
    propertyGroup: PropertyGroup = PropertyGroup.APPEARANCE;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
              select: {
                options: [
                  { value: 'top-left', label: 'Top Left' },
                  { value: 'top-right', label: 'Top Right' },
                  { value: 'bottom-left', label: 'Bottom Left' },
                  { value: 'bottom-right', label: 'Bottom Right' },
                ],
                mode: 'dropdown'
              },
            },
            default: 'top-left',
        };
    }
}
export class BodyWidth implements LcarsPropertyBase {
    name = 'bodyWidth';
    label = 'Body Width (px)';
    configPath = 'props.bodyWidth';
    propertyGroup: PropertyGroup = PropertyGroup.DIMENSIONS;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 0 } }
        };
    }
}
export class ArmHeight implements LcarsPropertyBase {
    name = 'armHeight';
    label = 'Arm Height (px)';
    configPath = 'props.armHeight';
    propertyGroup: PropertyGroup = PropertyGroup.DIMENSIONS;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 0 } }
        };
    }
}

// --- Type Property ---
export class Type implements LcarsPropertyBase {
    name = 'type';
    label = 'Element Type';
    configPath = 'type';
    propertyGroup: PropertyGroup = PropertyGroup.TYPE;
    layout: Layout = Layout.FULL;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
                select: {
                    options: [
                        { value: 'rectangle', label: 'Rectangle' },
                        { value: 'text', label: 'Text' },
                        { value: 'endcap', label: 'Endcap' },
                        { value: 'elbow', label: 'Elbow' },
                        { value: 'chisel-endcap', label: 'Chisel Endcap' },
                        { value: 'top_header', label: 'Top Header' },
                    ],
                    mode: 'dropdown'
                },
            },
        };
    }
}

// --- Endcap/Chisel Props ---
export class Direction implements LcarsPropertyBase {
    name = 'direction';
    label = 'Direction';
    configPath = 'props.direction';
    propertyGroup: PropertyGroup = PropertyGroup.APPEARANCE;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
                select: {
                    options: [
                        { value: 'left', label: 'Left' },
                        { value: 'right', label: 'Right' },
                    ],
                    mode: 'dropdown'
                },
            },
        };
    }
}

// --- Button Behavior Property Classes ---

export class ButtonEnabled implements LcarsPropertyBase {
    name = 'button.enabled';
    label = 'Enable Button Behavior';
    configPath = 'button.enabled';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.FULL;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { boolean: {} },
            default: false,
        };
    }
}
export class ButtonText implements LcarsPropertyBase {
    name = 'button.text';
    label = 'Button Text';
    configPath = 'button.text';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} },
        };
    }
}
export class ButtonCutoutText implements LcarsPropertyBase {
    name = 'button.cutout_text';
    label = 'Cutout Text (Mask Effect)';
    configPath = 'button.cutout_text';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { boolean: {} },
            default: false,
        };
    }
}

// --- Button Text Styling Properties ---
export class ButtonTextColor implements LcarsPropertyBase {
    name = 'button.text_color';
    label = 'Button Text Color';
    configPath = 'button.text_color';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { color_rgb: {} } }; }
    formatValueForForm = Fill.prototype.formatValueForForm; // Reuse Fill's hexToRgb
}
export class ButtonFontFamily implements LcarsPropertyBase {
    name = 'button.font_family';
    label = 'Button Font Family';
    configPath = 'button.font_family';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;

    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonFontSize implements LcarsPropertyBase {
    name = 'button.font_size';
    label = 'Button Font Size (px)';
    configPath = 'button.font_size';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { number: { mode: 'box', step: 1, min: 1 } } }; }
}
export class ButtonFontWeight implements LcarsPropertyBase {
    name = 'button.font_weight';
    label = 'Button Font Weight';
    configPath = 'button.font_weight';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return (new FontWeight()).getSchema(); }
}
export class ButtonLetterSpacing implements LcarsPropertyBase {
    name = 'button.letter_spacing';
    label = 'Button Letter Spacing';
    configPath = 'button.letter_spacing';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonTextTransform implements LcarsPropertyBase {
    name = 'button.text_transform';
    label = 'Button Text Transform';
    configPath = 'button.text_transform';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return (new TextTransform()).getSchema(); }
}
export class ButtonTextAnchor implements LcarsPropertyBase {
    name = 'button.text_anchor';
    label = 'Button Text Anchor';
    configPath = 'button.text_anchor';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return (new TextAnchor()).getSchema(); }
}
export class ButtonDominantBaseline implements LcarsPropertyBase {
    name = 'button.dominant_baseline';
    label = 'Button Dominant Baseline';
    configPath = 'button.dominant_baseline';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return (new DominantBaseline()).getSchema(); }
}


// --- Button State Styling Properties ---
export class ButtonHoverFill implements LcarsPropertyBase {
    name = 'button.hover_fill';
    label = 'Hover Fill Color';
    configPath = 'button.hover_fill';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { color_rgb: {} } }; }
    formatValueForForm = Fill.prototype.formatValueForForm;
}
export class ButtonActiveFill implements LcarsPropertyBase {
    name = 'button.active_fill';
    label = 'Active/Pressed Fill Color';
    configPath = 'button.active_fill';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { color_rgb: {} } }; }
    formatValueForForm = Fill.prototype.formatValueForForm;
}
export class ButtonHoverTransform implements LcarsPropertyBase {
    name = 'button.hover_transform';
    label = 'Hover Transform (CSS)';
    configPath = 'button.hover_transform';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonActiveTransform implements LcarsPropertyBase {
    name = 'button.active_transform';
    label = 'Active Transform (CSS)';
    configPath = 'button.active_transform';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ElbowTextPosition implements LcarsPropertyBase {
    name = 'elbow_text_position';
    label = 'Text Position';
    configPath = 'props.elbow_text_position';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
        
    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
                select: {
                    options: [
                        { value: 'top', label: 'Top (Horizontal Section)' },
                        { value: 'side', label: 'Side (Vertical Section)' }
                    ],
                    mode: 'dropdown'
                }
            },
            default: 'top'
        };
    }
} 

// --- Button Action Properties ---
export class ButtonActionType implements LcarsPropertyBase {
    name = 'button.action_config.type';
    label = 'Action Type';
    configPath = 'button.action_config.type';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { aselect: {
 mode: 'dropdown',
 options: [
                        { value: 'none', label: 'None' },
                        { value: 'call-service', label: 'Call Service' },
                        { value: 'navigate', label: 'Navigate' },
                        { value: 'url', label: 'URL' },
                        { value: 'toggle', label: 'Toggle' },
                        { value: 'more-info', label: 'More Info' },
                    ],
                },
            },
            default: 'none',
        };
    }
}
export class ButtonActionService implements LcarsPropertyBase {
    name = 'button.action_config.service';
    label = 'Service (e.g., light.turn_on)';
    configPath = 'button.action_config.service';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonActionServiceData implements LcarsPropertyBase {
    name = 'button.action_config.service_data';
    label = 'Service Data (YAML or JSON)';
    configPath = 'button.action_config.service_data';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { object: {} } }; }
}
export class ButtonActionNavigationPath implements LcarsPropertyBase {
    name = 'button.action_config.navigation_path';
    label = 'Navigation Path (e.g., /lovelace/main)';
    configPath = 'button.action_config.navigation_path';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonActionUrlPath implements LcarsPropertyBase {
    name = 'button.action_config.url_path';
    label = 'URL (e.g., https://example.com)';
    configPath = 'button.action_config.url_path';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonActionEntity implements LcarsPropertyBase {
    name = 'button.action_config.entity';
    label = 'Entity ID';
    configPath = 'button.action_config.entity';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { entity: {} } }; }
}
export class ButtonActionConfirmation implements LcarsPropertyBase {
    name = 'button.action_config.confirmation';
    label = 'Require Confirmation';
    configPath = 'button.action_config.confirmation';
    propertyGroup: PropertyGroup = PropertyGroup.BUTTON;
    layout: Layout = Layout.HALF;
    
    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { boolean: {} },
        };
    }
}
```

## File: src/editor/renderer.ts

```typescript
import { html, TemplateResult } from 'lit';
import { EditorElement } from './elements/element.js';
import { LcarsGroup } from './group.js';
import { HaFormSchema, PropertySchemaContext, Type, PropertyGroup, Layout } from './properties/properties.js';
import { repeat } from 'lit/directives/repeat.js';

// Types
interface EditorContext {
  hass: any;
  cardConfig: any;
  handleFormValueChanged: (ev: CustomEvent, elementId: string) => void;
  getElementInstance: (elementId: string) => EditorElement | null;
  onDragStart: (ev: DragEvent, elementId: string) => void;
  onDragOver: (ev: DragEvent, elementId: string) => void;
  onDrop: (ev: DragEvent, elementId: string) => void;
  onDragEnd: (ev: DragEvent) => void;
  toggleElementCollapse: (elementId: string) => void;
  startEditElementId: (elementId: string) => void;
  handleDeleteElement: (elementId: string) => void;
  handleConfirmEditElementId: (elementInstance: EditorElement) => void;
  cancelEditElementId: () => void;
  updateElementIdInput: (value: string) => void;
  
  // State variables
  editingElementId: string | null;
  editingElementIdInput: string;
  elementIdWarning: string;
  collapsedElements: { [elementId: string]: boolean };
  draggedElementId: string | null;
  dragOverElementId: string | null;
}

interface GroupEditorContext {
  toggleGroupCollapse: (groupId: string) => void;
  startEditGroup: (groupId: string) => void;
  requestDeleteGroup: (groupId: string) => void;
  addElement: (groupId: string) => void;
  handleConfirmEditGroup: (groupId: string) => void;
  cancelEditGroup: () => void;
  handleConfirmDeleteGroup: (groupId: string) => void;
  cancelDeleteGroup: () => void;
  confirmAddElement: () => void;
  cancelAddElement: () => void;
  updateGroupNameInput: (value: string) => void;
  updateNewElementInput: (value: string) => void;
  confirmNewGroup: () => void;
  cancelNewGroup: () => void;
  addGroup: () => void;
  
  // State variables
  collapsedGroups: { [groupId: string]: boolean };
  editingGroup: string | null;
  editingGroupInput: string;
  groupIdWarning: string;
  deleteWarningGroup: string | null;
  addElementDraftGroup: string | null;
  addElementInput: string;
  addElementWarning: string;
  groupInstances: Map<string, LcarsGroup>;
  newGroupInput: string;
}

export function renderElement(
  element: any, 
  context: EditorContext
): TemplateResult {
  if (!element || !element.id) return html``; 

  const elementId = element.id;
  const elementInstance = context.getElementInstance(elementId);
  
  const isCollapsed = context.collapsedElements[elementId];
  const isEditingId = context.editingElementId === elementId;
  const baseId = elementId.substring(elementId.indexOf('.') + 1);
  const isDragging = context.draggedElementId === elementId;
  const isDragOver = context.dragOverElementId === elementId;

  if (!elementInstance) {
      const typeProperty = new Type();
      const typeSchema = typeProperty.getSchema();
      const minimalFormData = { type: element.type || '' }; 

      return html`
          <div class="element-editor error" data-element-id=${elementId}>
              <div class="element-header ${isEditingId ? 'editing' : ''}" @click=${() => !isEditingId && context.toggleElementCollapse(elementId)}>
                  <ha-icon class="collapse-icon" icon="mdi:${isCollapsed ? 'chevron-right' : 'chevron-down'}"></ha-icon>
                  ${isEditingId
                      ? html`<!-- ID Editing might be problematic without instance, handle carefully or disable -->
                         <span class="element-name">Editing ID: ${baseId || '(no base id)'}</span> 
                         <span class="element-type" style="color: var(--error-color);">(invalid type)</span>
                         <!-- Disable confirm/cancel or show simplified form without instance dependency? -->
                         <!-- For now, let's just show text and rely on cancel -->
                         <span class="spacer"></span>
                         <div class="editing-actions">
                            <ha-icon-button
                                class="cancel-button"
                                @click=${(e: Event) => { 
                                    e.stopPropagation(); 
                                    context.cancelEditElementId(); 
                                }}
                                title="Cancel"
                            >
                                <ha-icon icon="mdi:close"></ha-icon>
                            </ha-icon-button>
                         </div>
                      `
                      : html`
                         <span class="element-name">${baseId || '(no base id)'}</span>
                         <span class="element-type" style="color: var(--error-color);">(invalid type: "${element.type || ''}")</span>
                         <span class="spacer"></span>
                         <!-- Allow editing ID even in error state -->
                         <div class="edit-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.startEditElementId(elementId); }} title="Edit Element ID">
                            <ha-icon icon="mdi:pencil"></ha-icon>
                         </div>
                         <!-- Allow deletion -->
                         <div class="delete-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.handleDeleteElement(elementId); }} title="Delete Element">
                            <ha-icon icon="mdi:delete"></ha-icon>
                         </div>
                      `
                  }
              </div>

              ${!isCollapsed ? html`
                  <div class="element-body">
                      <div class="property-container">
                          <div class="property-full-width">
                               <p style="color: var(--error-color);">Please select a valid element type:</p>
                               <ha-form
                                 .hass=${context.hass}
                                 .data=${minimalFormData} 
                                 .schema=${[typeSchema]} 
                                 .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                                 @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                               ></ha-form>
                          </div>
                      </div>
                  </div>
              ` : ''}
          </div>
      `;
  }

  const otherElementIds = Array.isArray(context.cardConfig?.elements) 
      ? context.cardConfig.elements
          .filter((el: any) => el.id && el.id !== elementId)  
          .map((el: any) => ({ value: el.id, label: el.id }))
      : [];
  
  const schemaContext: PropertySchemaContext = { otherElementIds };
  const allSchemas = elementInstance.getSchema(schemaContext);
  const propertiesMap = elementInstance.getPropertiesMap();
  const formData = elementInstance.getFormData();
  
  const renderedPropertyNames = new Set<string>();

  const getSchemaByName = (name: string): HaFormSchema | undefined => allSchemas.find(s => s.name === name);

  // --- Render Type Property (Always First) ---
  const typeSchema = getSchemaByName('type');
  if (typeSchema) {
    renderedPropertyNames.add('type');
  }

  // --- Prepare Anchor Properties (Rendered Conditionally Later) ---
  const anchorToSchema = getSchemaByName('anchorTo');
  const containerAnchorPointSchema = getSchemaByName('containerAnchorPoint'); // This name needs to be consistent with properties.ts
  const anchorPointSchema = getSchemaByName('anchorPoint');
  const targetAnchorPointSchema = getSchemaByName('targetAnchorPoint');

  if (anchorToSchema) renderedPropertyNames.add(anchorToSchema.name);
  if (containerAnchorPointSchema) renderedPropertyNames.add(containerAnchorPointSchema.name);
  if (anchorPointSchema) renderedPropertyNames.add(anchorPointSchema.name);
  if (targetAnchorPointSchema) renderedPropertyNames.add(targetAnchorPointSchema.name);
  
  // --- Prepare Stretch Properties (Rendered Conditionally Later) ---
  const primaryStretchSchema = getSchemaByName('stretchTo1');
  const stretchPadding1Schema = getSchemaByName('stretchPadding1');
  const targetStretchAnchorPoint1Schema = getSchemaByName('stretchDirection1'); // Or targetStretchAnchorPoint1

  const secondaryStretchSchema = getSchemaByName('stretchTo2');
  const stretchPadding2Schema = getSchemaByName('stretchPadding2');
  const targetStretchAnchorPoint2Schema = getSchemaByName('stretchDirection2'); // Or targetStretchAnchorPoint2

  if (primaryStretchSchema) renderedPropertyNames.add(primaryStretchSchema.name);
  if (stretchPadding1Schema) renderedPropertyNames.add(stretchPadding1Schema.name);
  if (targetStretchAnchorPoint1Schema) renderedPropertyNames.add(targetStretchAnchorPoint1Schema.name);
  if (secondaryStretchSchema) renderedPropertyNames.add(secondaryStretchSchema.name);
  if (stretchPadding2Schema) renderedPropertyNames.add(stretchPadding2Schema.name);
  if (targetStretchAnchorPoint2Schema) renderedPropertyNames.add(targetStretchAnchorPoint2Schema.name);

  // --- Prepare Button Properties (Rendered Conditionally Later) ---
  const buttonEnabledSchema = getSchemaByName('button.enabled');
  if (buttonEnabledSchema) renderedPropertyNames.add(buttonEnabledSchema.name);

  const showAnchorPoints = formData.anchorTo && formData.anchorTo !== '';
  const showStretchTarget = formData.stretchTo1 && formData.stretchTo1 !== '';
  const showSecondStretchTarget = formData.stretchTo2 && formData.stretchTo2 !== '';
  
  // Note: The renderProp function has been replaced by renderHalfWidthPropertyForm for more consistent rendering
  
  const renderStandardPropertyGroups = () => {
    const groupOrder = [
        PropertyGroup.APPEARANCE,
        PropertyGroup.DIMENSIONS,
        PropertyGroup.TEXT, // For general text properties, not button text
        PropertyGroup.POSITIONING,
    ];
    
    let propertiesToRender: {schema: HaFormSchema, layout: Layout}[] = [];

    for (const schema of allSchemas) {
        if (renderedPropertyNames.has(schema.name)) continue;
        const propMeta = propertiesMap.get(schema.name);
        if (propMeta && groupOrder.includes(propMeta.propertyGroup)) {
            propertiesToRender.push({schema, layout: propMeta.layout});
        }
    }
    
    // Sort by group order, then by original schema order (implicit)
    propertiesToRender.sort((a, b) => {
        const groupA = propertiesMap.get(a.schema.name)?.propertyGroup;
        const groupB = propertiesMap.get(b.schema.name)?.propertyGroup;
        if (groupA && groupB) {
            const indexA = groupOrder.indexOf(groupA);
            const indexB = groupOrder.indexOf(groupB);
            if (indexA !== indexB) return indexA - indexB;
        }
        return 0; 
    });

    // Create pairs of properties for half-width rendering
    let pairs: TemplateResult[] = [];
    let fullWidthItems: TemplateResult[] = [];
    let halfWidthBuffer: {schema: HaFormSchema, layout: Layout} | null = null;

    for (const item of propertiesToRender) {
        const { schema, layout } = item;
        if (renderedPropertyNames.has(schema.name)) continue; // Double check

        renderedPropertyNames.add(schema.name);

        console.log(`Property ${schema.name} - layout: ${layout}, Layout.FULL: ${Layout.FULL}, Layout.HALF: ${Layout.HALF}, isEqual: ${layout === Layout.HALF}`);

        if (layout === Layout.FULL) {
            if (halfWidthBuffer) { // Render pending half-width if any
                // Create a pair with an empty right side
                pairs.push(html`
                    ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
                    <div class="property-right"></div>
                `);
                halfWidthBuffer = null;
            }
            fullWidthItems.push(renderFullWidthPropertyForm(context, elementId, formData, schema));
        } else if (layout === Layout.HALF || layout === Layout.HALF_LEFT || layout === Layout.HALF_RIGHT) {
            if (!halfWidthBuffer) {
                halfWidthBuffer = item;
            } else {
                // We have a pair - create a row with both properties
                pairs.push(html`
                    ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
                    ${renderHalfWidthPropertyForm(context, elementId, formData, schema, 'property-right')}
                `);
                halfWidthBuffer = null;
            }
        }
    }
    
    // Handle any remaining half-width property
    if (halfWidthBuffer) {
        pairs.push(html`
            ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
            <div class="property-right"></div>
        `);
    }
    
    // Combine all items
    return html`
        ${fullWidthItems}
        ${pairs}
    `;
  };


  const renderButtonProperties = () => {
    if (!formData['button.enabled']) return html``;

    const buttonProperties = allSchemas.filter(s => {
        const propMeta = propertiesMap.get(s.name);
        return propMeta?.propertyGroup === PropertyGroup.BUTTON && s.name !== 'button.enabled' && !renderedPropertyNames.has(s.name);
    });

    // Define sub-sections for buttons
    const appearancePropsNames = ['button.text', 'button.cutout_text', 'button.text_color', 'button.font_family', 'button.font_size', 'button.font_weight', 'button.letter_spacing', 'button.text_transform', 'button.text_anchor', 'button.dominant_baseline', 'elbow_text_position'];
    const stateStylePropsNames = ['button.hover_fill', 'button.active_fill', 'button.hover_transform', 'button.active_transform'];
    const actionPropsNames = ['button.action_config.type', 'button.action_config.service', 'button.action_config.service_data', 'button.action_config.navigation_path', 'button.action_config.url_path', 'button.action_config.entity', 'button.action_config.confirmation'];

    const renderSubGroup = (title: string, propNames: string[]) => {
        // Create pairs of properties for half-width rendering
        let pairs: TemplateResult[] = [];
        let fullWidthItems: TemplateResult[] = [];
        let halfWidthBuffer: HaFormSchema | null = null;
        
        const relevantProps = buttonProperties.filter(s => propNames.includes(s.name));

        for (const schema of relevantProps) {
            if (renderedPropertyNames.has(schema.name)) continue;
            
            // Conditional rendering for action_config
            if (schema.name === 'button.action_config.service' || schema.name === 'button.action_config.service_data') {
                if (formData['button.action_config.type'] !== 'call-service') continue;
            } else if (schema.name === 'button.action_config.navigation_path') {
                if (formData['button.action_config.type'] !== 'navigate') continue;
            } else if (schema.name === 'button.action_config.url_path') {
                if (formData['button.action_config.type'] !== 'url') continue;
            } else if (schema.name === 'button.action_config.entity') {
                if (formData['button.action_config.type'] !== 'toggle' && formData['button.action_config.type'] !== 'more-info') continue;
            } else if (schema.name === 'button.action_config.confirmation') {
                if (!formData['button.action_config.type'] || formData['button.action_config.type'] === 'none') continue;
            }

            renderedPropertyNames.add(schema.name);
            const propMeta = propertiesMap.get(schema.name);

            if (propMeta?.layout === Layout.FULL) {
                if (halfWidthBuffer) {
                    // Create a pair with an empty right side
                    pairs.push(html`
                        ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer, 'property-left')}
                        <div class="property-right"></div>
                    `);
                    halfWidthBuffer = null;
                }
                fullWidthItems.push(renderFullWidthPropertyForm(context, elementId, formData, schema));
            } else if (propMeta?.layout === Layout.HALF || propMeta?.layout === Layout.HALF_LEFT || propMeta?.layout === Layout.HALF_RIGHT) {
                if (!halfWidthBuffer) {
                    halfWidthBuffer = schema;
                } else {
                    // We have a pair - create a row with both properties
                    pairs.push(html`
                        ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer, 'property-left')}
                        ${renderHalfWidthPropertyForm(context, elementId, formData, schema, 'property-right')}
                    `);
                    halfWidthBuffer = null;
                }
            }
        }
        
        // Handle any remaining half-width property
        if (halfWidthBuffer) {
            pairs.push(html`
                ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer, 'property-left')}
                <div class="property-right"></div>
            `);
        }
        
        if (fullWidthItems.length > 0 || pairs.length > 0) {
            return html`
                <div class="property-full-width section-header" style="font-weight: bold; margin-top: 16px; border-bottom: 1px solid var(--divider-color); padding-bottom: 4px;">${title}</div>
                ${fullWidthItems}
                ${pairs}
            `;
        }
        return html``;
    };

    const appearanceSection = renderSubGroup('Button Appearance', appearancePropsNames);
    const styleSection = renderSubGroup('Button State Styles', stateStylePropsNames);
    const actionSection = renderSubGroup('Button Action', actionPropsNames);
    
    return html`${appearanceSection}${styleSection}${actionSection}`;
  };

  const renderOtherProperties = () => {
    const otherPropsSchemas = allSchemas.filter(s => !renderedPropertyNames.has(s.name));
    if (otherPropsSchemas.length > 0) {
        return html`
            <div class="property-full-width" style="margin-top:16px;">
                <div style="font-weight: bold; border-bottom: 1px solid var(--divider-color); padding-bottom: 4px; margin-bottom: 8px;">Other Properties</div>
                <ha-form
                    .hass=${context.hass}
                    .data=${formData}
                    .schema=${otherPropsSchemas}
                    .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                    @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                ></ha-form>
            </div>
        `;
    }
    return html``;
  };


  return html`
    <div class="element-editor ${isDragOver ? 'drag-over' : ''}"
         data-element-id=${elementId}
         draggable="true"
         @dragstart=${(e: DragEvent) => context.onDragStart(e, elementId)}
         @dragover=${(e: DragEvent) => context.onDragOver(e, elementId)}
         @drop=${(e: DragEvent) => context.onDrop(e, elementId)}
         @dragend=${context.onDragEnd}
         style=${isDragging ? 'opacity: 0.4;' : ''}
    >
      <div class="element-header ${isEditingId ? 'editing' : ''}" @click=${() => !isEditingId && context.toggleElementCollapse(elementId)}>
          <ha-icon class="collapse-icon" icon="mdi:${isCollapsed ? 'chevron-right' : 'chevron-down'}"></ha-icon>
          ${isEditingId
              ? renderElementIdEditForm(elementId, elementInstance, context)
              : html`
                  <span class="element-name">${baseId || '(no base id)'}</span>
                  <span class="element-type">(${element.type || 'unknown'})</span>
                `
          }
          <span class="spacer"></span>
          ${!isEditingId ? html`
               <div 
                   class="drag-handle" 
                   title="Drag to reorder" 
                   draggable="true" 
                   @dragstart=${(e: DragEvent) => context.onDragStart(e, elementId)}
                   @mousedown=${(e: MouseEvent) => e.stopPropagation()} /* Prevent text selection */
               >
                   <ha-icon icon="mdi:drag-vertical"></ha-icon>
               </div>
               <div class="edit-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.startEditElementId(elementId); }} title="Edit Element ID">
                   <ha-icon icon="mdi:pencil"></ha-icon>
               </div>
               <div class="delete-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.handleDeleteElement(elementId); }} title="Delete Element">
                   <ha-icon icon="mdi:delete"></ha-icon>
               </div>
          ` : ''}
      </div>

      ${!isCollapsed ? html`
          <div class="element-body">
               <div class="property-container">
                  <!-- Type Property (Always show first) -->
                  ${typeSchema ? renderFullWidthPropertyForm(context, elementId, formData, typeSchema) : ''}
                  
                  <!-- Standard Property Groups -->
                  ${renderStandardPropertyGroups()}
                  
                  <!-- Anchor To Row -->
                  ${anchorToSchema ? renderFullWidthPropertyForm(context, elementId, formData, anchorToSchema) : ''}
                  
                  <!-- Container Anchor Point Selector (show when no specific anchor is selected) -->
                  ${!showAnchorPoints && containerAnchorPointSchema ? html`
                    <div class="property-full-width">
                      ${renderCustomSelector(containerAnchorPointSchema, formData[containerAnchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [containerAnchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }
                      )}
                    </div>
                  ` : ''}
                  
                  <!-- Anchor Point Selectors (always show when anchor is selected) -->
                  ${showAnchorPoints && anchorPointSchema && targetAnchorPointSchema ? html`
                    <div class="property-left">
                      ${renderCustomSelector(anchorPointSchema, formData[anchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [anchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }
                      )}
                    </div>
                    <div class="property-right">
                      ${renderCustomSelector(targetAnchorPointSchema, formData[targetAnchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [targetAnchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }
                      )}
                    </div>
                  ` : ''}
                  
                  <!-- Primary Stretch To Row -->
                  ${primaryStretchSchema ? renderStretchSection(
                    context,
                    elementId,
                    formData,
                    primaryStretchSchema,
                    stretchPadding1Schema,
                    targetStretchAnchorPoint1Schema, // This is StretchDirection schema
                    showStretchTarget
                  ) : ''}

                  <!-- Second Stretch Target Dropdown (only shown if a primary target is selected) -->
                  ${showStretchTarget && secondaryStretchSchema ? renderStretchSection(
                    context,
                    elementId,
                    formData,
                    secondaryStretchSchema,
                    stretchPadding2Schema,
                    targetStretchAnchorPoint2Schema, // This is StretchDirection schema
                    showSecondStretchTarget
                  ) : ''}
                  
                  <!-- === BUTTON CONFIGURATION SECTION === -->
                  ${buttonEnabledSchema ? renderFullWidthPropertyForm(context, elementId, formData, buttonEnabledSchema) : ''}
                  ${renderButtonProperties()}
                  <!-- === END BUTTON CONFIGURATION SECTION === -->

                  <!-- Other Unrendered Properties -->
                  ${renderOtherProperties()}
                  
               </div>
               ${allSchemas.length === 0 ? html`<p>No configurable properties for this element type.</p>` : ''} 
          </div>
          ` : ''}
    </div>
  `;
}

function renderCustomSelector(
  schema: HaFormSchema, 
  value: string, 
  onChange: (value: string) => void
): TemplateResult {
  if (schema.selector.lcars_grid) {
    
    return html`
      <lcars-grid-selector
        .label=${schema.label || schema.name}
        .value=${value || ''}
        ?labelCenter=${schema.selector.lcars_grid.labelCenter}
        ?disableCorners=${schema.selector.lcars_grid.disableCorners}
        ?disableCenter=${schema.selector.lcars_grid.disableCenter}
        ?onlyCardinalDirections=${schema.selector.lcars_grid.onlyCardinalDirections}
        ?stretchMode=${schema.selector.lcars_grid.stretchMode}
        ?clearable=${schema.selector.lcars_grid.clearable}
        ?required=${schema.selector.lcars_grid.required}
        @value-changed=${(e: CustomEvent) => onChange(e.detail.value)}
      ></lcars-grid-selector>
    `;
  }
  return html``;
}

function renderActionButtons(
  isValid: boolean,
  onConfirm: (e: Event) => void,
  onCancel: (e: Event) => void,
  confirmTitle: string = "Confirm",
  cancelTitle: string = "Cancel"
): TemplateResult {
  return html`
    <div class="editing-actions">
      <ha-icon-button
        class="confirm-button ${isValid ? 'valid' : ''}"
        @click=${(e: Event) => { 
            e.stopPropagation(); 
            if (isValid) { onConfirm(e); }
        }}
        title=${confirmTitle}
        .disabled=${!isValid}
      >
        <ha-icon icon="mdi:check"></ha-icon>
      </ha-icon-button>
      <ha-icon-button
        class="cancel-button"
        @click=${(e: Event) => { 
            e.stopPropagation(); 
            onCancel(e);
        }}
        title=${cancelTitle}
      >
        <ha-icon icon="mdi:close"></ha-icon>
      </ha-icon-button>
    </div>
  `;
}

export function renderElementIdEditForm(
  elementId: string, 
  elementInstance: EditorElement,
  context: EditorContext
): TemplateResult {
    const currentInput = context.editingElementIdInput;
    const warningMessage = context.elementIdWarning;
    const isValid = !!currentInput.trim() && !warningMessage;

    return renderInputForm(
      "Edit Element ID (base)",
      currentInput,
      warningMessage,
      isValid,
      (newValue) => {
        elementInstance.updateIdInput(newValue);
        context.updateElementIdInput(newValue);
      },
      (e) => {
        if (e.key === 'Enter' && isValid) {
          e.stopPropagation();
          context.handleConfirmEditElementId(elementInstance);
        }
      },
      () => context.handleConfirmEditElementId(elementInstance),
      () => {
        elementInstance.cancelEditingId();
        context.cancelEditElementId();
      },
      "Rename Element ID",
      "Cancel"
    );
}

function renderInputForm(
  label: string,
  currentInput: string,
  warningMessage: string | null | undefined,
  isValid: boolean,
  onInput: (newValue: string) => void,
  onKeydown: (e: KeyboardEvent) => void,
  onConfirm: (e: Event) => void,
  onCancel: (e: Event) => void,
  confirmTitle: string,
  cancelTitle: string
): TemplateResult {
  return html`
    <div class="element-name-input">
      <ha-textfield
        .label=${label}
        .value=${currentInput}
        @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
        @keydown=${onKeydown}
        autofocus
        required
        .invalid=${!!warningMessage}
      ></ha-textfield>
      ${warningMessage ? html`<div class="warning-text">${warningMessage}</div>` : ''}
    </div>
    ${renderActionButtons(isValid, onConfirm, onCancel, confirmTitle, cancelTitle)}
  `;
}

export function renderGroup(
  groupId: string, 
  elementsInGroup: any[],
  editorContext: EditorContext,
  groupContext: GroupEditorContext
): TemplateResult {
    const isUngrouped = groupId === '__ungrouped__';
    const isCollapsed = groupContext.collapsedGroups[groupId];
    const isEditing = groupContext.editingGroup === groupId;

    return html`
      <div class="group-editor ${isUngrouped ? 'ungrouped' : ''}">
          <div class="group-header ${isEditing ? 'editing' : ''}" @click=${() => !isEditing && groupContext.toggleGroupCollapse(groupId)}>
               <ha-icon icon="mdi:${isCollapsed ? 'chevron-right' : 'chevron-down'}"></ha-icon>
               ${isEditing
                  ? renderGroupEditForm(groupId, groupContext)
                  : html`
                      <span class="group-name">${isUngrouped ? 'Ungrouped Elements' : groupId}</span>
                      <span class="group-count">(${elementsInGroup.length})</span>
                    `
               }
               <span class="spacer"></span>
               ${!isUngrouped && !isEditing && !isCollapsed ? html`
                  <div
                      class="edit-button"
                      @click=${(e: Event) => { e.stopPropagation(); groupContext.startEditGroup(groupId); }}
                      title="Edit Group Name"
                  >
                      <ha-icon icon="mdi:pencil"></ha-icon>
                  </div>
                  <div
                      class="delete-button"
                      @click=${(e: Event) => { e.stopPropagation(); groupContext.requestDeleteGroup(groupId); }}
                      title="Delete Group"
                  >
                      <ha-icon icon="mdi:delete"></ha-icon>
                  </div>
               ` : ''}
          </div>

          ${groupContext.deleteWarningGroup === groupId ? renderGroupDeleteWarning(groupId, groupContext) : ''}

          ${!isCollapsed
              ? html`
                  <div class="element-list">
                      ${repeat(
                          elementsInGroup,
                          (element) => element.id,
                          (element) => renderElement(element, editorContext)
                      )}
                      ${!isUngrouped ? html`
                           <div class="add-element-section">
                              ${groupContext.addElementDraftGroup === groupId
                                  ? renderAddElementForm(groupContext)
                                  : html`<ha-button small outlined @click=${() => groupContext.addElement(groupId)}>Add Element to Group</ha-button>`
                              }
                           </div>
                      ` : ''}
                  </div>
                `
              : ''}
      </div>
    `;
}

export function renderNewGroupForm(groupContext: GroupEditorContext): TemplateResult {
    const currentInput = groupContext.newGroupInput;
    const warningMessage = groupContext.groupIdWarning;
    const isValid = !!currentInput.trim() && !warningMessage;

    return html`
      <div class="group-editor new-group">
        <div class="group-header editing">
          <ha-icon icon="mdi:chevron-down"></ha-icon>
          ${renderInputForm(
            "New Group Name",
            currentInput,
            warningMessage,
            isValid,
            (newValue) => groupContext.updateGroupNameInput(newValue),
            (e) => {
              if (e.key === 'Enter' && isValid) {
                e.stopPropagation();
                groupContext.confirmNewGroup();
              }
            },
            () => groupContext.confirmNewGroup(),
            () => groupContext.cancelNewGroup(),
            "Create Group",
            "Cancel"
          )}
        </div>
      </div>
    `;
}

export function renderGroupEditForm(
  groupId: string,
  groupContext: GroupEditorContext
): TemplateResult {
    const currentInput = groupContext.editingGroupInput;
    const warningMessage = groupContext.groupIdWarning;
    const groupInstance = groupContext.groupInstances.get(groupId);
    const isValid = !!currentInput.trim() && !warningMessage;

    return renderInputForm(
      "Edit Group Name",
      currentInput,
      warningMessage,
      isValid,
      (newValue) => {
        if (groupInstance) {
          groupInstance.updateNameInput(newValue);
        }
        groupContext.updateGroupNameInput(newValue);
      },
      (e) => {
        if (e.key === 'Enter' && isValid) {
          e.stopPropagation();
          groupContext.handleConfirmEditGroup(groupId);
        }
      },
      () => groupContext.handleConfirmEditGroup(groupId),
      () => groupContext.cancelEditGroup(),
      "Rename Group",
      "Cancel"
    );
}

export function renderGroupDeleteWarning(
  groupId: string,
  groupContext: GroupEditorContext
): TemplateResult {
  return html`
      <div class="delete-warning">
          <ha-icon icon="mdi:alert"></ha-icon>
          <span>Delete group <b>${groupId}</b> and all its elements?</span>
          <ha-button class="warning-button" @click=${() => groupContext.handleConfirmDeleteGroup(groupId)}>Delete</ha-button>
          <ha-button @click=${groupContext.cancelDeleteGroup}>Cancel</ha-button>
      </div>
  `;
}

export function renderAddElementForm(groupContext: GroupEditorContext): TemplateResult {
    const groupId = groupContext.addElementDraftGroup;
    if (!groupId) return html``;

    const currentInput = groupContext.addElementInput;
    const warningMessage = groupContext.addElementWarning;
    const isValid = !!currentInput.trim() && !warningMessage;

    return html`
      <div class="add-element-form">
        ${renderInputForm(
          "New Element ID",
          currentInput,
          warningMessage,
          isValid,
          (newValue) => groupContext.updateNewElementInput(newValue),
          (e) => {
            if (e.key === 'Enter' && isValid) {
              e.stopPropagation();
              groupContext.confirmAddElement();
            }
          },
          () => groupContext.confirmAddElement(),
          () => groupContext.cancelAddElement(),
          "Add Element",
          "Cancel"
        )}
      </div>
    `;
}

export function renderGroupList(
  groupedElements: { [groupId: string]: any[] },
  editorContext: EditorContext,
  groupContext: GroupEditorContext
): TemplateResult {
    const groupIdsToRender = Object.keys(groupedElements).sort();

    return html`
      <div class="groups-container">
          <div class="add-group-section" style="margin-bottom: 16px;">
              <ha-button outlined @click=${() => groupContext.addGroup()}>Add New Group</ha-button>
          </div>

          ${Object.keys(groupedElements).sort().map(groupId => 
            renderGroup(groupId, groupedElements[groupId], editorContext, groupContext)
          )}

          ${groupedElements['__ungrouped__'] && groupedElements['__ungrouped__'].length > 0
              ? renderGroup('__ungrouped__', groupedElements['__ungrouped__'], editorContext, groupContext)
              : ''}
      </div>
    `;
}

function renderFullWidthPropertyForm(
  context: EditorContext,
  elementId: string,
  formData: any,
  schema: HaFormSchema | undefined
): TemplateResult {
  if (!schema) return html``;
  
  return html`
    <div class="property-full-width">
      <ha-form
        .hass=${context.hass}
        .data=${formData}
        .schema=${[schema]}
        .computeLabel=${(s: HaFormSchema) => s.label || s.name}
        @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
      ></ha-form>
    </div>
  `;
}

function renderHalfWidthPropertyForm(
  context: EditorContext,
  elementId: string,
  formData: any,
  schema: HaFormSchema | undefined,
  sideClass: "property-left" | "property-right"
): TemplateResult {
  if (!schema) return html``;
  
  return html`
    <div class="${sideClass}">
      <ha-form
        .hass=${context.hass}
        .data=${formData}
        .schema=${[schema]}
        .computeLabel=${(s: HaFormSchema) => s.label || s.name}
        @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
      ></ha-form>
    </div>
  `;
}

function renderStretchSection(
  context: EditorContext,
  elementId: string,
  formData: any,
  stretchToSchema: HaFormSchema | undefined,
  stretchPaddingSchema: HaFormSchema | undefined,
  targetAnchorPointSchema: HaFormSchema | undefined,
  showTarget: boolean
): TemplateResult {
  if (!stretchToSchema) return html``;

  const targetKey = targetAnchorPointSchema?.name;
  const targetValue = targetKey ? formData[targetKey] : '';
  const paddingValue = stretchPaddingSchema ? formData[stretchPaddingSchema.name] : '';
  const stretchToValue = formData[stretchToSchema.name];

  if (!showTarget) {
    return renderFullWidthPropertyForm(context, elementId, formData, stretchToSchema);
  } else {
    return html`
      <div class="property-left stretch-column-left">
        <!-- Stretch To Dropdown -->
        <ha-form
          .hass=${context.hass}
          .data=${formData}
          .schema=${[stretchToSchema]} /* Pass schema as array */
          .computeLabel=${(s: HaFormSchema) => s.label || s.name}
          @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
        ></ha-form>

        <!-- Stretch Padding Input -->
        ${stretchPaddingSchema ? html`
          <ha-form
            .hass=${context.hass}
            .data=${formData}
            .schema=${[stretchPaddingSchema]} /* Pass schema as array */
            .computeLabel=${(s: HaFormSchema) => s.label || s.name}
            @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
          ></ha-form>
        ` : ''}
      </div>

      <div class="property-right stretch-column-right">
        <!-- Direction Selector Grid -->
        ${targetAnchorPointSchema ? html`
          ${renderCustomSelector(targetAnchorPointSchema, targetValue,
            (value: string) => {
              if (targetKey) {
                const detail = { value: { ...formData, [targetKey]: value } };
                const customEvent = new CustomEvent('value-changed', { detail });
                context.handleFormValueChanged(customEvent, elementId);
              }
            }
          )}
        ` : ''}
      </div>
    `;
  }
}
```

## File: src/layout/elements/button.ts

```typescript
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { HomeAssistant } from "custom-card-helpers";

export type ButtonPropertyName = 'fill' | 'stroke' | 'text_color' | 'strokeWidth' | 
                        'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 
                        'textAnchor' | 'dominantBaseline';

export class Button {
    private _isHovering = false;
    private _isActive = false;
    private _props: any;
    private _hass?: HomeAssistant;
    private _requestUpdateCallback?: () => void;
    private _id: string;

    constructor(id: string, props: any, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
        this._id = id;
        this._props = props;
        this._hass = hass;
        this._requestUpdateCallback = requestUpdateCallback;
    }

    get isHovering(): boolean {
        return this._isHovering;
    }

    set isHovering(value: boolean) {
        this._isHovering = value;
        this._requestUpdateCallback?.();
    }

    get isActive(): boolean {
        return this._isActive;
    }

    set isActive(value: boolean) {
        this._isActive = value;
        this._requestUpdateCallback?.();
    }

    formatColorValue(color: any): string | undefined {
        if (typeof color === 'string') {
            return color;
        }
        if (Array.isArray(color) && color.length === 3 && color.every(num => typeof num === 'number')) {
            return `rgb(${color[0]},${color[1]},${color[2]})`;
        }
        return undefined;
    }

    getButtonProperty<T>(propName: ButtonPropertyName, defaultValue?: T): T | string | undefined {
        const buttonConfig = this._props.button as LcarsButtonElementConfig | undefined;
        
        if (!buttonConfig?.enabled) {
            return this._props[propName] ?? defaultValue;
        }
        
        return this.resolveStateBasedProperty(buttonConfig, propName, defaultValue);
    }
    
    private resolveStateBasedProperty<T>(
        buttonConfig: LcarsButtonElementConfig, 
        propName: ButtonPropertyName, 
        defaultValue?: T
    ): T | string | undefined {
        if (this._isActive) {
            const activeProp = `active_${propName}` as keyof LcarsButtonElementConfig;
            const activeValue = buttonConfig[activeProp];
            if (activeValue !== undefined) {
                return this.formatValueForProperty(propName, activeValue);
            }
        }
        
        if (this._isHovering) {
            const hoverProp = `hover_${propName}` as keyof LcarsButtonElementConfig;
            const hoverValue = buttonConfig[hoverProp];
            if (hoverValue !== undefined) {
                return this.formatValueForProperty(propName, hoverValue);
            }
        }
        
        const directProp = propName as keyof LcarsButtonElementConfig;
        if (buttonConfig[directProp] !== undefined) {
            return this.formatValueForProperty(propName, buttonConfig[directProp]);
        }
        
        return this.formatValueForProperty(propName, this._props[propName] ?? defaultValue);
    }
    
    private formatValueForProperty<T>(propName: ButtonPropertyName, value: any): T | string | undefined {
        if ((propName === 'fill' || propName === 'stroke' || propName === 'text_color') && value !== undefined) {
            return this.formatColorValue(value);
        }
        
        return value;
    }

    createButton(
        pathData: string,
        x: number,
        y: number,
        width: number,
        height: number,
        options: {
            hasText: boolean,
            isCutout: boolean,
            rx: number,
            customTextPosition?: {
                x: number,
                y: number
            }
        }
    ): SVGTemplateResult {
        const buttonConfig = this._props.button as LcarsButtonElementConfig;
        const elements: SVGTemplateResult[] = [];
        
        const currentFill = this.getButtonProperty('fill', 'none');
        const currentStroke = this.getButtonProperty('stroke', 'none');
        const strokeWidth = this.getButtonProperty('strokeWidth', '0');
        
        const maskId = options.isCutout ? `mask-text-${this._id}` : null;
        
        elements.push(svg`
            <path
                id=${this._id}
                d=${pathData}
                fill=${currentFill}
                stroke=${currentStroke}
                stroke-width=${strokeWidth}
                mask=${maskId ? `url(#${maskId})` : 'none'}
            />
        `);
        
        if (options.hasText && buttonConfig.text) {
            const textConfig = this.getTextConfig(buttonConfig);
            
            // Use custom text position if provided, otherwise center in the element
            const textX = options.customTextPosition?.x ?? (x + width / 2);
            const textY = options.customTextPosition?.y ?? (y + height / 2);
            
            if (options.isCutout && maskId) {
                elements.push(this.createTextMask(
                    maskId,
                    x,
                    y,
                    width,
                    height,
                    pathData,
                    buttonConfig.text as string,
                    textConfig,
                    textX,
                    textY
                ));
            } else {
                const currentTextColor = this.getButtonProperty('text_color', 'white');
                elements.push(this.createText(
                    textX,
                    textY,
                    buttonConfig.text as string,
                    {
                        ...textConfig,
                        fill: currentTextColor as string,
                        pointerEvents: 'none'
                    }
                ));
            }
        }
        
        return this.createButtonGroup(elements, {
            isButton: true,
            buttonText: buttonConfig.text,
            elementId: this._id
        });
    }

    createText(
        x: number, 
        y: number, 
        text: string, 
        config: {
            fontFamily: string,
            fontSize: number,
            fontWeight: string,
            letterSpacing: string | number,
            textAnchor: string,
            dominantBaseline: string,
            textTransform: string,
            fill?: string,
            pointerEvents?: string
        }
    ): SVGTemplateResult {
        return svg`
            <text
                x=${x}
                y=${y}
                fill=${config.fill || 'currentColor'}
                font-family=${config.fontFamily}
                font-size=${`${config.fontSize}px`}
                font-weight=${config.fontWeight}
                letter-spacing=${config.letterSpacing}
                text-anchor=${config.textAnchor}
                dominant-baseline=${config.dominantBaseline}
                style="pointer-events: ${config.pointerEvents || 'auto'}; text-transform: ${config.textTransform};"
            >
                ${text}
            </text>
        `;
    }

    createTextMask(
        id: string,
        x: number,
        y: number,
        width: number,
        height: number,
        pathData: string,
        text: string,
        textConfig: {
            fontFamily: string,
            fontSize: number,
            fontWeight: string,
            letterSpacing: string | number,
            textAnchor: string,
            dominantBaseline: string,
            textTransform: string
        },
        textX: number,
        textY: number
    ): SVGTemplateResult {
        return svg`
            <mask id=${id}>
                <path d=${pathData} fill="white" />
                ${this.createText(
                    textX,
                    textY,
                    text,
                    {
                        ...textConfig,
                        fill: 'black'
                    }
                )}
            </mask>
        `;
    }

    createButtonGroup(
        elements: SVGTemplateResult[],
        config: {
            isButton: boolean,
            buttonText?: string,
            elementId: string
        }
    ): SVGTemplateResult {
        const { isButton, buttonText, elementId } = config;
        
        if (!isButton) {
            return svg`<g>${elements}</g>`;
        }
        
        const buttonHandlers = this.createEventHandlers();
        
        return svg`
            <g
                class="lcars-button-group"
                @click=${buttonHandlers.handleClick}
                @mouseenter=${buttonHandlers.handleMouseEnter}
                @mouseleave=${buttonHandlers.handleMouseLeave}
                @mousedown=${buttonHandlers.handleMouseDown}
                @mouseup=${buttonHandlers.handleMouseUp}
                style="cursor: pointer; outline: none;"
                role="button"
                aria-label=${buttonText || elementId}
                tabindex="0"
                @keydown=${buttonHandlers.handleKeyDown}
            >
                ${elements}
            </g>
        `;
    }
    
    getTextConfig(buttonConfig: LcarsButtonElementConfig): {
        fontFamily: string,
        fontSize: number,
        fontWeight: string,
        letterSpacing: string | number,
        textAnchor: string,
        dominantBaseline: string,
        textTransform: string
    } {
        return {
            fontFamily: buttonConfig.font_family || this._props.fontFamily || 'sans-serif',
            fontSize: buttonConfig.font_size || this._props.fontSize || 16,
            fontWeight: buttonConfig.font_weight || this._props.fontWeight || 'normal',
            letterSpacing: buttonConfig.letter_spacing || this._props.letterSpacing || 'normal',
            textAnchor: buttonConfig.text_anchor || this._props.textAnchor || 'middle',
            dominantBaseline: buttonConfig.dominant_baseline || this._props.dominantBaseline || 'middle',
            textTransform: buttonConfig.text_transform || 'none'
        };
    }
    
    createEventHandlers() {
        return {
            handleClick: (ev: Event): void => {
                console.log(`[${this._id}] handleClick:`, { props: this._props });
                
                const buttonConfig = this._props.button as LcarsButtonElementConfig | undefined;
                if (!this._hass || !buttonConfig?.action_config) {
                    console.log(`[${this._id}] handleClick: Aborting (no hass or no action_config)`);
                    return; 
                }
                
                ev.stopPropagation();
            
                const actionConfig = this.createActionConfig(buttonConfig);
                this.executeAction(actionConfig);
            },
            
            handleMouseEnter: (): void => {
                this.isHovering = true;
            },
            
            handleMouseLeave: (): void => {
                this.isHovering = false;
                this.isActive = false;
            },
            
            handleMouseDown: (): void => {
                this.isActive = true;
            },
            
            handleMouseUp: (): void => {
                this.isActive = false;
            },
            
            handleKeyDown: (e: KeyboardEvent): void => {
                if (e.key === 'Enter' || e.key === ' ') {
                    this.createEventHandlers().handleClick(e);
                }
            }
        };
    }
    
    private createActionConfig(buttonConfig: LcarsButtonElementConfig) {
        return {
            tap_action: { 
                action: buttonConfig.action_config?.type,
                service: buttonConfig.action_config?.service,
                service_data: buttonConfig.action_config?.service_data,
                navigation_path: buttonConfig.action_config?.navigation_path,
                url_path: buttonConfig.action_config?.url_path,
                entity: buttonConfig.action_config?.entity,
            },
            confirmation: buttonConfig.action_config?.confirmation,
        };
    }
    
    private executeAction(actionConfig: any): void {
        const hass = this._hass;
        if (hass) {
            import("custom-card-helpers").then(({ handleAction }) => {
                handleAction({ id: this._id } as any, hass, actionConfig as any, "tap");
                this._requestUpdateCallback?.();
            });
        }
    }
}
```

## File: src/layout/elements/chisel_endcap.ts

```typescript
import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateChiselEndcapPath } from "../../utils/shapes.js";

export class ChiselEndcapElement extends LayoutElement {
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
      this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 40;
      this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0;
      this.intrinsicSize.calculated = true;
    }
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
      if (this.intrinsicSize.height === 0 && this.layoutConfig.anchorTo) {
        const anchorElement = elementsMap.get(this.layoutConfig.anchorTo);
        if (!anchorElement || !anchorElement.layout.calculated) return false;
      }
      return super.canCalculateLayout(elementsMap);
    }
  
    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
      if (this.intrinsicSize.height === 0 && this.layoutConfig.anchorTo) {
        const anchorElement = elementsMap.get(this.layoutConfig.anchorTo);
        if (anchorElement) {
          const adoptedHeight = anchorElement.layout.height;
          const originalLayoutHeight = this.layoutConfig.height;
          this.layoutConfig.height = adoptedHeight;
          super.calculateLayout(elementsMap, containerRect);
          this.layoutConfig.height = originalLayoutHeight;
          return;
        }
      }
      super.calculateLayout(elementsMap, containerRect);
    }
  
    render(): SVGTemplateResult | null {
      if (!this.layout.calculated || this.layout.height <= 0 || this.layout.width <= 0) return null;
      const { x, y, width, height } = this.layout;
      const direction = (this.props.direction || 'right') as 'right';
      const pathData = generateChiselEndcapPath(width, height, direction, x, y);
      if (!pathData) return null;
      
      const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
      const isButton = Boolean(buttonConfig?.enabled);
      const hasText = isButton && Boolean(buttonConfig?.text);
      const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
      
      if (isButton && this.button) {
        return this.button.createButton(
          pathData,
          x,
          y,
          width,
          height,
          {
            hasText,
            isCutout,
            rx: 0
          }
        );
      } else {
        return svg`
          <path
            id=${this.id}
            d=${pathData}
            fill=${this.props.fill || 'none'}
            stroke=${this.props.stroke || 'none'}
            stroke-width=${this.props.strokeWidth || '0'}
          />
        `;
      }
    }
  }
```

## File: src/layout/elements/elbow.ts

```typescript
import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateElbowPath } from "../../utils/shapes.js";

export class ElbowElement extends LayoutElement {
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
      this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 100;
      this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 100;
      this.intrinsicSize.calculated = true;
    }
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
      return super.canCalculateLayout(elementsMap);
    }
  
    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
      super.calculateLayout(elementsMap, containerRect);
    }
  
    render(): SVGTemplateResult | null {
      if (!this.layout.calculated || this.layout.height <= 0 || this.layout.width <= 0) return null;
      const { x, y, width, height } = this.layout;
      const fill = this.props.fill || 'none';
      const stroke = this.props.stroke || 'none';
      const strokeWidth = this.props.strokeWidth || '0';
      const orientation = this.props.orientation || 'top-left';
      const elbowWidth = this.props.width || width;
      const bodyWidth = this.props.bodyWidth || 30;
      const armHeight = this.props.armHeight || 30;
      const outerCornerRadius = armHeight;
      const pathData = generateElbowPath(
        x,
        elbowWidth,
        bodyWidth,
        armHeight,
        height,
        orientation,
        y,
        outerCornerRadius
      );
      if (!pathData) return null;
      
      const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
      const isButton = Boolean(buttonConfig?.enabled);
      const hasText = isButton && Boolean(buttonConfig?.text);
      const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
      const textPosition = this.props.elbow_text_position || 'top';
      
      if (isButton && this.button) {
        // Calculate text position based on the elbow_text_position property
        let textX: number, textY: number;
        
        if (textPosition === 'top') {
          // Center text in the horizontal header section
          textX = x + elbowWidth / 2;
          textY = y + armHeight / 2;
        } else { // 'side'
          // Center text in the vertical section
          // Position depends on orientation
          if (orientation === 'top-left') {
            textX = x + bodyWidth / 2;
            textY = y + armHeight + (height - armHeight) / 2;
          } else if (orientation === 'top-right') {
            textX = x + elbowWidth - bodyWidth / 2;
            textY = y + armHeight + (height - armHeight) / 2;
          } else if (orientation === 'bottom-left') {
            textX = x + bodyWidth / 2;
            textY = y + (height - armHeight) / 2;
          } else { // 'bottom-right'
            textX = x + elbowWidth - bodyWidth / 2;
            textY = y + (height - armHeight) / 2;
          }
        }
        
        return this.button.createButton(
          pathData,
          x,
          y,
          width,
          height,
          {
            hasText,
            isCutout,
            rx: 0,
            customTextPosition: {
              x: textX,
              y: textY
            }
          }
        );
      } else {
        return svg`
          <path
            id=${this.id}
            d=${pathData}
            fill=${fill}
            stroke=${stroke}
            stroke-width=${strokeWidth}
          />
        `;
      }
    }
  }
```

## File: src/layout/elements/element.ts

```typescript
import { LayoutElementProps, LayoutState, IntrinsicSize, LayoutConfigOptions } from "../engine";
import { HomeAssistant } from "custom-card-helpers";
import { gsap } from "gsap";
import { generateRectanglePath, generateEndcapPath, generateElbowPath, generateChiselEndcapPath, getTextWidth, measureTextBBox, getFontMetrics } from '../../utils/shapes.js';
import { SVGTemplateResult } from 'lit';
import { LcarsButtonElementConfig } from '../../lovelace-lcars-card.js';
import { StretchContext } from '../engine.js';
import { Button } from './button.js';

export abstract class LayoutElement {
    id: string;
    props: LayoutElementProps;
    layoutConfig: LayoutConfigOptions;
    layout: LayoutState;
    intrinsicSize: IntrinsicSize;
    hass?: HomeAssistant;
    protected requestUpdateCallback?: () => void;
    protected button?: Button;
      constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      this.id = id;
      this.props = props;
      this.layoutConfig = layoutConfig;
      this.hass = hass;
      this.requestUpdateCallback = requestUpdateCallback;
  
      // Initialize button if button config exists
      if (props.button?.enabled) {
        this.button = new Button(id, props, hass, requestUpdateCallback);
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
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
      if (!this._checkAnchorDependencies(elementsMap)) return false;
      if (!this._checkStretchDependencies(elementsMap)) return false;
      if (!this._checkSpecialDependencies(elementsMap)) return false;
  
      return true;
    }
  
    private _checkAnchorDependencies(elementsMap: Map<string, LayoutElement>): boolean {
      if (this.layoutConfig.anchor?.anchorTo && this.layoutConfig.anchor.anchorTo !== 'container') {
          const targetElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
          if (!targetElement || !targetElement.layout.calculated) {
              return false;
          }
      }
      return true;
    }
  
    private _checkStretchDependencies(elementsMap: Map<string, LayoutElement>): boolean {
      if (this.layoutConfig.stretch?.stretchTo1 && 
          this.layoutConfig.stretch.stretchTo1 !== 'canvas' && 
          this.layoutConfig.stretch.stretchTo1 !== 'container') {
          
          const targetElement = elementsMap.get(this.layoutConfig.stretch.stretchTo1);
          if (!targetElement || !targetElement.layout.calculated) {
              return false;
          }
      }
      
      if (this.layoutConfig.stretch?.stretchTo2 && 
          this.layoutConfig.stretch.stretchTo2 !== 'canvas' && 
          this.layoutConfig.stretch.stretchTo2 !== 'container') {
          
          const targetElement = elementsMap.get(this.layoutConfig.stretch.stretchTo2);
          if (!targetElement || !targetElement.layout.calculated) {
              return false;
          }
      }
      
      return true;
    }
  
    private _checkSpecialDependencies(elementsMap: Map<string, LayoutElement>): boolean {
      if (this.constructor.name === 'EndcapElement' && 
          this.layoutConfig.anchor?.anchorTo && 
          this.layoutConfig.anchor.anchorTo !== 'container' && 
          !this.props.height) {
        
        const targetElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
        if (!targetElement || !targetElement.layout.calculated) {
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
  
      const myAnchorPoint = this._getCloserEdge(initialPosition, initialSize, targetCoord, isHorizontal);
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
      
      const element = document.getElementById(this.id);
      if (!element) return;
      
      const animProps: { [key: string]: any } = {};
      animProps[property] = value;
      
      gsap.to(element, {
        duration,
        ...animProps,
        ease: "power2.out"
      });
    }
  
    /**
     * Formats a color value from different possible input formats
     * @param color - Color in string format or RGB array
     * @returns Formatted color string or undefined
     */
    protected _formatColorValue(color: any): string | undefined {
      if (typeof color === 'string') {
        return color;
      }
      if (Array.isArray(color) && color.length === 3 && color.every(num => typeof num === 'number')) {
        return `rgb(${color[0]},${color[1]},${color[2]})`;
      }
      return undefined;
    }
  }
```

## File: src/layout/elements/endcap.ts

```typescript
import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateEndcapPath } from "../../utils/shapes.js";

export class EndcapElement extends LayoutElement {
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
      this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 40;
      
      this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0; 
      
      this.intrinsicSize.calculated = true;
    }
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
      if (this.intrinsicSize.height === 0 && this.layoutConfig.anchorTo) {
        const anchorElement = elementsMap.get(this.layoutConfig.anchorTo);
        if (!anchorElement || !anchorElement.layout.calculated) return false; 
      }
      return super.canCalculateLayout(elementsMap); 
    }
  
    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
      if (this.intrinsicSize.height === 0 && this.layoutConfig.anchorTo) {
        const anchorElement = elementsMap.get(this.layoutConfig.anchorTo);
        if (anchorElement) { 
          // IMPORTANT: Modify the height used for this specific layout calculation
          // We store the calculated dimensions in this.layout, not this.intrinsicSize here
          // Let the base calculateLayout use this adopted height
           const adoptedHeight = anchorElement.layout.height;
           const originalLayoutHeight = this.layoutConfig.height;
           this.layoutConfig.height = adoptedHeight; 
           super.calculateLayout(elementsMap, containerRect);
           this.layoutConfig.height = originalLayoutHeight;
           return;
        }
      }
      
      super.calculateLayout(elementsMap, containerRect);
    }
  
    render(): SVGTemplateResult | null {
      if (!this.layout.calculated || this.layout.height <= 0 || this.layout.width <= 0) return null;
  
      const { x, y, width, height } = this.layout;
      const direction = (this.props.direction || 'left') as 'left' | 'right';
  
      const pathData = generateEndcapPath(width, height, direction, x, y);
  
      if (!pathData) return null;
      
      const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
      const isButton = Boolean(buttonConfig?.enabled);
      const hasText = isButton && Boolean(buttonConfig?.text);
      const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
      
      if (isButton && this.button) {
        return this.button.createButton(
          pathData,
          x,
          y,
          width,
          height,
          {
            hasText,
            isCutout,
            rx: 0
          }
        );
      } else {
        return svg`
          <path
            id=${this.id}
            d=${pathData}
            fill=${this.props.fill || 'none'}
            stroke=${this.props.stroke || 'none'}
            stroke-width=${this.props.strokeWidth || '0'}
          />
        `;
      }
    }
  }
```

## File: src/layout/elements/rectangle.ts

```typescript
import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateRectanglePath } from "../../utils/shapes.js";
import { Button } from "./button.js";

export class RectangleElement extends LayoutElement {
  
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
    }
  
    /**
     * Renders the rectangle as an SVG path element.
     * @returns The SVG path element.
     */
    render(): SVGTemplateResult | null {
      if (!this.layout.calculated) return null;
  
      const { x, y, width, height } = this.layout;
      const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
      const isButton = Boolean(buttonConfig?.enabled);
      const hasText = isButton && Boolean(buttonConfig?.text);
      const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
      
      const rx = this.props.rx ?? this.props.cornerRadius ?? 0;
      const pathData = generateRectanglePath(x, y, width, height, rx);
      
      if (isButton && this.button) {
        return this.button.createButton(
          pathData,
          x,
          y,
          width,
          height,
          {
            hasText,
            isCutout,
            rx
          }
        );
      } else {
        const fill = this.props.fill ?? 'none';
        const stroke = this.props.stroke ?? 'none';
        const strokeWidth = this.props.strokeWidth ?? '0';
        
        return svg`
          <path
            id=${this.id}
            d=${pathData}
            fill=${fill}
            stroke=${stroke}
            stroke-width=${strokeWidth}
          />
        `;
      }
    }
  }
```

## File: src/layout/elements/text.ts

```typescript
import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant, handleAction } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { getFontMetrics, measureTextBBox, getSvgTextWidth, getTextWidth } from "../../utils/shapes.js";

export class TextElement extends LayoutElement {
    // Cache font metrics to maintain consistency across renders
    private _cachedMetrics: any = null;
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
    }
  
    /**
     * Calculates the intrinsic size of the text based on its content.
     * @param container - The SVG container element.
     */
    calculateIntrinsicSize(container: SVGElement): void {
      if (this.props.width && this.props.height) {
        this.intrinsicSize.width = this.props.width;
        this.intrinsicSize.height = this.props.height;
        this.intrinsicSize.calculated = true;
        return;
      }
      
      const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tempText.textContent = this.props.text || '';
      tempText.setAttribute('font-family', this.props.fontFamily || 'sans-serif');
      tempText.setAttribute('font-size', `${this.props.fontSize || 16}px`);
      tempText.setAttribute('font-weight', this.props.fontWeight || 'normal');
      if (this.props.letterSpacing) {
        tempText.setAttribute('letter-spacing', this.props.letterSpacing);
      }
      if (this.props.textTransform) {
        tempText.setAttribute('text-transform', this.props.textTransform);
      }
      
      container.appendChild(tempText);
      
      const bbox = measureTextBBox(tempText);
      
      container.removeChild(tempText);
      
      if (bbox) {
        this.intrinsicSize.width = bbox.width;
        const metrics = getFontMetrics({
          fontFamily: this.props.fontFamily || 'Arial',
          fontWeight: this.props.fontWeight || 'normal',
          fontSize: this.props.fontSize || 16,
          origin: 'baseline',
        });
        if (metrics) {
          const normalizedHeight = (metrics.bottom - metrics.top) * (this.props.fontSize || 16);
          this.intrinsicSize.height = normalizedHeight;
          (this as any)._fontMetrics = metrics;
        } else {
          this.intrinsicSize.height = bbox.height;
        }
      } else {
        this.intrinsicSize.width = getSvgTextWidth(this.props.text || '', 
          `${this.props.fontWeight || ''} ${this.props.fontSize || 16}px ${this.props.fontFamily || 'Arial'}`,
          this.props.letterSpacing || undefined,
          this.props.textTransform || undefined
        );
        this.intrinsicSize.height = this.props.fontSize ? parseInt(this.props.fontSize.toString()) * 1.2 : 20;
      }
      
      this.intrinsicSize.calculated = true;
    }
  
    render(): SVGTemplateResult | null {
      if (!this.layout.calculated) return null;
  
      const { x, y, width, height } = this.layout;
      
      const textAnchor = this.props.textAnchor || 'start';
      const dominantBaseline = this.props.dominantBaseline || 'auto';
  
      let textX = x;
      let textY = y;
      
      if (textAnchor === 'middle') {
        textX += width / 2;
      } else if (textAnchor === 'end') {
        textX += width;
      }
      
      // Use cached metrics first, then fall back to _fontMetrics (set during calculateIntrinsicSize), then fetch new metrics if needed
      let metrics: any = this._cachedMetrics || (this as any)._fontMetrics;
      if (!metrics && this.props.fontFamily) {
        metrics = getFontMetrics({
          fontFamily: this.props.fontFamily,
          fontWeight: this.props.fontWeight || 'normal',
          fontSize: this.props.fontSize || 16,
          origin: 'baseline',
        });
        
        // Cache metrics for consistent rendering across lifecycle
        if (metrics) {
          this._cachedMetrics = metrics;
        }
      }
      if (metrics) {
        textY += -metrics.ascent * (this.props.fontSize || 16);
        if (dominantBaseline === 'middle') {
          const totalHeight = (metrics.bottom - metrics.top) * (this.props.fontSize || 16);
          textY = y + totalHeight / 2 + metrics.top * (this.props.fontSize || 16);
        }
        if (dominantBaseline === 'hanging') {
          textY = y + metrics.top * (this.props.fontSize || 16);
        }
      } else {
        if (dominantBaseline === 'middle') {
          textY += height / 2;
        } else if (dominantBaseline === 'hanging') {
        } else {
          textY += height * 0.8;
        }
      }
      
      const styles = this.props.textTransform ? `text-transform: ${this.props.textTransform};` : '';
  
      return svg`
        <text
          id=${this.id}
          x=${textX}
          y=${textY}
          fill=${this.props.fill || '#000000'}
          font-family=${this.props.fontFamily || 'sans-serif'}
          font-size=${`${this.props.fontSize || 16}px`}
          font-weight=${this.props.fontWeight || 'normal'}
          letter-spacing=${this.props.letterSpacing || 'normal'}
          text-anchor=${textAnchor}
          dominant-baseline=${dominantBaseline}
          style=${styles}
        >
          ${this.props.text || ''}
        </text>
      `;
    }
  }
```

## File: src/layout/elements/top_header.ts

```typescript
import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { svg, SVGTemplateResult } from "lit";
import { EndcapElement } from "./endcap.js";
import { TextElement } from "./text.js";
import { RectangleElement } from "./rectangle.js";
import { getFontMetrics, getSvgTextWidth } from "../../utils/shapes.js";

interface FontConfig {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  letterSpacing: string;
  textTransform: string;
}

export class TopHeaderElement extends LayoutElement {
  private _cachedMetrics: any = null;
  private leftEndcap: EndcapElement;
  private rightEndcap: EndcapElement;
  private leftText: TextElement;
  private rightText: TextElement;
  private headerBar: RectangleElement;
  
  private readonly textGap: number = 5;

  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
    super(id, props, layoutConfig, hass, requestUpdateCallback);
    
    const defaultColor = props.fill || '#99CCFF';
    
    this.leftEndcap = this.createLeftEndcap(id, defaultColor, hass, requestUpdateCallback);
    this.rightEndcap = this.createRightEndcap(id, defaultColor, hass, requestUpdateCallback);
    this.leftText = this.createTextElement(id, 'left', props, hass, requestUpdateCallback);
    this.rightText = this.createTextElement(id, 'right', props, hass, requestUpdateCallback);
    this.headerBar = this.createHeaderBar(id, defaultColor, hass, requestUpdateCallback);
    
    this.resetLayout();
  }
  
  private createLeftEndcap(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void): EndcapElement {
    return new EndcapElement(`${id}_left_endcap`, {
      width: 15,
      direction: 'left',
      fill
    }, {
      anchor: {
        anchorTo: 'container',
        anchorPoint: 'topLeft',
        targetAnchorPoint: 'topLeft'
      }
    }, hass, requestUpdateCallback);
  }
  
  private createRightEndcap(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void): EndcapElement {
    return new EndcapElement(`${id}_right_endcap`, {
      width: 15,
      direction: 'right',
      fill
    }, {
      anchor: {
        anchorTo: 'container',
        anchorPoint: 'topRight',
        targetAnchorPoint: 'topRight'
      }
    }, hass, requestUpdateCallback);
  }
  
  private createTextElement(id: string, position: 'left' | 'right', props: LayoutElementProps, hass?: HomeAssistant, requestUpdateCallback?: () => void): TextElement {
    const isLeft = position === 'left';
    const textKey = isLeft ? 'leftText' : 'rightText';
    const defaultText = isLeft ? 'LEFT' : 'RIGHT';
    const anchorTo = `${id}_${position}_endcap`;
    
    return new TextElement(`${id}_${position}_text`, {
      text: props[textKey] || defaultText,
      fontFamily: props.fontFamily || 'Antonio',
      fontWeight: props.fontWeight || 'normal',
      letterSpacing: props.letterSpacing || 'normal',
      textTransform: props.textTransform || 'uppercase',
      fill: '#FFFFFF'
    }, {
      anchor: {
        anchorTo,
        anchorPoint: isLeft ? 'topLeft' : 'topRight',
        targetAnchorPoint: isLeft ? 'topRight' : 'topLeft'
      }
    }, hass, requestUpdateCallback);
  }
  
  private createHeaderBar(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void): RectangleElement {
    return new RectangleElement(`${id}_header_bar`, {
      fill,
      width: 1  // Initial width, required to instantiate
    }, {
      anchor: {
        anchorTo: `${id}_left_text`,
        anchorPoint: 'topLeft',
        targetAnchorPoint: 'topRight'
      },
      stretch: {
        stretchTo1: `${id}_right_text`,
        targetStretchAnchorPoint1: 'centerLeft',
        stretchPadding1: this.textGap * -1
      },
      offsetX: this.textGap
    }, hass, requestUpdateCallback);
  }

  calculateIntrinsicSize(container: SVGElement): void {
    this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 300;
    this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 30;
    this.intrinsicSize.calculated = true;
  }

  calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    this.registerChildElements(elementsMap);
    super.calculateLayout(elementsMap, containerRect);
    
    if (!this.layout.calculated) return;
    
    const { x, y, width, height } = this.layout;
    const offsetY = this.props.offsetY || 0;
    const fontConfig = this.getFontConfiguration();
    const fontSize = this.calculateFontSize(height, fontConfig);
    
    this.layoutEndcaps(height, elementsMap, containerRect);
    this.layoutTextElements(fontSize, fontConfig, x, y, offsetY, elementsMap, containerRect);
    this.layoutHeaderBar(height, offsetY, elementsMap, containerRect);
  }
  
  private registerChildElements(elementsMap: Map<string, LayoutElement>): void {
    elementsMap.set(this.leftEndcap.id, this.leftEndcap);
    elementsMap.set(this.rightEndcap.id, this.rightEndcap);
    elementsMap.set(this.leftText.id, this.leftText);
    elementsMap.set(this.rightText.id, this.rightText);
    elementsMap.set(this.headerBar.id, this.headerBar);
  }
  
  private getFontConfiguration(): FontConfig {
    return {
      fontFamily: this.props.fontFamily || 'Antonio',
      fontWeight: this.props.fontWeight || 'normal',
      fontSize: 0, // Will be calculated later
      letterSpacing: this.props.letterSpacing || 'normal',
      textTransform: this.props.textTransform || 'uppercase'
    };
  }
  
  private calculateFontSize(height: number, fontConfig: FontConfig): number {
    const metrics = this.getFontMetrics(fontConfig);
    
    if (metrics) {
      return height / (metrics.capHeight * -1);
    }
    
    return height;
  }
  
  private getFontMetrics(fontConfig: FontConfig): any {
    if (!this._cachedMetrics) {
      const metrics = getFontMetrics({
        fontFamily: fontConfig.fontFamily,
        fontWeight: fontConfig.fontWeight,
        fontSize: 200, // Reference size recommended by the library
        origin: 'baseline'
      });
      
      if (metrics) {
        this._cachedMetrics = metrics;
      }
    }
    
    return this._cachedMetrics;
  }
  
  private layoutEndcaps(height: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const fill = this.props.fill || '#99CCFF';
    const endcapWidth = height * 0.75;
    
    // Configure and layout left endcap
    this.configureEndcap(this.leftEndcap, height, endcapWidth, fill);
    this.leftEndcap.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    this.leftEndcap.calculateLayout(elementsMap, containerRect);
    
    // Configure and layout right endcap
    this.configureEndcap(this.rightEndcap, height, endcapWidth, fill);
    this.rightEndcap.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    this.rightEndcap.calculateLayout(elementsMap, containerRect);
  }
  
  private configureEndcap(endcap: EndcapElement, height: number, width: number, fill: string): void {
    endcap.props.height = height;
    endcap.props.width = width;
    endcap.props.fill = fill;
  }
  
  private layoutTextElements(fontSize: number, fontConfig: FontConfig, x: number, y: number, offsetY: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const height = this.layout.height;
    const fontString = `${fontConfig.fontWeight} ${fontSize}px ${fontConfig.fontFamily}`;
    const leftTextContent = this.props.leftText || 'LEFT';
    const rightTextContent = this.props.rightText || 'RIGHT';
    
    const leftTextWidth = getSvgTextWidth(
      leftTextContent, 
      fontString,
      fontConfig.letterSpacing,
      fontConfig.textTransform
    );
    
    const rightTextWidth = getSvgTextWidth(
      rightTextContent, 
      fontString,
      fontConfig.letterSpacing,
      fontConfig.textTransform
    );
    
    const metrics = this._cachedMetrics;
    if (metrics) {
      this.layoutTextWithMetrics(fontSize, fontConfig, y, offsetY, leftTextWidth, rightTextWidth, elementsMap, containerRect);
    } else {
      this.layoutTextWithoutMetrics(fontSize, fontConfig, x, y, offsetY, height, leftTextWidth, rightTextWidth, elementsMap, containerRect);
    }
  }
  
  private layoutTextWithMetrics(fontSize: number, fontConfig: FontConfig, y: number, offsetY: number, leftTextWidth: number, rightTextWidth: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const baselineY = y + offsetY;
    
    // Configure and layout left text
    this.configureTextElement(this.leftText, fontSize, fontConfig, this.props.leftText || 'LEFT', leftTextWidth);
    this.leftText.calculateLayout(elementsMap, containerRect);
    this.leftText.layout.y = baselineY;
    this.leftText.layout.x += this.textGap;
    
    // Configure and layout right text
    this.configureTextElement(this.rightText, fontSize, fontConfig, this.props.rightText || 'RIGHT', rightTextWidth);
    this.rightText.calculateLayout(elementsMap, containerRect);
    this.rightText.layout.y = baselineY;
    this.rightText.layout.x -= this.textGap;
  }
  
  private layoutTextWithoutMetrics(fontSize: number, fontConfig: FontConfig, x: number, y: number, offsetY: number, height: number, leftTextWidth: number, rightTextWidth: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const bottomY = y + offsetY + height;
    
    // Configure and layout left text
    this.configureTextElement(this.leftText, fontSize, fontConfig, this.props.leftText || 'LEFT', leftTextWidth);
    this.leftText.calculateLayout(elementsMap, containerRect);
    this.leftText.layout.y = bottomY;
    this.leftText.layout.x += this.textGap;
    
    // Configure and layout right text
    this.configureTextElement(this.rightText, fontSize, fontConfig, this.props.rightText || 'RIGHT', rightTextWidth);
    this.rightText.calculateLayout(elementsMap, containerRect);
    this.rightText.layout.y = bottomY;
    this.rightText.layout.x -= this.textGap;
  }
  
  private configureTextElement(textElement: TextElement, fontSize: number, fontConfig: FontConfig, text: string, textWidth: number): void {
    textElement.props.fontSize = fontSize;
    textElement.props.fontFamily = fontConfig.fontFamily;
    textElement.props.fontWeight = fontConfig.fontWeight;
    textElement.props.letterSpacing = fontConfig.letterSpacing;
    textElement.props.textTransform = fontConfig.textTransform;
    textElement.props.text = text;
    textElement.intrinsicSize = {
      width: textWidth,
      height: fontSize,
      calculated: true
    };
  }
  
  private layoutHeaderBar(height: number, offsetY: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const fill = this.props.fill || '#99CCFF';
    
    this.headerBar.props.fill = fill;
    this.headerBar.props.height = height;
    
    this.headerBar.intrinsicSize = {
      width: 1,  // width required to instantiate
      height: height,
      calculated: true
    };
    
    this.headerBar.resetLayout();
    this.headerBar.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    this.headerBar.calculateLayout(elementsMap, containerRect);
    
    this.headerBar.layout.y = this.layout.y + offsetY;
    this.headerBar.layout.height = height;
    
    if (this.headerBar.layout.width < 10) {
      console.warn(`TopHeader stretch failed: ${this.headerBar.id} width=${this.headerBar.layout.width}`);
    }
  }

  render(): SVGTemplateResult | null {
    if (!this.layout.calculated) return null;
    
    return svg`
      ${this.leftEndcap.render()}
      ${this.rightEndcap.render()}
      ${this.headerBar.render()}
      ${this.leftText.render()}
      ${this.rightText.render()}
    `;
  }
}
```

## File: src/layout/engine.ts

```typescript
import { SVGTemplateResult, html } from 'lit';
import gsap from 'gsap';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from './elements/element.js';

export interface LayoutElementProps {
  [key: string]: any;
  button?: any;
  textPadding?: number; // Padding to apply to text elements (used for equal spacing)
}

export interface LayoutConfigOptions {
  [key: string]: any;
  
  stretch?: {
    stretchTo1?: string;
    targetStretchAnchorPoint1?: string;
    stretchPadding1?: number;
    stretchTo2?: string;
    targetStretchAnchorPoint2?: string;
    stretchPadding2?: number;
  };
}

export interface StretchContext {
  x: number;
  y: number;
  width: number;
  height: number;
  elementsMap: Map<string, LayoutElement>;
  containerWidth: number;
  containerHeight: number;
}

export class LayoutEngine {
  private elements: Map<string, LayoutElement>;
  private groups: Group[];
  private tempSvgContainer?: SVGElement;
  private containerRect?: DOMRect;

  constructor() {
    this.elements = new Map();
    this.groups = [];
    this._initializeTempSvgContainer();
  }

  private _initializeTempSvgContainer(): void {
    if (typeof document !== 'undefined') { 
      this.tempSvgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.tempSvgContainer.style.position = 'absolute';
      this.tempSvgContainer.style.left = '-9999px';
      this.tempSvgContainer.style.top = '-9999px';
      document.body.appendChild(this.tempSvgContainer);
    }
  }

  public get layoutGroups(): Group[] {
    return this.groups;
  }

  addGroup(group: Group): void {
    this.groups.push(group);
    group.elements.forEach(el => {
      if (this.elements.has(el.id)) {
        console.warn(`LayoutEngine: Duplicate element ID "${el.id}". Overwriting.`);
      }
      this.elements.set(el.id, el);
    });
  }

  clearLayout(): void {
    this.elements.clear();
    this.groups = [];
  }

  calculateBoundingBoxes(containerRect: DOMRect): void {
    if (!containerRect) return;
    
    this.containerRect = containerRect;
    const maxPasses = 10;
    let pass = 0;
    let elementsCalculatedInPass = 0;
    let totalCalculated = 0;

    this.elements.forEach(el => el.resetLayout());

    do {
      elementsCalculatedInPass = this._calculateElementsForPass(pass, totalCalculated);
      totalCalculated += elementsCalculatedInPass;
      pass++;
    } while (elementsCalculatedInPass > 0 && totalCalculated < this.elements.size && pass < maxPasses);

    this._logLayoutCalculationResults(totalCalculated, maxPasses);
  }

  private _calculateElementsForPass(pass: number, totalCalculated: number): number {
    let elementsCalculatedInPass = 0;

    this.elements.forEach(el => {
      if (el.layout.calculated) return;

      if (!el.intrinsicSize.calculated && this.tempSvgContainer) {
        el.calculateIntrinsicSize(this.tempSvgContainer);
      }

      const canCalculate = el.canCalculateLayout(this.elements);

      if (canCalculate && this.containerRect) {
        el.calculateLayout(this.elements, this.containerRect);
        if (el.layout.calculated) {
          elementsCalculatedInPass++;
        }
      }
    });

    return elementsCalculatedInPass;
  }

  private _logLayoutCalculationResults(totalCalculated: number, maxPasses: number): void {
    if (totalCalculated < this.elements.size) {
      console.warn(`LayoutEngine: Could not resolve layout for all elements after ${maxPasses} passes.`);
      this.elements.forEach(el => {
        if (!el.layout.calculated) {
          console.warn(` -> Failed to calculate: ${el.id}`);
        }
      });
    }
  }

  destroy(): void {
    if (this.tempSvgContainer && this.tempSvgContainer.parentNode) {
      this.tempSvgContainer.parentNode.removeChild(this.tempSvgContainer);
    }
    this.clearLayout();
  }
}

export class Group {
  id: string;
  elements: LayoutElement[];

  constructor(id: string, elements: LayoutElement[] = []) {
    this.id = id;
    this.elements = elements;
  }
}

export interface LayoutState {
  x: number;
  y: number;
  width: number;
  height: number;
  calculated: boolean;
}

export interface IntrinsicSize {
  width: number;
  height: number;
  calculated: boolean;
}
```

## File: src/layout/parser.ts

```typescript
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from './engine.js';
import { LayoutElement } from './elements/element.js';
import { RectangleElement } from './elements/rectangle.js';
import { LcarsCardConfig } from '../lovelace-lcars-card.js';
import { TextElement } from './elements/text.js';
import { EndcapElement } from './elements/endcap.js';
import { ElbowElement } from './elements/elbow.js';
import { ChiselEndcapElement } from './elements/chisel_endcap.js';
import { TopHeaderElement } from './elements/top_header.js';

export function parseConfig(config: LcarsCardConfig, hass?: HomeAssistant, requestUpdateCallback?: () => void): Group[] {
  if (!config.elements || config.elements.length === 0) {
    return [createDefaultGroup(config, hass, requestUpdateCallback)];
  }

  const groupedElements: { [key: string]: any[] } = {};
  
  config.elements.forEach(element => {
    const groupId = element.group || '__ungrouped__';
    if (!groupedElements[groupId]) {
      groupedElements[groupId] = [];
    }
    groupedElements[groupId].push(element);
  });
  
  const groups: Group[] = [];
  
  Object.entries(groupedElements).forEach(([groupId, elements]) => {
    const layoutElements: LayoutElement[] = elements.map(element => {
      return createLayoutElement(
        element.id,
        element.type,
        { ...element.props, button: element.button },
        element.layout || {},
        hass,
        requestUpdateCallback
      );
    });
    
    groups.push(new Group(groupId, layoutElements));
  });
  
  return groups;
}

function createDefaultGroup(config: LcarsCardConfig, hass?: HomeAssistant, requestUpdateCallback?: () => void): Group {
  const { title, text, fontSize } = config;
  
  const titleElement = new TextElement(
    'default-title',
    {
      text: title,
      fontWeight: 'bold',
      fontSize: fontSize ? fontSize + 4 : 20,
      fill: '#FFFFFF'
    },
    {
      anchorLeft: true,
      anchorTop: true,
      offsetX: 16,
      offsetY: 30
    },
    hass,
    requestUpdateCallback
  );
  
  const textElement = new TextElement(
    'default-text',
    {
      text: text,
      fontSize: fontSize || 16,
      fill: '#CCCCCC'
    },
    {
      anchorLeft: true,
      anchorTop: true,
      offsetX: 16,
      offsetY: 60
    },
    hass,
    requestUpdateCallback
  );
  
  const headerBar = new RectangleElement(
    'default-header',
    {
      fill: '#FF9900',
      rx: 0,
      ry: 0
    },
    {
      anchorLeft: true,
      anchorTop: true,
      offsetX: 0,
      offsetY: 0,
      width: '100%',
      height: 16
    },
    hass,
    requestUpdateCallback
  );
  
  return new Group('__default__', [headerBar, titleElement, textElement]);
}

function createLayoutElement(
  id: string,
  type: string,
  props: any,
  layoutConfig: any,
  hass?: HomeAssistant,
  requestUpdateCallback?: () => void
): LayoutElement {
  switch (type.toLowerCase().trim()) {
    case 'text':
      return new TextElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'rectangle':
      return new RectangleElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'endcap':
      return new EndcapElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'elbow':
      return new ElbowElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'chisel-endcap':
      return new ChiselEndcapElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'top_header':
      return new TopHeaderElement(id, props, layoutConfig, hass, requestUpdateCallback);
    default:
      console.warn(`LCARS Card Parser: Unknown element type "${type}". Defaulting to Rectangle.`);
      return new RectangleElement(id, props, layoutConfig, hass, requestUpdateCallback);
  }
}
```

## File: src/lovelace-lcars-card.ts

```typescript
import { LitElement, html, css, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME, DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';
import './types';
import gsap from 'gsap';

import { LayoutEngine, Group } from './layout/engine.js';
import { LayoutElement } from './layout/elements/element.js';
import { parseConfig } from './layout/parser.js';

import './editor/lcars-card-editor.js';

import { editorStyles } from './styles/styles.js';

export interface LcarsCardConfig {
  type: string;
  title?: string;
  text?: string;
  fontSize?: number;
  elements?: LcarsElementConfig[];
}

export interface LcarsButtonActionConfig {
  type: 'call-service' | 'navigate' | 'toggle' | 'more-info' | 'url' | 'none';
  service?: string;
  service_data?: Record<string, any>;
  navigation_path?: string;
  url_path?: string;
  entity?: string;
  confirmation?: boolean | {
    text?: string;
    exemptions?: Array<{
      user: string;
    }>;
  };
}

export interface LcarsButtonElementConfig {
  enabled?: boolean;
  text?: string;
  cutout_text?: boolean;

  text_color?: any;
  font_family?: string;
  font_size?: number;
  font_weight?: string;
  letter_spacing?: string | number;
  text_transform: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  text_anchor?: 'start' | 'middle' | 'end';
  dominant_baseline?: 'auto' | 'middle' | 'central' | 'hanging' | 'text-bottom' | 'text-top' | 'alphabetic' | 'ideographic';


  hover_fill?: any;
  active_fill?: any;
  hover_stroke?: string;
  active_stroke?: string;
  hover_text_color?: any;
  active_text_color?: any;

  hover_transform?: string;
  active_transform?: string;

  action_config?: LcarsButtonActionConfig;
}

export interface LcarsElementConfig {
  id: string;
  type: string;
  props?: Record<string, any>;
  layout?: LcarsLayoutConfig;
  group?: string;
  button?: LcarsButtonElementConfig;
}

export interface LcarsLayoutConfig {
  width?: number | string;
  height?: number | string;
  offsetX?: number | string;
  offsetY?: number | string;
  
  anchor?: {
    anchorTo: string;
    anchorPoint?: string;
    targetAnchorPoint?: string;
  };
  
  stretch?: {
    stretchTo1?: string;
    stretchAxis1?: 'X' | 'Y';
    targetStretchAnchorPoint1?: string;
    stretchPadding1?: number;
    stretchTo2?: string;
    stretchAxis2?: 'X' | 'Y';
    targetStretchAnchorPoint2?: string;
    stretchPadding2?: number;
  };
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TYPE,
  name: CARD_NAME,
  description: 'A LCARS themed card for Home Assistant',
});

@customElement(CARD_TYPE)
export class LcarsCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) private _config!: LcarsCardConfig;
  @state() private _layoutElementTemplates: SVGTemplateResult[] = [];
  @state() private _viewBox: string = '0 0 100 50';
  @state() private _elementStateNeedsRefresh: boolean = false;
  
  private _layoutEngine: LayoutEngine = new LayoutEngine();
  private _resizeObserver?: ResizeObserver;
  private _containerRect?: DOMRect;
  private _lastConfig?: LcarsCardConfig;
  private _layoutCalculationPending: boolean = false;
  private _hasRenderedOnce: boolean = false;
  @state() private _hasMeasuredRenderedText: boolean = false;
  private _fontsLoaded: boolean = false;
  private _fontLoadAttempts: number = 0;
  private _maxFontLoadAttempts: number = 3;

  static styles = [editorStyles];

  public setConfig(config: LcarsCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    if (JSON.stringify(config) === JSON.stringify(this._lastConfig)) {
        return;
    }
    this._config = {
      ...config,
      title: config.title || DEFAULT_TITLE,
      text: config.text || DEFAULT_TEXT,
      fontSize: config.fontSize || DEFAULT_FONT_SIZE,
      elements: config.elements || []
    };
    this._lastConfig = config;
    
    this._layoutCalculationPending = true;
    this.requestUpdate(); 
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this._resizeObserver) {
       this._resizeObserver = new ResizeObserver(this._handleResize.bind(this));
    }
    if (document.readyState === 'complete') {
      this._triggerRecalc();
    } else {
      window.addEventListener('load', () => this._triggerRecalc(), { once: true });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        this._layoutCalculationPending = true;
        this.requestUpdate();
      });
    }
  }
  
  public firstUpdated() {
    const container = this.shadowRoot?.querySelector('.card-container');
    if (container && this._resizeObserver) {
      this._resizeObserver.observe(container);
      this._loadFontsAndInitialize();
    } else {
      console.error("[firstUpdated] Could not find .card-container to observe.");
    }
    this._hasRenderedOnce = true;
  }

  private _loadFontsAndInitialize(): void {
    // Collect all fonts used in the card
    const fontLoadPromises: Promise<FontFace[]>[] = [];
    const fontFamilies = new Set<string>();
    
    // Add fonts from text elements
    if (this._config.elements) {
      this._config.elements.forEach(el => {
        if (el.type?.toLowerCase() === 'text' && el.props) {
          const ff = (el.props.fontFamily || 'sans-serif').toString();
          fontFamilies.add(ff);
          const fs = (el.props.fontSize || DEFAULT_FONT_SIZE).toString();
          const fw = (el.props.fontWeight || 'normal').toString();
          try {
            fontLoadPromises.push(document.fonts.load(`${fw} ${fs}px ${ff}`));
          } catch (_e) {
            console.warn(`Failed to load font: ${fw} ${fs}px ${ff}`, _e);
          }
        } else if (el.type?.toLowerCase() === 'top_header' && el.props) {
          const ff = (el.props.fontFamily || 'Antonio').toString();
          fontFamilies.add(ff);
          const fw = (el.props.fontWeight || 'normal').toString();
          // Load at multiple sizes to ensure proper metrics
          try {
            fontLoadPromises.push(document.fonts.load(`${fw} 16px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 24px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 32px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 48px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 64px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 200px ${ff}`)); // For metrics calculation
          } catch (_e) {
            console.warn(`Failed to load font: ${fw} <size>px ${ff}`, _e);
          }
        }
      });
    }
    
    // If no specific fonts, ensure system fonts are ready
    if (fontLoadPromises.length === 0) {
      fontLoadPromises.push(document.fonts.load('normal 16px sans-serif'));
    }
    
    // Wait for fonts to load before calculating layout
    const fontsLoaded = Promise.all(fontLoadPromises);
    
    Promise.all([this.updateComplete, fontsLoaded])
      .then(() => {
        this._fontsLoaded = true;
        this._fontLoadAttempts = 0;
        console.log(`Fonts loaded successfully: ${Array.from(fontFamilies).join(', ')}`);
        // Use double requestAnimationFrame to ensure browser has time to process font loading
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this._scheduleInitialCalculation();
          });
        });
      })
      .catch((error) => {
        console.warn('Font loading error:', error);
        this._fontLoadAttempts++;
        
        if (this._fontLoadAttempts < this._maxFontLoadAttempts) {
          // Retry loading fonts with a delay
          setTimeout(() => {
            this._loadFontsAndInitialize();
          }, 200 * this._fontLoadAttempts); // Increasing delay for each attempt
        } else {
          // Proceed anyway after max attempts
          this._fontsLoaded = true;
          console.warn(`Proceeding with layout after ${this._maxFontLoadAttempts} font load attempts`);
          requestAnimationFrame(() => {
            this._scheduleInitialCalculation();
          });
        }
      });
  }

  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    super.disconnectedCallback();
  }
  
  private _scheduleInitialCalculation(): void {
    if (!this._containerRect) {
        const container = this.shadowRoot?.querySelector('.card-container');
        if (container) {
            const initialRect = container.getBoundingClientRect();
            if (initialRect.width > 0 && initialRect.height > 0) {
                this._containerRect = initialRect;
                this._performLayoutCalculation(this._containerRect);
            } else {
                console.warn("[_scheduleInitialCalculation] Initial Rect still zero dimensions. Relying on ResizeObserver.");
            }
        }
    } else {
         if(this._layoutCalculationPending){
            this.requestUpdate(); 
         }
    }
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>): void {
      super.updated(changedProperties);

      let didFullRecalc = false;
      if (this._layoutCalculationPending && this._containerRect && this._config) {
          this._performLayoutCalculation(this._containerRect);
          didFullRecalc = true;
      }

      if (didFullRecalc) {
          this._elementStateNeedsRefresh = false; 
      } else if (this._elementStateNeedsRefresh && this._containerRect && this._config && this._layoutEngine.layoutGroups.length > 0) {
          this._refreshElementRenders();
      }
      
      if (!this._hasMeasuredRenderedText && this._hasRenderedOnce && this._containerRect) {
          this._hasMeasuredRenderedText = true;
          requestAnimationFrame(() => this._measureAndRecalc());
      }
  }
  
  private _performLayoutCalculation(rect: DOMRect): void {
    if (!this._config || !rect || rect.width <= 0 || rect.height <= 0) {
        console.warn("[_performLayoutCalculation] Skipping, invalid config or rect", this._config, rect);
        this._layoutCalculationPending = false;
        return;
    }

    const svgElement = this.shadowRoot?.querySelector('.card-container svg') as SVGSVGElement | null;
    if (svgElement) {
      (this._layoutEngine as any).tempSvgContainer = svgElement;
    }
    this._layoutEngine.clearLayout();
    const groups = parseConfig(this._config, this.hass, () => { this._elementStateNeedsRefresh = true; this.requestUpdate(); }); 
    groups.forEach((group: Group) => { this._layoutEngine.addGroup(group); });

    this._layoutEngine.calculateBoundingBoxes(rect);

    const newTemplates = this._layoutEngine.layoutGroups.flatMap(group =>
        group.elements
            .map(el => el.render())
            .filter((template): template is SVGTemplateResult => template !== null)
    );
    const newViewBox = `0 0 ${rect.width} ${rect.height}`;

    if (JSON.stringify(newTemplates.map(t => ({s: t.strings, v: (t.values || []).map(val => String(val))}))) !== JSON.stringify(this._layoutElementTemplates.map(t => ({s:t.strings, v: (t.values || []).map(val => String(val))}))) || newViewBox !== this._viewBox) {
        this._layoutElementTemplates = newTemplates;
        this._viewBox = newViewBox;
    } else {
    }
    this._layoutCalculationPending = false;
  }

  private _refreshElementRenders(): void {
    if (!this._config || !this._containerRect || this._layoutEngine.layoutGroups.length === 0) {
        this._elementStateNeedsRefresh = false;
        return;
    }

    const newTemplates = this._layoutEngine.layoutGroups.flatMap(group =>
        group.elements
            .map(el => el.render())
            .filter((template): template is SVGTemplateResult => template !== null)
    );

    this._layoutElementTemplates = newTemplates;

    this._elementStateNeedsRefresh = false;
  }

  private _handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    const newRect = entry.contentRect;

    if (newRect.width > 0 && newRect.height > 0) {
        if (!this._containerRect || 
            Math.abs(this._containerRect.width - newRect.width) > 1 ||
            Math.abs(this._containerRect.height - newRect.height) > 1) 
        {
            this._containerRect = newRect;
            this._layoutCalculationPending = true;
            this.requestUpdate();
        }
    } else {
    }
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('lcars-card-editor') as LovelaceCardEditor;
  }

  public getCardSize(): number {
    return 3; 
  }

  protected render(): TemplateResult {
    if (!this._config || !this.hass) {
      return html``;
    }

    let svgContent: SVGTemplateResult | SVGTemplateResult[] | TemplateResult | string = '';
    let defsContent: SVGTemplateResult[] = [];

    if (!this._config.elements || this._config.elements.length === 0) {
      const { title, text, fontSize } = this._config;
      svgContent = svg`
        <g>
          <text x="16" y="30" font-weight="bold" fill="var(--primary-text-color, white)">${title}</text>
          <text x="16" y="60" font-size="${fontSize}px" fill="var(--secondary-text-color, lightgrey)">${text}</text>
        </g>
      `;
    } else {
      svgContent = this._layoutElementTemplates;

      this._layoutEngine.layoutGroups.forEach(group => {
        group.elements.forEach(el => {
          const layoutEl = el as any;
          if (layoutEl._maskDefinition && layoutEl._maskDefinition !== null) {
            defsContent.push(layoutEl._maskDefinition);
          }
        });
      });

      if (this._layoutCalculationPending && this._layoutElementTemplates.length === 0 && this._hasRenderedOnce) {
           svgContent = svg`<text x="10" y="20" fill="orange">Calculating layout...</text>`;
      }
    }

    return html`
      <ha-card>
        <div class="card-container">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox=${this._viewBox}
            preserveAspectRatio="xMidYMid meet"
          >
            ${defsContent.length > 0 ? svg`<defs>${defsContent}</defs>` : ''}
            ${svgContent}
          </svg>
        </div>
      </ha-card>
    `;
  }

  private _triggerRecalc(): void {
    this._layoutCalculationPending = true;
    this.requestUpdate();
  }

  private _measureAndRecalc(): void {
    // Skip if fonts aren't loaded yet
    if (!this._fontsLoaded) {
      console.warn('Skipping measurement - fonts not fully loaded yet');
      // Schedule another attempt
      setTimeout(() => this._loadFontsAndInitialize(), 100);
      return;
    }
    
    const svg = this.shadowRoot?.querySelector<SVGSVGElement>('.card-container svg');
    if (!svg || !this._containerRect) return;
    
    // Force a reflow to ensure accurate measurements
    svg.style.display = 'none';
    // Use getBoundingClientRect to force reflow without TypeScript errors
    void svg.getBoundingClientRect();
    svg.style.display = '';
    
    const measured: Record<string, {w: number; h: number}> = {};
    svg.querySelectorAll<SVGTextElement>('text[id]').forEach(el => {
      try {
        const bbox = el.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          measured[el.id] = { w: bbox.width, h: bbox.height };
        }
      } catch (e) {
        console.warn(`Error measuring text element ${el.id}:`, e);
      }
    });
    
    const engineAny = this._layoutEngine as any;
    const elementsMap: Map<string, any> = engineAny.elements;
    let changed = false;
    
    elementsMap.forEach((el: any, id: string) => {
      const m = measured[id];
      if (m && (el.intrinsicSize.width !== m.w || el.intrinsicSize.height !== m.h)) {
        el.intrinsicSize.width = m.w;
        el.intrinsicSize.height = m.h;
        el.intrinsicSize.calculated = true;
        changed = true;
      }
    });
    
    if (changed) {
      this._layoutCalculationPending = true;
      this._performLayoutCalculation(this._containerRect);
      const newTemplates = this._layoutEngine.layoutGroups.flatMap((group: any) =>
        group.elements.map((e: any) => e.render()).filter((t: any) => t !== null)
      );
      this._layoutElementTemplates = newTemplates;
      this._viewBox = `0 0 ${this._containerRect.width} ${this._containerRect.height}`;
      this.requestUpdate();
    }
  }
}
```

## File: src/styles/styles.ts

```typescript
import { css } from 'lit';

export const editorStyles = css`
  :host {
      display: block;
    }
    
    ha-card {
      width: 100%;
      box-sizing: border-box;
    }
    
    .card-container {
      width: 100%;
      position: relative;
      overflow: hidden;
    }
    
    svg {
      width: 100%;
      display: block;
      min-height: 50px;
    }
    
    /* Remove focus outline from SVG elements when clicked */
    svg *:focus {
      outline: none !important;
    }
    
    /* Remove outline from SVG button groups */
    svg .lcars-button-group:focus {
      outline: none !important;
    }
    
    /* Disable focus rectangle globally for the card */
    :host * {
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
      
  .layout-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin-bottom: 16px;
  }
  .layout-grid-2col ha-formfield {
    display: flex;
    flex-direction: column;
  }
  .layout-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin-bottom: 16px;
  }
  .layout-grid-2col ha-formfield {
    display: flex;
    flex-direction: column;
  }
  /* Add Styles for groups, elements, headers, warnings, forms */
  .groups-container {
      /* Add styles */
  }
  .group-editor {
      border: 1.5px solid var(--divider-color);
      border-radius: 6px;
      margin-bottom: 16px;
      background: var(--secondary-background-color);
  }
  .group-editor.ungrouped {
      /* Special style for ungrouped? */
      border-style: dashed;
  }
  .group-header {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
      gap: 8px;
  }
  .group-header.editing {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 8px;
  }
  .group-name {
      font-weight: bold;
  }
  .group-count {
      color: var(--secondary-text-color);
      font-size: 0.9em;
      margin-left: 4px;
  }
  .group-name-input,
  .element-name-input {
      flex: 1;
      margin-left: 8px;
      display: flex;
      flex-direction: column;
      width: 100%;
  }
  .group-name-input ha-textfield,
  .element-name-input ha-textfield {
      width: 100%;
  }
  .warning-text {
      color: var(--error-color);
      font-size: 0.9em;
      padding-left: 8px;
  }
  .delete-warning {
      background: var(--error-color);
      color: var(--text-primary-color);
      border-radius: 4px;
      margin: 8px 16px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
  }
  .delete-warning ha-button.warning-button {
      background: rgba(255,255,255,0.8);
      color: var(--error-color);
  }
  .delete-warning ha-button {
      margin-left: auto;
  }
  .spacer { flex: 1 1 auto; }

  .element-list {
      padding: 8px 16px 16px 16px;
  }
  .element-editor {
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      margin-bottom: 12px;
      background-color: var(--primary-background-color); /* Slightly different bg */
      transition: opacity 0.2s ease-in-out;
  }
  .element-editor.drag-over {
      border: 2px dashed var(--primary-color);
      background: rgba(var(--rgb-primary-color), 0.1);
  }
  .element-header {
      display: flex;
      align-items: center;
      padding: 6px 10px;
      cursor: pointer;
      user-select: none;
      gap: 8px;
      border-bottom: 1px solid var(--divider-color);
  }
  .element-header.editing {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 8px;
  }
  .element-name {
      font-weight: 500;
  }
  .element-type {
      color: var(--secondary-text-color);
      font-size: 0.9em;
      margin-left: 4px;
  }
  .collapse-icon {
      transition: transform 0.2s ease-in-out;
  }
  /* Consider rotating icon when collapsed? */

  .element-body {
      padding: 12px;
      background-color: rgba(var(--rgb-primary-background-color), 0.5);
      overflow: hidden; /* Prevent content from overflowing */
  }
  .element-section {
      margin-bottom: 16px;
  }
  .element-section h5 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 1.1em;
      border-bottom: 1px solid var(--accent-color);
      padding-bottom: 4px;
  }
  ha-icon-button {
    --mdc-icon-button-size: 36px; /* Smaller icon buttons */
  }
  .confirm-button {
      color: var(--primary-color);
      opacity: 0.5;
  }
  .confirm-button.valid {
      opacity: 1;
  }
  .confirm-button[disabled] {
      opacity: 0.5;
  }
  .cancel-button {
      color: var(--error-color);
  }
  .edit-button {
      /* Style */
  }
  .delete-button {
      color: var(--error-color);
  }
  .drag-handle:active {
      cursor: grab;
      /* Add minimal styling for the div handle */
      display: inline-flex; /* Align icon nicely */
      align-items: center;
      padding: 6px; /* Adjust padding as needed */
      margin-right: 4px; /* Spacing */
  }
  .drag-handle:active {
      cursor: grabbing;
  }
  .add-element-section,
  .add-group-section {
      text-align: right;
      margin-top: 8px;
  }
  .add-element-form {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: start;
      gap: 8px;
      padding: 8px;
      border: 1px dashed var(--divider-color);
      border-radius: 4px;
  }
  .add-element-form .element-name-input {
      width: 100%;
  }
  .layout-grid-2col { display: none; } /* Hide old layout */
  .element-section h5 { display: none; } /* Hide old section headers */
  /* Ensure custom grid selector is styled appropriately if rendered manually */
  lcars-grid-selector {
      margin-top: 8px;
      display: block;
      width: 100%; /* Ensure it doesn't overflow its container */
      max-width: 100%; /* Ensure it doesn't overflow its container */
      box-sizing: border-box; /* Include padding in width calculation */
  }

  /* Ensure the grid points themselves stay contained */
  lcars-grid-selector div {
      box-sizing: border-box;
      max-width: 100%;
  }
  ha-form {
      /* Add styles if needed */
  }
  .editing-actions {
      display: flex;
      margin-left: auto;
      gap: 4px;
  }
  /* Common styles for div-based icon buttons */
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px; /* Match drag handle or adjust */
    cursor: pointer;
    border-radius: 50%; /* Optional: make it round */
    transition: background-color 0.2s;
  }
  .icon-button:hover {
    background-color: rgba(var(--rgb-primary-text-color), 0.05);
  }
  .icon-button:active {
    background-color: rgba(var(--rgb-primary-text-color), 0.1);
  }

  /* Property layout styles */
  .property-container {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); /* Use minmax to prevent overflow */
    gap: 12px 16px;
    margin-bottom: 16px;
    /* overflow: hidden; /* Consider removing temporarily to debug overflow */
  }

  .property-full-width {
    grid-column: 1 / -1;
  }

  .property-left, .property-right {
    display: flex;
    flex-direction: column;
    gap: 12px; /* Add spacing between items in the same column */
    min-width: 0; /* Prevent content from expanding the grid cell */
  }

  .property-left {
    grid-column: 1;
  }

  .property-right {
    grid-column: 2;
  }

  /* Ensure ha-form and its contents respect the grid structure */
  .property-container ha-form {
    display: block; /* Ensure ha-form behaves as a block */
    width: 100%; /* Make ha-form fill its grid cell */
    box-sizing: border-box;
  }

  /* Target common elements within ha-form to ensure they don't overflow */
  .property-container ha-form ha-textfield,
  .property-container ha-form ha-select,
  .property-container ha-form ha-color-picker { /* Add other ha-form elements as needed */
    display: block; /* Ensure they take block layout */
    width: 100%; /* Make them fill the width of ha-form */
    box-sizing: border-box; /* Include padding/border in width */
  }

  /* Ensure custom grid selector behaves correctly */
  .property-container lcars-grid-selector {
    display: block;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  ha-form {
      /* Add styles if needed */
  }

  .editing-actions {
      display: flex;
      margin-left: auto;
      gap: 4px;
  }

  /* Common styles for div-based icon buttons */
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px; /* Match drag handle or adjust */
    cursor: pointer;
    border-radius: 50%; /* Optional: make it round */
    transition: background-color 0.2s;
  }

  .icon-button:hover {
    background-color: rgba(var(--rgb-primary-text-color), 0.05);
  }

  .icon-button:active {
    background-color: rgba(var(--rgb-primary-text-color), 0.1);
  }

  /* Stretch gap container */
  .stretch-gap-container {
    grid-column: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
  }
`;
```

## File: src/types.ts

```typescript
declare global {
  interface Window {
    customCards: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }
  
  interface HTMLInputElement {
    configValue?: string;
  }
}

export {};
```

## File: src/utils/fontmetrics.d.ts

```typescript
declare module 'fontmetrics' {
  interface FontMetricsOptions {
    fontFamily: string;
    fontWeight?: string | number;
    fontSize?: number;
    origin?: string;
  }
  interface FontMetricsResult {
    capHeight: number;
    baseline: number;
    xHeight: number;
    descent: number;
    bottom: number;
    ascent: number;
    tittle: number;
    top: number;
    fontFamily: string;
    fontWeight: string | number;
    fontSize: number;
  }
  function FontMetrics(options: FontMetricsOptions): FontMetricsResult;
  export = FontMetrics;
}
```

## File: src/utils/shapes.ts

```typescript
import FontMetrics from 'fontmetrics';

export const EPSILON = 0.0001;
export const CAP_HEIGHT_RATIO = 0.66;

export type Orientation = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export type Direction = 'left' | 'right';

interface Point { x: number; y: number; }
interface Vector { x: number; y: number; }

const VectorMath = {
    subtract: (p1: Point, p2: Point): Vector => ({ x: p1.x - p2.x, y: p1.y - p2.y }),
    add: (p: Point, v: Vector): Point => ({ x: p.x + v.x, y: p.y + v.y }),
    scale: (v: Vector, scalar: number): Vector => ({ x: v.x * scalar, y: v.y * scalar }),
    magnitude: (v: Vector): number => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v: Vector, epsilon = EPSILON): Vector | null => {
        const mag = VectorMath.magnitude(v);
        if (mag < epsilon) return null;
        return VectorMath.scale(v, 1 / mag);
    },
    dot: (v1: Vector, v2: Vector): number => v1.x * v2.x + v1.y * v2.y,
};


// === Core Shape Building Function ===

/**
 * Generates the SVG path 'd' attribute string for a shape defined by points,
 * applying rounded corners based on the radius specified at each point.
 * Uses an arc (`A` command) for rounded corners.
 * @param points - Array of points `[x, y, cornerRadius]` defining the shape polygon vertices.
 * @returns The SVG path data string (`d` attribute) or an empty string if input is invalid.
 */
export function buildShape(points: [number, number, number][]): string {
    if (!points || points.length < 3) {
        console.warn("LCARS Card: buildShape requires at least 3 points.");
        return "";
    }
    
    let pathData = "";
    const len = points.length;
    
    for (let i = 0; i < len; i++) {
        const p1 = points[i];
        const p0 = points[(i - 1 + len) % len];
        const p2 = points[(i + 1) % len];

        const [x, y, r] = p1;
        const [x0, y0] = p0;
        const [x2, y2] = p2;

        const v1x = x0 - x, v1y = y0 - y;
        const v2x = x2 - x, v2y = y2 - y;
        
        const magV1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const magV2 = Math.sqrt(v2x * v2x + v2y * v2y);
        
        let cornerRadius = r;
        let dist = 0;
        
        if (cornerRadius > EPSILON && magV1 > EPSILON && magV2 > EPSILON) {
            const dotProduct = v1x * v2x + v1y * v2y;
            const clampedDot = Math.max(-1 + EPSILON, Math.min(1 - EPSILON, dotProduct / (magV1 * magV2)));
            const angle = Math.acos(clampedDot);
            
            if (Math.abs(Math.sin(angle / 2)) > EPSILON && Math.abs(Math.tan(angle / 2)) > EPSILON) {
                dist = Math.abs(cornerRadius / Math.tan(angle / 2));
            
                dist = Math.min(dist, magV1, magV2);
            
                cornerRadius = dist * Math.abs(Math.tan(angle / 2));

            } else { 
                cornerRadius = 0;
                dist = 0; 
            }
        } else { 
            cornerRadius = 0;
            dist = 0; 
        }
        
        const normV1x = magV1 > EPSILON ? v1x / magV1 : 0;
        const normV1y = magV1 > EPSILON ? v1y / magV1 : 0;
        const normV2x = magV2 > EPSILON ? v2x / magV2 : 0;
        const normV2y = magV2 > EPSILON ? v2y / magV2 : 0;
        
        const arcStartX = x + normV1x * dist;
        const arcStartY = y + normV1y * dist;
        const arcEndX = x + normV2x * dist;
        const arcEndY = y + normV2y * dist;
        
        if (i === 0) { 
            pathData += `M ${cornerRadius > EPSILON ? arcStartX.toFixed(3) : x.toFixed(3)},${cornerRadius > EPSILON ? arcStartY.toFixed(3) : y.toFixed(3)} `;
        } else { 
            pathData += `L ${cornerRadius > EPSILON ? arcStartX.toFixed(3) : x.toFixed(3)},${cornerRadius > EPSILON ? arcStartY.toFixed(3) : y.toFixed(3)} `;
        }
        
        if (cornerRadius > EPSILON && dist > EPSILON) {
            const crossProductZ = v1x * v2y - v1y * v2x;
            const sweepFlag = crossProductZ > 0 ? 0 : 1;
            pathData += `A ${cornerRadius.toFixed(3)},${cornerRadius.toFixed(3)} 0 0,${sweepFlag} ${arcEndX.toFixed(3)},${arcEndY.toFixed(3)} `;
        }
    }
    
    pathData += "Z";
    return pathData;
}


/**
 * Generates the SVG path data (`d` attribute) for a "chisel" style endcap using `buildShape`.
 * @param width The total width of the shape's bounding box.
 * @param height The total height of the shape's bounding box.
 * @param side Which side the angled part is on ('left' or 'right').
 * @param x The starting x coordinate (top-left). Default 0.
 * @param y The starting y coordinate (top-left). Default 0.
 * @param topCornerRadius Radius for the top-right corner. Default 0.
 * @param bottomCornerRadius Radius for the bottom-right corner. Default 0.
 * @returns The SVG path data string (`d` attribute).
 */
export function generateChiselEndcapPath(
    width: number,
    height: number,
    side: 'left' | 'right',
    x: number = 0,
    y: number = 0,
    topCornerRadius: number = height / 8,
    bottomCornerRadius: number = height / 4
): string {
    let points: [number, number, number][];
    if (width <= 0 || height <= 0) {
        console.warn("LCARS Card: generateChiselEndcapPath requires positive width and height.");
        points = [[x, y, 0], [x, y, 0], [x, y, 0]];
    }
    else if (side === 'right') {
        const upperWidth = width;
        const lowerWidth = width - height / 2;
        points = [
            [x, y, 0],
            [x + upperWidth, y, topCornerRadius],
            [x + lowerWidth, y + height, bottomCornerRadius],
            [x, y + height, 0]
        ];
    } else if (side === 'left') {
        const lowerOffset = height / 2;
        points = [
            [x, y, topCornerRadius],
            [x + width, y, 0],
            [x + width, y + height, 0],
            [x + lowerOffset, y + height, bottomCornerRadius]
        ];
    } else {
        console.warn("LCARS Card: generateChiselEndcapPath currently only supports side='left' or 'right'. Falling back to rectangle.");
        points = [
            [x, y, 0],
            [x + width, y, 0],
            [x + width, y + height, 0],
            [x, y + height, 0]
        ];
    }
    return buildShape(points);
}

/**
 * Generates SVG path data (`d` attribute) for an elbow shape using `buildShape`.
 * An elbow is a shape with a "header" along one edge, and a vertical bar on a corner.
 * It forms an L with rounded corners.
 * 
 * The path will have a rounded inner corner where the horizontal and vertical parts meet.
 * 
 * @param x The starting X coordinate.
 * @param width Width of the horizontal leg.
 * @param bodyWidth Width (thickness) of the vertical leg.
 * @param armHeight Height (thickness) of the horizontal leg.
 * @param height Total height spanned by the vertical leg.
 * @param orientation Which corner the elbow is based in: 'top-left', 'top-right', 'bottom-left', 'bottom-right'.
 * @param y The starting Y coordinate. Default 0.
 * @param outerCornerRadius Optional radius for the *outer* sharp corners. Default 0.
 * @returns SVG path data string (`d` attribute).
 */
export function generateElbowPath(
    x: number,
    width: number,
    bodyWidth: number,
    armHeight: number,
    height: number,
    orientation: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
    y: number = 0,
    outerCornerRadius: number = armHeight
): string {
    let points: [number, number, number][];
    if (armHeight <= 0 || width <= 0 || bodyWidth <= 0 || height <= armHeight) {
        console.warn("LCARS Card: Invalid dimensions provided to generateElbowPath.");
        points = [[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]];
    } else {
    const h = armHeight;
    const wH = width;
    const wV = bodyWidth;
    const totalH = height;
    const innerRadius = Math.min(h / 2, wV);
    const maxOuterRadius = Math.min(wH, totalH);
    const safeOuterCornerRadius = Math.min(outerCornerRadius, maxOuterRadius);
    switch (orientation) {
        case 'top-left':
                points = [
                    [x + wH, y, 0], [x, y, safeOuterCornerRadius],
                    [x, y + totalH, 0], [x + wV, y + totalH, 0],
                    [x + wV, y + h, innerRadius], [x + wH, y + h, 0]
                ]; break;
        case 'top-right':
                points = [
                    [x, y, 0], [x + wH, y, safeOuterCornerRadius],
                    [x + wH, y + totalH, 0], [x + wH - wV, y + totalH, 0],
                    [x + wH - wV, y + h, innerRadius], [x, y + h, 0]
                ]; break;
            case 'bottom-right':
                points = [
                    [x, y + totalH - h, 0], [x + wH - wV, y + totalH - h, innerRadius],
                    [x + wH - wV, y, 0], [x + wH, y, 0],
                    [x + wH, y + totalH, safeOuterCornerRadius], [x, y + totalH, 0]
                ]; break;
            case 'bottom-left':
                points = [
                    [x + wH, y + totalH - h, 0], [x + wV, y + totalH - h, innerRadius],
                    [x + wV, y, 0], [x, y, 0],
                    [x, y + totalH, safeOuterCornerRadius], [x + wH, y + totalH, 0]
                ]; break;
            default:
                 console.error(`LCARS Card: Invalid orientation "${orientation}" provided to generateElbowPath.`);
                 points = [[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]];
        }
    }
    return buildShape(points);
}

/**
 * Generates SVG path data (`d` attribute) for a rounded endcap using `buildShape`.
 * @param width The total width of the shape. Must be >= height/2.
 * @param height The height of the shape.
 * @param direction The side where the rounded part is ('left' or 'right').
 * @param x The starting X coordinate (top-left corner). Default 0.
 * @param y The starting Y coordinate (top-left corner). Default 0.
 * @returns SVG path data string (`d` attribute).
 */
export function generateEndcapPath(
    width: number,
    height: number,
    direction: 'left' | 'right',
    x: number = 0,
    y: number = 0
): string {
    
    let points: [number, number, number][];
     if (height <= 0 || width <= 0) {
         console.warn("[generateEndcapPath] Requires positive width and height.");
         points = [[x, y, 0], [x, y, 0], [x, y, 0]];
    } else {
        const cornerRadius = width >= height/2 ? height/2 : width;
        
        if (direction === 'left') {
            points = [
                [x, y, cornerRadius],
                [x + width, y, 0],
                [x + width, y + height, 0],
                [x, y + height, cornerRadius]
            ];
        } else {
            points = [
                [x, y, 0],
                [x + width, y, cornerRadius],
                [x + width, y + height, cornerRadius],
                [x, y + height, 0]
            ];
        }
        
    }
    const pathD = buildShape(points);
    
    return pathD;
}

/**
 * Generates SVG path data (`d` attribute) for a simple rectangle using `buildShape`.
 * @param x The starting X coordinate (top-left corner).
 * @param y The starting Y coordinate (top-left corner).
 * @param width The width of the rectangle.
 * @param height The height of the rectangle.
 * @param cornerRadius Optional uniform radius for all corners. Default 0.
 * @returns SVG path data string (`d` attribute).
 */
export function generateRectanglePath(
    x: number,
    y: number,
    width: number,
    height: number,
    cornerRadius: number = 0
): string {
    let points: [number, number, number][];
    if (width <= 0 || height <= 0) {
        console.warn("LCARS Card: generateRectanglePath requires positive width and height.");
        points = [[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]];
    } else {
        points = [
            [x, y, cornerRadius], [x + width, y, cornerRadius],
            [x + width, y + height, cornerRadius], [x, y + height, cornerRadius]
        ];
    }
    return buildShape(points);
}

/**
 * Generates SVG path data (`d` attribute) for an equilateral triangle using `buildShape`.
 * Allows for rounded corners.
 * @param sideLength The length of each side of the triangle.
 * @param direction Orientation: 'left' (points right) or 'right' (points left).
 * @param centerX The X coordinate of the center. Default 0.
 * @param centerY The Y coordinate of the center. Default 0.
 * @param cornerRadius Optional radius for all corners. Default 0.
 * @returns SVG path data string (`d` attribute).
 */
export function generateTrianglePath(
    sideLength: number,
    direction: 'left' | 'right',
    centerX: number = 0,
    centerY: number = 0,
    cornerRadius: number = 0
): string {
    let points: [number, number, number][];
    if (sideLength <= 0) {
        console.warn("LCARS Card: generateTrianglePath requires positive sideLength.");
        points = [[centerX, centerY, 0], [centerX, centerY, 0], [centerX, centerY, 0]];
    } else {
        const h = (Math.sqrt(3) / 2) * sideLength;
        const distCenterToVertex = h * (2 / 3);
        const distCenterToBaseMidpoint = h / 3;

        if (direction === 'right') {
            const p1x = centerX + distCenterToVertex;
            const p1y = centerY;
            const p2x = centerX - distCenterToBaseMidpoint;
            const p2y = centerY - sideLength / 2;
            const p3x = centerX - distCenterToBaseMidpoint;
            const p3y = centerY + sideLength / 2;
            points = [[p1x, p1y, cornerRadius], [p2x, p2y, cornerRadius], [p3x, p3y, cornerRadius]];
        } else {
            const p1x = centerX - distCenterToVertex;
            const p1y = centerY;
            const p2x = centerX + distCenterToBaseMidpoint;
            const p2y = centerY + sideLength / 2;
            const p3x = centerX + distCenterToBaseMidpoint;
            const p3y = centerY - sideLength / 2;
            points = [[p1x, p1y, cornerRadius], [p2x, p2y, cornerRadius], [p3x, p3y, cornerRadius]];
        }
    }
    return buildShape(points);
}

let canvasContext: CanvasRenderingContext2D | null = null;

/**
 * Measures the width of text using SVG's native text measurement capabilities,
 * which account for font kerning and exact glyph widths.
 * Falls back to canvas measurement if SVG measurement fails.
 * @param text The text string to measure
 * @param font The CSS font string (e.g. "bold 16px Arial")
 * @param letterSpacing Optional letter-spacing value (e.g. "0.1em" or "1px")
 * @param textTransform Optional text-transform value (e.g. "uppercase")
 * @returns The measured width in pixels
 */
export function getSvgTextWidth(text: string, font: string, letterSpacing?: string, textTransform?: string): number {
    // Apply text transform if specified
    let transformedText = text;
    if (textTransform) {
        switch (textTransform.toLowerCase()) {
            case 'uppercase': transformedText = text.toUpperCase(); break;
            case 'lowercase': transformedText = text.toLowerCase(); break;
            case 'capitalize': 
                transformedText = text.replace(/\b\w/g, c => c.toUpperCase());
                break;
        }
    }

    try {
        if (typeof document !== 'undefined' && document.createElementNS) {
            // Create a temporary SVG element
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "0");
            svg.setAttribute("height", "0");
            svg.style.position = "absolute";
            svg.style.visibility = "hidden";
            document.body.appendChild(svg);
            
            // Create a text element with the specified font and text
            const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textElement.textContent = transformedText;
            
            // Parse and apply font properties
            const fontWeight = font.match(/^(bold|normal|[1-9]00)\s+/) ? 
                font.match(/^(bold|normal|[1-9]00)\s+/)?.[1] || 'normal' : 'normal';
            const fontSizeMatch = font.match(/(\d+(?:\.\d+)?)(?:px|pt|em|rem)/);
            const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16;
            const fontFamily = font.includes(' ') ? 
                font.substring(font.lastIndexOf(' ') + 1) : font;
            
            textElement.setAttribute("font-family", fontFamily);
            textElement.setAttribute("font-size", `${fontSize}px`);
            textElement.setAttribute("font-weight", fontWeight);
            
            // Apply letter spacing if specified
            if (letterSpacing) {
                textElement.setAttribute("letter-spacing", letterSpacing);
            }
            
            svg.appendChild(textElement);
            
            // Use SVG's native getComputedTextLength method
            const textWidth = textElement.getComputedTextLength();
            
            // Clean up
            document.body.removeChild(svg);
            
            if (isNaN(textWidth)) {
                throw new Error("Invalid text width measurement");
            }
            
            return textWidth;
        }
    } catch (e) {
        console.warn("LCARS Card: SVG text measurement failed, falling back to canvas:", e);
        // Fall back to canvas-based measurement
        return getTextWidth(transformedText, font);
    }
    
    return getTextWidth(transformedText, font);
}

/**
 * Measures the width of a text string using the 2D Canvas API.
 * Caches the canvas context for efficiency. Provides a rough fallback if canvas is unavailable.
 * @param text The text string to measure.
 * @param font The CSS font string (e.g., "bold 16px Arial").
 * @returns The measured width in pixels, or a fallback estimate if canvas fails.
 */
export function getTextWidth(text: string, font: string): number {
    if (!canvasContext) {
        try {
            if (typeof document !== 'undefined' && document.createElement) {
                const canvas = document.createElement('canvas');
                canvasContext = canvas.getContext('2d');
                if (!canvasContext) {
                     console.warn("LCARS Card: Failed to get 2D context for text measurement. Using fallback.");
                }
            } else {
                 console.warn("LCARS Card: Cannot create canvas for text measurement (document not available). Using fallback.");
                 canvasContext = null;
            }
        } catch (e) {
            console.error("LCARS Card: Error creating canvas context for text measurement.", e);
            canvasContext = null;
        }
    }

    if (canvasContext) {
        canvasContext.font = font;
        try {
            const metrics = canvasContext.measureText(text);
            return metrics.width;
        } catch (e) {
             console.error(`LCARS Card: Error measuring text width for font "${font}".`, e);
        }
    }

    console.warn(`LCARS Card: Using fallback text width estimation for font "${font}".`);
    const fontSizeMatch = font.match(/(\d+(?:\.\d+)?)(?:px|pt|em|rem)/);
    const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16;
    return text.length * fontSize * 0.6;
}

/**
 * Measures the bounding box of a rendered SVG text element using `getBBox()`.
 * @param element The SVGTextElement to measure.
 * @returns An object with `width` and `height`, or `null` if measurement fails, element is invalid, or not rendered.
 */
export function measureTextBBox(element: SVGTextElement | null): { width: number; height: number } | null {
    if (!element) {
        return null;
    }
    if (typeof element.getBBox !== 'function' || !element.isConnected) {
         return null;
    }

    try {
        const bbox = element.getBBox();
        if (bbox && typeof bbox.width === 'number' && typeof bbox.height === 'number' && bbox.width >= 0 && bbox.height >= 0) {
            return { width: bbox.width, height: bbox.height };
        } else {
            return null;
        }
    } catch (e) {
        return null;
    }
}

/**
 * Calculates a target bar height likely to visually align with the cap height of adjacent text,
 * based on the text's measured BBox height and the estimated CAP_HEIGHT_RATIO.
 * @param measuredTextHeight The height returned by `measureTextBBox`.
 * @returns The calculated height for an associated bar element, or 0 if input is invalid.
 */
export function calculateDynamicBarHeight(measuredTextHeight: number): number {
    if (measuredTextHeight <= 0) {
        return 0;
    }
    return measuredTextHeight * CAP_HEIGHT_RATIO;
}

/**
 * Gets detailed font metrics (ascent, descent, cap height, x-height, baseline, etc.) for a given font.
 * @param fontFamily The font family to measure (e.g., 'Roboto').
 * @param fontWeight The font weight (e.g., 'normal', 'bold', 400, 700).
 * @param fontSize The font size in px (number or string, e.g., 16 or '16px').
 * @param origin The origin for normalization (default: 'baseline').
 * @returns The normalized font metrics object, or null if measurement fails.
 */
export function getFontMetrics({
  fontFamily,
  fontWeight = 'normal',
  fontSize = 200,
  origin = 'baseline',
}: {
  fontFamily: string;
  fontWeight?: string | number;
  fontSize?: number | string;
  origin?: string;
}): ReturnType<typeof FontMetrics> | null {
  try {
    let size = typeof fontSize === 'string' ? parseFloat(fontSize) : fontSize;
    if (!size || isNaN(size)) size = 200;
    return FontMetrics({
      fontFamily,
      fontWeight: fontWeight as any,
      fontSize: size,
      origin,
    });
  } catch (e) {
    console.warn('LCARS Card: Failed to get font metrics for', fontFamily, e);
    return null;
  }
}
```

## File: TODO.md

```markdown
## BUGS:

## TODOs:

### Currently working on:
- Just fixed half-width property rendering, need to organize them and add expandable groups for them.

### Components
- implement headerbar as a standalone element

### Layout
- determine an appropriate way to handle groups of elements that curve into other groups of elements. visually, these look like they might be the same concept to group into a larger section

### Features
- determine a way to implement animation logic for elements
```

## File: tsconfig.json

```json
{
    "compilerOptions": {
      "target": "ES2020",
      "module": "ES2020",
      "moduleResolution": "node",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "experimentalDecorators": true, 
      "useDefineForClassFields": false, // Important for Lit property decorators
      "outDir": "dist", // Where the compiled JS for build goes
      "declaration": true, // Optional: Generate type definition files
      "sourceMap": true, // Optional: Generate source maps for debugging
      "strictPropertyInitialization": false // Disable strict initialization checks for classes
    },
    "include": ["src/**/*.ts"], // Which files to compile
    "exclude": ["node_modules", "dist"]
  }
```

## File: vite.config.ts

```typescript
import { defineConfig } from "vite";
// import basicSsl from '@vitejs/plugin-basic-ssl'; // Comment out or remove

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // basicSsl() // Comment out or remove
  ],
  server: {
    host: true,
    port: 5000,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    // https: true, // Comment out or remove this line
    proxy: {
      '/api/websocket': {
        target: 'ws://haos.pc:8123', // Your HA URL (ws://)
        changeOrigin: true,
        ws: true,
      },
      '^/(api|static|local|hacsfiles)': {
         target: 'http://haos.pc:8123', // Your HA URL (http://)
         changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: "src/lovelace-lcars-card.ts",
      output: {
        entryFileNames: "lovelace-lcars-card.js",
        format: "es",
      },
    },
    outDir: "dist",
    sourcemap: true,
  },
});
```

