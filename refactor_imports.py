import os
import re

# Configuration
ROOT_DIR = os.getcwd()
SRC_DIR = os.path.join(ROOT_DIR, 'src')
APP_DIR = os.path.join(ROOT_DIR, 'app')

# Define aliases mapping (Order matters: more specific first)
ALIASES = [
    ('src/modules', '@/modules'),
    ('src/shared', '@/shared'),
    ('src/db', '@/db'),
    ('app', '@/app'),
    ('src/components', '@/components'),
    ('src/types', '@/types'),
    ('src/lib', '@/lib'),
    ('src/hooks', '@/hooks'),
    ('src/stores', '@/stores'),
    ('src/context', '@/context'),
    ('src/guidelines', '@/guidelines'),
    ('assets', '@/assets'),
]

# Regex to find import statements
# Matches: import ... from '...' or import ... from "..."
# Also require/export statements if needed, but usually imports in TS.
IMPORT_REGEX = re.compile(r"""(import\s+.*?from\s+['"])(.*?)(['"])|(export\s+.*?from\s+['"])(.*?)(['"])|(require\(['"])(.*?)(['"])""")

def resolve_path(current_file_path, import_path):
    """
    Resolves the absolute path (relative to repo root) of an import.
    """
    if import_path.startswith('.'):
        current_dir = os.path.dirname(current_file_path)
        abs_path = os.path.abspath(os.path.join(current_dir, import_path))
        rel_path = os.path.relpath(abs_path, ROOT_DIR)
        return rel_path
    return import_path

def get_alias_for_path(path):
    """
    Returns the best matching alias for a given path relative to repo root.
    """
    # Check against aliases
    for source, alias in ALIASES:
        if path == source or path.startswith(source + os.sep) or path.startswith(source + '/'):
            # Replace source with alias
            # e.g. src/hooks/useTheme -> @/hooks/useTheme
            return path.replace(source, alias, 1)
    return None

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content

    # We iterate over lines or matches. regex substitution is tricky with context.
    # Let's do a custom replacement function.

    def replacer(match):
        # identify which group matched
        if match.group(1): # import
            prefix = match.group(1)
            path = match.group(2)
            suffix = match.group(3)
        elif match.group(4): # export
            prefix = match.group(4)
            path = match.group(5)
            suffix = match.group(6)
        elif match.group(7): # require
            prefix = match.group(7)
            path = match.group(8)
            suffix = match.group(9)
        else:
            return match.group(0)

        # Only process relative imports that go up the tree
        if not path.startswith('.'):
            return match.group(0)

        resolved = resolve_path(filepath, path)

        # Check if resolved path is outside of root (shouldn't happen normally unless ../../../ goes too far)
        if resolved.startswith('..'):
            return match.group(0)

        aliased = get_alias_for_path(resolved)

        if aliased:
            # Ensure we use forward slashes for imports
            aliased = aliased.replace(os.sep, '/')

            # Only replace if it actually changed something and it looks cleaner
            # or if it matches the requirement (replacing ../../src etc)

            # Check if we are replacing a relative path that is "messy"
            # e.g. ../../src/hooks vs @/hooks
            if path != aliased:
                # Also check if we are just replacing ./ with @/ in the same directory?
                # E.g. import {x} from './types' -> @/modules/m/types.
                # This might be too aggressive if we want to keep local imports local.
                # User asked: "convert imports matching ../../src/* to @/*"
                # and "Example: Change ../../db/models/Friend to @/db/models/Friend"

                # If the original path contains "../..", definitely replace.
                if "../../" in path:
                    return f"{prefix}{aliased}{suffix}"

                # If the original path is strictly inside the same module, maybe keep it relative?
                # But user said "convert imports matching ../../src/*".

                # Let's implement a check: only replace if it traverses up significantly OR explicitly targets src/

                # Case 1: path starts with ../../
                if path.startswith("../../"):
                    return f"{prefix}{aliased}{suffix}"

                # Case 2: path contains /src/ (e.g. ../src/)
                if "/src/" in path:
                    return f"{prefix}{aliased}{suffix}"

                # Case 3: User example ../../db/models/Friend.
                # This is covered by startsWith("../../")

                # Case 4: ../../../hooks covered by startsWith

        return match.group(0)

    new_content = IMPORT_REGEX.sub(replacer, content)

    if new_content != content:
        print(f"Updating {filepath}")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

def main():
    extensions = ('.ts', '.tsx', '.js', '.jsx')
    for root_dir in [SRC_DIR, APP_DIR]:
        for root, dirs, files in os.walk(root_dir):
            for file in files:
                if file.endswith(extensions):
                    process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
