<!-- Source: https://github.com/mattpocock/skills/tree/main/tdd/refactoring.md -->
<!-- License: MIT — https://github.com/mattpocock/skills/blob/main/LICENSE -->
<!-- Do not edit directly — regenerate with: npm run build -->

# Refactor Candidates

After TDD cycle, look for:

- **Duplication** → Extract function/class
- **Long methods** → Break into private helpers (keep tests on public interface)
- **Shallow modules** → Combine or deepen
- **Feature envy** → Move logic to where data lives
- **Primitive obsession** → Introduce value objects
- **Existing code** the new code reveals as problematic
