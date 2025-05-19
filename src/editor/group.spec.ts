// src/editor/group.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LcarsGroup } from './group'; // The class under test

describe('LcarsGroup', () => {
    let group: LcarsGroup;
    const initialGroupId = 'testGroup';

    beforeEach(() => {
        // Resetting mocks is good practice, though we aren't directly mocking LcarsGroup internals here.
        // This would be important if LcarsGroup had external dependencies being mocked.
        vi.clearAllMocks();
        group = new LcarsGroup(initialGroupId);
    });

    describe('Constructor', () => {
        it('should initialize with the given ID', () => {
            expect(group.id).toBe(initialGroupId);
        });

        it('should initialize currentNameInput with the ID', () => {
            expect(group.currentNameInput).toBe(initialGroupId);
        });

        it('should initialize isCollapsed to true', () => {
            expect(group.isCollapsed).toBe(true);
        });

        it('should initialize isEditingName to false', () => {
            expect(group.isEditingName).toBe(false);
        });

        it('should initialize isDeleteWarningVisible to false', () => {
            expect(group.isDeleteWarningVisible).toBe(false);
        });

        it('should initialize editErrorMessage to an empty string', () => {
            expect(group.editErrorMessage).toBe('');
        });
    });

    describe('UI State Methods - Collapse', () => {
        it('toggleCollapse should flip the isCollapsed state', () => {
            expect(group.isCollapsed).toBe(true);
            group.toggleCollapse();
            expect(group.isCollapsed).toBe(false);
            group.toggleCollapse();
            expect(group.isCollapsed).toBe(true);
        });
    });

    describe('UI State Methods - Name Editing', () => {
        describe('startEditingName', () => {
            it('should set isEditingName to true', () => {
                group.startEditingName();
                expect(group.isEditingName).toBe(true);
            });

            it('should set currentNameInput to the current group ID', () => {
                group.id = 'anotherGroup';
                group.startEditingName();
                expect(group.currentNameInput).toBe('anotherGroup');
            });

            it('should reset editErrorMessage', () => {
                group.editErrorMessage = 'An old error';
                group.startEditingName();
                expect(group.editErrorMessage).toBe('');
            });
        });

        describe('cancelEditingName', () => {
            it('should set isEditingName to false', () => {
                group.startEditingName();
                group.cancelEditingName();
                expect(group.isEditingName).toBe(false);
            });

            it('should reset editErrorMessage', () => {
                group.startEditingName();
                group.editErrorMessage = 'Error during editing';
                group.cancelEditingName();
                expect(group.editErrorMessage).toBe('');
            });
        });

        describe('updateNameInput', () => {
            it('should update currentNameInput', () => {
                group.updateNameInput('new-name');
                expect(group.currentNameInput).toBe('new-name');
            });

            it('should validate the input and update editErrorMessage if invalid', () => {
                group.updateNameInput('invalid name!'); // Contains space and !
                expect(group.editErrorMessage).not.toBe('');
                // Specific message check depends on validateIdentifier, tested separately
                expect(group.editErrorMessage).toBe('Group ID must only contain letters, numbers, underscores (_), or hyphens (-).');
            });

            it('should validate the input and clear editErrorMessage if valid', () => {
                group.editErrorMessage = 'Previous error';
                group.updateNameInput('valid-name');
                expect(group.editErrorMessage).toBe('');
            });
        });

        describe('confirmEditName', () => {
            const existingGroupIds = new Set(['existingGroup1', 'existingGroup2']);

            beforeEach(() => {
                group.startEditingName(); // Common setup for confirmEditName tests
            });

            it('should return null and set error if currentNameInput is invalid (e.g., empty)', () => {
                group.currentNameInput = '';
                const result = group.confirmEditName(existingGroupIds);
                expect(result).toBeNull();
                expect(group.editErrorMessage).toBe('Group ID cannot be empty.');
                expect(group.isEditingName).toBe(true); // Should remain in editing mode
            });

            it('should return null and set error if currentNameInput is invalid (e.g., bad characters)', () => {
                group.currentNameInput = 'bad name!';
                const result = group.confirmEditName(existingGroupIds);
                expect(result).toBeNull();
                expect(group.editErrorMessage).toBe('Group ID must only contain letters, numbers, underscores (_), or hyphens (-).');
                expect(group.isEditingName).toBe(true);
            });

            it('should return null and set error if currentNameInput conflicts with an existing group ID', () => {
                group.currentNameInput = 'existingGroup1';
                const result = group.confirmEditName(existingGroupIds);
                expect(result).toBeNull();
                expect(group.editErrorMessage).toBe("Group ID 'existingGroup1' already exists.");
                expect(group.isEditingName).toBe(true);
            });

            it('should return null and reset editing state if new ID is the same as the old ID', () => {
                group.currentNameInput = initialGroupId; // Same as group.id
                const result = group.confirmEditName(existingGroupIds);
                expect(result).toBeNull();
                expect(group.isEditingName).toBe(false);
                expect(group.editErrorMessage).toBe('');
            });

            it('should return old and new IDs and reset editing state on successful name change', () => {
                const newValidId = 'newValidGroup';
                group.currentNameInput = newValidId;
                const result = group.confirmEditName(existingGroupIds);

                expect(result).toEqual({ oldId: initialGroupId, newId: newValidId });
                expect(group.isEditingName).toBe(false);
                expect(group.editErrorMessage).toBe('');
            });

             it('should return null if not in editing mode (isEditingName is false)', () => {
                group.isEditingName = false; // Manually set to false
                group.currentNameInput = 'a-new-name';
                const result = group.confirmEditName(existingGroupIds);
                expect(result).toBeNull();
                expect(group.editErrorMessage).toBe('Validation failed.'); // Generic error when not editing
            });
        });
    });

    describe('UI State Methods - Deletion', () => {
        describe('requestDelete', () => {
            it('should set isDeleteWarningVisible to true', () => {
                group.requestDelete();
                expect(group.isDeleteWarningVisible).toBe(true);
            });
        });

        describe('cancelDelete', () => {
            it('should set isDeleteWarningVisible to false', () => {
                group.requestDelete(); // Set to true first
                group.cancelDelete();
                expect(group.isDeleteWarningVisible).toBe(false);
            });
        });

        describe('confirmDelete', () => {
            it('should return an object with the groupId', () => {
                const result = group.confirmDelete();
                expect(result).toEqual({ groupId: initialGroupId });
            });

            it('should set isDeleteWarningVisible to false', () => {
                group.requestDelete(); // Set to true first
                group.confirmDelete();
                expect(group.isDeleteWarningVisible).toBe(false);
            });
        });
    });

    describe('requestAddElement', () => {
        const existingElementIdsInGroup = new Set([
            `${initialGroupId}.existingEl1`,
            `${initialGroupId}.existingEl2`
        ]);

        it('should return a new element config for a valid and unique base ID', () => {
            const result = group.requestAddElement('newElement', existingElementIdsInGroup);
            expect(result.error).toBeUndefined();
            expect(result.newElementConfig).toBeDefined();
            expect(result.newElementConfig?.id).toBe(`${initialGroupId}.newElement`);
            expect(result.newElementConfig?.type).toBe('rectangle'); // Default type
            expect(result.newElementConfig?.props).toEqual({ fill: '#FF9900' });
            expect(result.newElementConfig?.layout).toEqual({ width: 100, height: 30 });
        });

        it('should trim whitespace from base ID before validation and use', () => {
            const result = group.requestAddElement('  paddedElement  ', existingElementIdsInGroup);
            expect(result.error).toBeUndefined();
            expect(result.newElementConfig?.id).toBe(`${initialGroupId}.paddedElement`);
        });

        it('should return an error if the base ID format is invalid (e.g., empty after trim)', () => {
            const result = group.requestAddElement('   ', existingElementIdsInGroup);
            expect(result.newElementConfig).toBeUndefined();
            expect(result.error).toBe('Element base ID cannot be empty.');
        });

        it('should return an error if the base ID format is invalid (e.g., bad characters)', () => {
            const result = group.requestAddElement('bad!element', existingElementIdsInGroup);
            expect(result.newElementConfig).toBeUndefined();
            expect(result.error).toBe('Element base ID must only contain letters, numbers, underscores (_), or hyphens (-).');
        });

        it('should return an error if the full element ID (group.baseId) already exists', () => {
            const result = group.requestAddElement('existingEl1', existingElementIdsInGroup);
            expect(result.newElementConfig).toBeUndefined();
            expect(result.error).toBe(`Element ID '${initialGroupId}.existingEl1' already exists.`);
        });
    });

    describe('Static Method: validateIdentifier', () => {
        const entityType = "Test Entity";
        const existingIds = new Set(['existing-id', 'another_one']);

        it('should return invalid for empty string', () => {
            const result = LcarsGroup.validateIdentifier("", entityType, existingIds);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(`${entityType} cannot be empty.`);
        });

        it('should return invalid for string with only spaces', () => {
            const result = LcarsGroup.validateIdentifier("   ", entityType, existingIds);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(`${entityType} cannot be empty.`);
        });

        it('should return invalid for string with leading spaces', () => {
            const result = LcarsGroup.validateIdentifier(" valid", entityType, existingIds);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(`${entityType} cannot have leading or trailing spaces.`);
        });

        it('should return invalid for string with trailing spaces', () => {
            const result = LcarsGroup.validateIdentifier("valid ", entityType, existingIds);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(`${entityType} cannot have leading or trailing spaces.`);
        });

        it('should return invalid for string with invalid characters (e.g., space, !, .)', () => {
            const invalidChars = [' ', '!', '.', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '='];
            invalidChars.forEach(char => {
                const result = LcarsGroup.validateIdentifier(`test${char}invalid`, entityType, existingIds);
                expect(result.isValid).toBe(false);
                expect(result.error).toBe(`${entityType} must only contain letters, numbers, underscores (_), or hyphens (-).`);
            });
        });

        it('should return invalid if ID already exists in existingIds', () => {
            const result = LcarsGroup.validateIdentifier("existing-id", entityType, existingIds);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(`${entityType} 'existing-id' already exists.`);
        });

        it('should return valid for a unique ID with allowed characters', () => {
            const result = LcarsGroup.validateIdentifier("new-valid_ID123", entityType, existingIds);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return valid if ID is unique and existingIds is undefined', () => {
            const result = LcarsGroup.validateIdentifier("new-valid_ID123", entityType, undefined);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return valid if ID is unique and existingIds is empty', () => {
            const result = LcarsGroup.validateIdentifier("new-valid_ID123", entityType, new Set());
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should correctly trim input for allowed character and uniqueness checks, but fail on original for space presence', () => {
            // Test case where "  existing-id  " is input.
            // 1. _validateNotEmpty passes for "existing-id".
            // 2. _validateNoLeadingTrailingSpaces fails for "  existing-id  ".
            let result = LcarsGroup.validateIdentifier("  existing-id  ", entityType, existingIds);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(`${entityType} cannot have leading or trailing spaces.`);

            // Test case where "  valid-non-existing  " is input.
            // Same as above, fails on space check.
            result = LcarsGroup.validateIdentifier("  valid-non-existing  ", entityType, existingIds);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(`${entityType} cannot have leading or trailing spaces.`);

            // Test case where "valid-but-has space" is input. (space in middle)
            // 1. _validateNotEmpty passes for "valid-but-has space".
            // 2. _validateNoLeadingTrailingSpaces passes for "valid-but-has space".
            // 3. _validateAllowedCharacters fails for "valid-but-has space".
            result = LcarsGroup.validateIdentifier("valid-but-has space", entityType, existingIds);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(`${entityType} must only contain letters, numbers, underscores (_), or hyphens (-).`);
        });
    });
});