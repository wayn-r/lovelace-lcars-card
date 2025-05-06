import { LcarsElementBase, RectangleElement } from "./properties/element";

export class LcarsGroup {
    id: string;

    // --- UI State Properties ---
    isCollapsed: boolean = true;
    isEditingName: boolean = false;
    isDeleteWarningVisible: boolean = false;
    currentNameInput: string = '';
    editErrorMessage: string = ''; // For validation feedback

    constructor(id: string) {
        this.id = id;
        this.currentNameInput = id; // Initialize input with current ID
    }

    // --- State Management Methods ---

    toggleCollapse(): void {
        this.isCollapsed = !this.isCollapsed;
    }

    startEditingName(): void {
        this.isEditingName = true;
        this.currentNameInput = this.id; // Reset input to current ID
        this.editErrorMessage = '';
        // Note: Need to trigger re-render in the main editor
    }

    cancelEditingName(): void {
        this.isEditingName = false;
        this.editErrorMessage = '';
        // Note: Need to trigger re-render
    }

    updateNameInput(value: string): void {
        this.currentNameInput = value;
        // Perform validation inline? Or wait until confirm?
        this.validateNameInput(); // Example validation on change
        // Note: Need to trigger re-render
    }

    validateNameInput(): boolean {
        // Check for empty string after trimming
        const trimmed = this.currentNameInput.trim();
        if (!trimmed) {
             this.editErrorMessage = 'Group ID cannot be empty.';
             return false;
        }
        
        // Check if the original input contains spaces (different from trimmed length)
        if (this.currentNameInput !== trimmed) {
            this.editErrorMessage = 'Group ID cannot contain spaces.';
            return false;
        }
        
        // Check for valid characters
        if (!/^[a-zA-Z0-9_-]+$/.test(this.currentNameInput)) {
            this.editErrorMessage = 'Group ID must be letters, numbers, _, -.';
            return false;
        }
        
        // Instance validation doesn't check for duplicates against the global list here
        this.editErrorMessage = ''; 
        return true;
    }

    requestDelete(): void {
        this.isDeleteWarningVisible = true;
        // Note: Need to trigger re-render
    }

    cancelDelete(): void {
        this.isDeleteWarningVisible = false;
        // Note: Need to trigger re-render
    }

    // --- Methods Requiring Interaction with Main Editor --- 

    // These methods would typically accept callbacks or dispatch events
    // to inform LcarsCardEditor to update the central config.

    /** Placeholder: Signals intent to finalize the name change */
    confirmEditName(): { oldId: string, newId: string } | null {
        if (!this.isEditingName || !this.validateNameInput()) {
            return null; // Do nothing if not editing or invalid
        }
        // Use the current input without trimming since validateNameInput already checks for spaces
        const newId = this.currentNameInput;
        if (newId === this.id) { // No actual change
            this.cancelEditingName();
            return null;
        }
        // Return necessary info for the main editor to handle the update
        // The main editor will check for name conflicts before proceeding
        const result = { oldId: this.id, newId: newId };
        this.isEditingName = false; // Reset state locally
        this.editErrorMessage = '';
        // Main editor needs to handle config update & re-render
        return result;
    }

    /** Placeholder: Signals intent to finalize deletion */
    confirmDelete(): { groupId: string } {
         // Return group ID for main editor to handle deletion
         const result = { groupId: this.id };
         this.isDeleteWarningVisible = false; // Reset state locally
         // Main editor needs to handle config update & re-render
         return result;
    }

    // --- Element Addition Logic ---
    requestAddElement(baseId: string, existingElementIdsInGroup: Set<string>): { newElementConfig?: any, error?: string } {
        const trimmedBaseId = baseId.trim();

        // Use LcarsElementBase validation for format check
        const tempElement = new RectangleElement({ id: '', type: 'rectangle' }); // Dummy instance
        tempElement.currentIdInput = trimmedBaseId;
        if (!tempElement.validateIdInput()) {
            return { error: tempElement.idEditErrorMessage };
        }

        // Check for duplicates within the group
        const fullId = `${this.id}.${trimmedBaseId}`;
        if (existingElementIdsInGroup.has(fullId)) {
            return { error: 'Element ID already exists in this group.' };
        }

        // Create default config
        const newElementConfig = {
            id: fullId,
            type: 'rectangle', 
            props: { fill: '#FF9900' },
            layout: { width: 100, height: 30 },
        };

        return { newElementConfig };
    }

    // --- Static Validation for New Groups ---
    static validateNewGroupName(name: string, existingGroupIds: Set<string>): { isValid: boolean, error?: string } {
        // Check for empty string after trimming
        const trimmed = name.trim();
        if (!trimmed) {
            return { isValid: false, error: 'Group ID cannot be empty.' };
        }
        
        // Check if the original input contains spaces (different from trimmed length)
        if (name !== trimmed) {
            return { isValid: false, error: 'Group ID cannot contain spaces.' };
        }
        
        // Check for valid characters
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            return { isValid: false, error: 'Group ID must be letters, numbers, _, -.' };
        }
        
        // Check for duplicates
        if (existingGroupIds.has(name)) {
            return { isValid: false, error: 'Group name already exists.' };
        }
        
        return { isValid: true };
    }
} 