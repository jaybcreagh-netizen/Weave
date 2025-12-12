import json
import os

try:
    with open('eslint_report.json') as f:
        data = json.load(f)

    violations = []
    for file_result in data:
        for message in file_result.get('messages', []):
            if message.get('ruleId') == 'no-restricted-imports':
                violations.append({
                    'file': file_result['filePath'].replace(os.getcwd() + '/', ''),
                    'line': message['line'],
                    'message': message['message']
                })

    print(f"Total 'no-restricted-imports' violations: {len(violations)}")
    
    cross_module = []
    same_module = []
    other_to_module = []

    for v in violations:
        # Check source module
        source_module = None
        if v['file'].startswith('src/modules/'):
            parts = v['file'].split('/')
            if len(parts) > 2:
                source_module = parts[2]
        
        # Check target module from message or we need to extract it from file content?
        # The message contains the import path: "'@/modules/X/...' import is restricted..."
        import_path = v['message'].split("'")[1]
        
        target_module = None
        if import_path.startswith('@/modules/'):
            parts = import_path.split('/')
            if len(parts) > 2:
                target_module = parts[2]
        
        info = {'file': v['file'], 'import': import_path, 'line': v['line']}
        
        if source_module and target_module:
            if source_module == target_module:
                same_module.append(info)
            else:
                cross_module.append(info)
        else:
            other_to_module.append(info)

    print(f"\n--- Cross-Module Violations ({len(cross_module)}) ---")
    for v in cross_module:
        print(f"{v['file']}:{v['line']} -> {v['import']}")

    print(f"\n--- Same-Module Violations ({len(same_module)}) ---")
    for v in same_module:
        print(f"{v['file']}:{v['line']} -> {v['import']}")

    print(f"\n--- Other (e.g. root->module) Violations ({len(other_to_module)}) ---")
    for v in other_to_module:
        print(f"{v['file']}:{v['line']} -> {v['import']}")

except FileNotFoundError:
    print("eslint_report.json not found")
