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