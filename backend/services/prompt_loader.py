"""
Centralized prompt loader for all AI prompts.
All prompts live in backend/prompts/{category}/{name}.md files.
"""

import os
import functools
import logging

logger = logging.getLogger(__name__)

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'prompts')


@functools.lru_cache(maxsize=32)
def load_prompt(category: str, name: str) -> str:
    """Load a prompt from backend/prompts/{category}/{name}.md"""
    path = os.path.join(PROMPTS_DIR, category, f'{name}.md')
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def load_transform_prompt(group: str) -> str:
    """Load MBTI transform prompt: prompts/transform/{nt,nf,st,sf}.md"""
    return load_prompt('transform', group.lower())


def load_chatbot_prompt(group: str) -> str:
    """Load chatbot persona prompt: prompts/chatbot/{nt,nf,st,sf}.md"""
    return load_prompt('chatbot', group.lower())


def load_prompt_by_path(relative_path: str) -> str:
    """Load from arbitrary subpath: load_prompt_by_path('selection/article_scorer')"""
    path = os.path.join(PROMPTS_DIR, f'{relative_path}.md')
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()
