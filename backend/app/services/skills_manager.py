import logging
import os
from pathlib import Path

import yaml

from app.models.schemas import SkillDetail, SkillInfo

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(os.environ.get("SKILLS_DIR", Path(__file__).parent.parent.parent.parent / "skills"))


def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from a markdown file. Returns (metadata, body)."""
    if not content.startswith("---"):
        return {}, content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content

    try:
        meta = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        meta = {}

    body = parts[2].strip()
    return meta, body


class SkillsManager:
    def __init__(self, skills_dir: Path | None = None):
        self.skills_dir = skills_dir or SKILLS_DIR

    def list_skills(self) -> list[SkillInfo]:
        skills: list[SkillInfo] = []
        if not self.skills_dir.exists():
            logger.warning("Skills directory not found: %s", self.skills_dir)
            return skills

        for skill_dir in sorted(self.skills_dir.iterdir()):
            skill_file = skill_dir / "SKILL.md"
            if skill_dir.is_dir() and skill_file.exists():
                content = skill_file.read_text(encoding="utf-8")
                meta, _ = _parse_frontmatter(content)
                skills.append(SkillInfo(
                    name=meta.get("name", skill_dir.name),
                    description=meta.get("description", ""),
                    path=str(skill_file),
                ))
        return skills

    def get_skill(self, name: str) -> SkillDetail | None:
        skill_file = (self.skills_dir / name / "SKILL.md").resolve()
        if not skill_file.is_relative_to(self.skills_dir.resolve()):
            logger.warning("Path traversal attempt blocked: %s", name)
            return None
        if not skill_file.exists():
            return None

        content = skill_file.read_text(encoding="utf-8")
        meta, body = _parse_frontmatter(content)
        return SkillDetail(
            name=meta.get("name", name),
            description=meta.get("description", ""),
            content=body,
            path=str(skill_file),
        )

    def load_all_skill_content(self) -> str:
        """Load all skills content concatenated, for use as analyzer context."""
        parts: list[str] = []
        for skill in self.list_skills():
            detail = self.get_skill(skill.name)
            if detail:
                parts.append(f"## Skill: {detail.name}\n\n{detail.content}")
        return "\n\n---\n\n".join(parts)


_manager: SkillsManager | None = None


def get_skills_manager() -> SkillsManager:
    global _manager
    if _manager is None:
        _manager = SkillsManager()
    return _manager
