#!/usr/bin/env python3
"""Minimal structure guard for the Zerynex portable Agent Skill."""
from pathlib import Path
import re

skill = Path(__file__).resolve().parents[1] / "agent" / "skills" / "zcash-privacy-check" / "SKILL.md"
contents = skill.read_text(encoding="utf-8")
assert contents.startswith("---\n"), "Agent Skill YAML frontmatter missing"
end = contents.find("\n---\n", 4)
assert end > 4, "Agent Skill YAML frontmatter not terminated"
header = contents[4:end]
assert re.search(r"(?m)^name: zcash-privacy-check$", header)
description = re.search(r"(?m)^description: (.+)$", header)
assert description and 1 <= len(description.group(1)) <= 1024
assert (skill.parent / "references" / "policies.md").is_file()
assert "Never request" in contents
print("Agent Skill structure and privacy boundary verified.")
