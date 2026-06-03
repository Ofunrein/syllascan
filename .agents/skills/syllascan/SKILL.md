```markdown
# syllascan Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `syllascan` TypeScript codebase. It covers file naming, import/export styles, commit message conventions, and testing patterns. Use this as a reference for contributing code, maintaining consistency, and running common workflows.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `syllaScanParser.ts`, `dataLoader.ts`

### Import Style
- Use **alias imports** for modules.
  - Example:
    ```typescript
    import * as utils from './utils';
    import { parseData as parse } from './parser';
    ```

### Export Style
- Prefer **named exports**.
  - Example:
    ```typescript
    // In parser.ts
    export function parseData(input: string): ParsedResult { ... }
    export const VERSION = '1.0.0';
    ```

### Commit Messages
- Use **conventional commit** format.
- Prefix with type, e.g., `fix:`, followed by a concise description.
  - Example:
    ```
    fix: handle edge case in parseData for empty input
    ```

## Workflows

### Code Contribution
**Trigger:** When adding or updating code in the repository  
**Command:** `/contribute`

1. Create or update files using camelCase naming.
2. Use alias imports and named exports as per conventions.
3. Write clear, conventional commit messages.
4. Add or update tests in files matching `*.test.*`.
5. Submit a pull request for review.

### Testing
**Trigger:** Before submitting or merging changes  
**Command:** `/test`

1. Locate or create test files with the pattern `*.test.*`.
2. Write or update tests for new or changed code.
3. Run the test suite using the project's test runner (framework unknown; check project scripts).
4. Ensure all tests pass before committing.

### Bug Fixing
**Trigger:** When fixing a bug  
**Command:** `/fix`

1. Identify the bug and update the relevant code using project conventions.
2. Add or update tests to cover the bug scenario.
3. Commit using the `fix:` prefix and a descriptive message.
4. Run all tests to confirm the fix.
5. Push changes and open a pull request.

## Testing Patterns

- Test files follow the `*.test.*` naming pattern (e.g., `parser.test.ts`).
- The testing framework is not specified; check project scripts or dependencies for details.
- Place tests close to the code they cover for easier maintenance.

**Example:**
```typescript
// parser.test.ts
import { parseData } from './parser';

describe('parseData', () => {
  it('should handle empty input', () => {
    expect(parseData('')).toEqual({ ... });
  });
});
```

## Commands
| Command      | Purpose                                   |
|--------------|-------------------------------------------|
| /contribute  | Start the code contribution workflow      |
| /test        | Run or update the test suite              |
| /fix         | Begin a bug fixing workflow               |
```
