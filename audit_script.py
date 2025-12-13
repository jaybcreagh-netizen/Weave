import os
import re
import json

def audit_codebase(root_dirs):
    findings = {
        "architecture": {
            "module_violations": [],
            "zustand_usage": [],
            "deep_imports": [],
        },
        "styling": {
            "stylesheet_create": [],
            "hardcoded_colors": [],
        },
        "code_quality": {
            "any_usage": [],
            "console_log": [],
            "todo_comments": [],
        },
        "performance": {
            "flashlist_missing_size": [],
            "potential_n_plus_one": [],
        },
        "logic": {
            "database_write": [],
        }
    }

    # Regex patterns
    module_violation_pattern = re.compile(r"from ['\"]@/modules/([^/]+)/([^/]+)/.*['\"]") # Basic check, needs refinement
    deep_import_pattern = re.compile(r"from ['\"]@/modules/([^/]+)/(.*)['\"]")
    zustand_pattern = re.compile(r"import.*from ['\"]zustand['\"]")
    stylesheet_pattern = re.compile(r"StyleSheet\.create")
    hex_color_pattern = re.compile(r"['\"]#[0-9a-fA-F]{6}['\"]")
    any_pattern = re.compile(r":\s*any\b")
    console_log_pattern = re.compile(r"console\.log\(")
    todo_pattern = re.compile(r"//\s*TODO")
    flashlist_pattern = re.compile(r"<FlashList")
    estimated_size_pattern = re.compile(r"estimatedItemSize={")
    loop_await_pattern = re.compile(r"for\s*\(.*\).*await") # Very basic heuristic

    for root_dir in root_dirs:
        for subdir, dirs, files in os.walk(root_dir):
            if "node_modules" in subdir or ".git" in subdir:
                continue

            for file in files:
                if not file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                    continue

                filepath = os.path.join(subdir, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        lines = content.splitlines()

                    # File-level checks
                    if zustand_pattern.search(content):
                        findings["architecture"]["zustand_usage"].append(filepath)

                    if stylesheet_pattern.search(content):
                        findings["styling"]["stylesheet_create"].append(filepath)

                    if flashlist_pattern.search(content) and not estimated_size_pattern.search(content):
                         findings["performance"]["flashlist_missing_size"].append(filepath)

                    # Line-level checks
                    for i, line in enumerate(lines):
                        line_num = i + 1

                        # Architecture: Deep imports / Module violations
                        # Rule: modules should only import from other modules' index, not internals
                        # Pattern: from "@/modules/interactions/services/..." is BAD if outside interactions
                        # We need to know the current module context.

                        current_module = None
                        if "src/modules/" in filepath:
                            parts = filepath.split("src/modules/")
                            if len(parts) > 1:
                                current_module = parts[1].split("/")[0]

                        match = deep_import_pattern.search(line)
                        if match:
                            target_module = match.group(1)
                            target_internal = match.group(2)
                            # If importing from a DIFFERENT module's internals (not just the module alias itself)
                            # Assuming @/modules/X imports index.ts of X.
                            # If it imports @/modules/X/services/Y, that's a deep import violation usually.

                            if target_module != current_module and "/" in target_internal:
                                 findings["architecture"]["module_violations"].append({
                                    "file": filepath,
                                    "line": line_num,
                                    "content": line.strip()
                                })

                        # Styling
                        if hex_color_pattern.search(line):
                             findings["styling"]["hardcoded_colors"].append({
                                "file": filepath,
                                "line": line_num,
                                "content": line.strip()
                            })

                        # Code Quality
                        if any_pattern.search(line):
                            findings["code_quality"]["any_usage"].append({
                                "file": filepath,
                                "line": line_num,
                                "content": line.strip()
                            })

                        if console_log_pattern.search(line):
                             findings["code_quality"]["console_log"].append({
                                "file": filepath,
                                "line": line_num,
                                "content": line.strip()
                            })

                except Exception as e:
                    print(f"Error reading {filepath}: {e}")

    print(json.dumps(findings, indent=2))

if __name__ == "__main__":
    audit_codebase(["src", "app"])
