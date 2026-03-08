#!/usr/bin/env python3
"""
Auto-Fix script.js - Apply all 5 fixes automatically
Usage: python3 auto_fix.py script.js
"""

import sys
import re

def apply_all_fixes(content):
    """Apply all 5 fixes to the script content"""
    
    # FIX 1: createDefaultPlan - replace dreams: [] with full structure
    content = re.sub(
        r"(function createDefaultPlan\(\) \{[\s\S]*?investments: \[\],)\s*dreams: \[\],",
        r"""\1
        withdrawals: [],
        profile: {
            maritalStatus: 'married',
            user: { name: '', age: null, gender: 'male' },
            spouse: { name: '', age: null, gender: 'female' },
            children: []
        },
        goals: {
            retirement: {
                userAge: null,
                spouseAge: null,
                monthlyPension: null,
                isRealValue: true
            },
            equity: {
                targetAmount: null,
                targetYear: null,
                isRealValue: true
            },
            lifeGoals: []
        },""",
        content
    )
    
    # FIX 2: getCurrentPlan - add structure validation
    content = re.sub(
        r"function getCurrentPlan\(\) \{\s*return appData\.plans\.find\(p => p\.id === appData\.currentPlanId\) \|\| appData\.plans\[0\];\s*\}",
        """function getCurrentPlan() {
    const plan = appData.plans.find(p => p.id === appData.currentPlanId) || appData.plans[0];
    
    // Ensure plan has profile and goals
    if (!plan.profile) {
        plan.profile = {
            maritalStatus: 'married',
            user: { name: '', age: null, gender: 'male' },
            spouse: { name: '', age: null, gender: 'female' },
            children: []
        };
    }
    if (!plan.goals) {
        plan.goals = {
            retirement: {
                userAge: null,
                spouseAge: null,
                monthlyPension: null,
                isRealValue: true
            },
            equity: {
                targetAmount: null,
                targetYear: null,
                isRealValue: true
            },
            lifeGoals: []
        };
    }
    if (!plan.withdrawals) {
        plan.withdrawals = [];
    }
    
    return plan;
}""",
        content
    )
    
    # FIX 3: showPlanManager - remove dreams.length
    content = re.sub(
        r'\$\{p\.investments\.length\} מסלולים, \$\{p\.dreams\.length\} חלומות',
        r'${p.investments.length} מסלולים',
        content
    )
    
    # FIX 4: createNewPlan - replace dreams: [] with full structure
    content = re.sub(
        r"(function createNewPlan\(\) \{[\s\S]*?investments: \[\],)\s*dreams: \[\],",
        r"""\1
        withdrawals: [],
        profile: {
            maritalStatus: 'married',
            user: { name: '', age: null, gender: 'male' },
            spouse: { name: '', age: null, gender: 'female' },
            children: []
        },
        goals: {
            retirement: {
                userAge: null,
                spouseAge: null,
                monthlyPension: null,
                isRealValue: true
            },
            equity: {
                targetAmount: null,
                targetYear: null,
                isRealValue: true
            },
            lifeGoals: []
        },""",
        content
    )
    
    # FIX 5: exportToExcel - use plan.profile and plan.goals
    content = re.sub(
        r"(function exportToExcel\(\) \{\s*const plan = getCurrentPlan\(\);)\s*const profile = appData\.profile;\s*const goals = appData\.goals;",
        r"\1\n    const profile = plan.profile;\n    const goals = plan.goals;",
        content
    )
    
    # FIX 6: All profile/goals functions - use plan instead of appData
    replacements = [
        # loadProfile
        (r"function loadProfile\(\) \{\s*const profile = appData\.profile;",
         "function loadProfile() {\n    const plan = getCurrentPlan();\n    const profile = plan.profile;"),
        
        # saveProfile
        (r"function saveProfile\(\) \{\s*const profile = appData\.profile;",
         "function saveProfile() {\n    const plan = getCurrentPlan();\n    const profile = plan.profile;"),
        
        # loadGoals
        (r"function loadGoals\(\) \{\s*const goals = appData\.goals;\s*const profile = appData\.profile;",
         "function loadGoals() {\n    const plan = getCurrentPlan();\n    const goals = plan.goals;\n    const profile = plan.profile;"),
        
        # saveGoals
        (r"function saveGoals\(\) \{\s*const goals = appData\.goals;",
         "function saveGoals() {\n    const plan = getCurrentPlan();\n    const goals = plan.goals;"),
        
        # addLifeGoal
        (r"appData\.goals\.lifeGoals\.push\(goal\);",
         "const plan = getCurrentPlan();\n    plan.goals.lifeGoals.push(goal);"),
        
        # removeLifeGoal
        (r"appData\.goals\.lifeGoals\.splice\(index, 1\);",
         "const plan = getCurrentPlan();\n    plan.goals.lifeGoals.splice(index, 1);"),
        
        # renderLifeGoals
        (r"(function renderLifeGoals\(\) \{[\s\S]*?const container[\s\S]*?if \(!container\) return;)\s*const goals = appData\.goals\.lifeGoals;",
         r"\1\n    const plan = getCurrentPlan();\n    const goals = plan.goals.lifeGoals;"),
        
        # addChild
        (r"appData\.profile\.children\.push\(child\);",
         "const plan = getCurrentPlan();\n    plan.profile.children.push(child);"),
        
        # removeChild
        (r"appData\.profile\.children\.splice\(index, 1\);",
         "const plan = getCurrentPlan();\n    plan.profile.children.splice(index, 1);"),
        
        # renderChildren
        (r"(function renderChildren\(\) \{[\s\S]*?const container[\s\S]*?if \(!container\) return;)\s*const children = appData\.profile\.children;",
         r"\1\n    const plan = getCurrentPlan();\n    const children = plan.profile.children;"),
        
        # updateMaritalStatus
        (r"(function updateMaritalStatus\(\) \{\s*const status[\s\S]*?\.value;)\s*appData\.profile\.maritalStatus = status;",
         r"\1\n    const plan = getCurrentPlan();\n    plan.profile.maritalStatus = status;"),
    ]
    
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
    
    return content

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python3 auto_fix.py script.js")
        sys.exit(1)
    
    filename = sys.argv[1]
    
    print(f"Reading {filename}...")
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("Applying all 5 fixes...")
    fixed_content = apply_all_fixes(content)
    
    output_file = filename.replace('.js', '_FIXED.js')
    print(f"Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"✅ Done! Fixed file saved as: {output_file}")
    print("\nFixes applied:")
    print("  1. ✅ createDefaultPlan - added profile, goals, withdrawals")
    print("  2. ✅ getCurrentPlan - ensures plan structure exists")
    print("  3. ✅ showPlanManager - removed dreams reference")
    print("  4. ✅ createNewPlan - added profile, goals, withdrawals")
    print("  5. ✅ exportToExcel - uses plan.profile and plan.goals")
    print("  6. ✅ All profile/goals functions - use plan instead of appData")
