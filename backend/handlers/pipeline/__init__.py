"""
Article transformation pipeline — Step Functions 4-step architecture.

Step 1 (select)    → Rule + Nova filtering, article selection
Step 2 (classify)  → Nova MBTI classification, category allocation
Step 3 (transform) → Claude 4-version rewriting using /prompts/*.md
Step 4 (validate)  → Nova/Claude quality checks, flagging

Each step is a standalone Lambda handler that receives the previous step's
output and produces structured output for the next step.
"""
