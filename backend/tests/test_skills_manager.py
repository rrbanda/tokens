from pathlib import Path

from app.services.skills_manager import SkillsManager, _parse_frontmatter


class TestParseFrontmatter:
    def test_with_frontmatter(self):
        content = "---\nname: test\ndescription: desc\n---\nBody content"
        meta, body = _parse_frontmatter(content)
        assert meta["name"] == "test"
        assert meta["description"] == "desc"
        assert body == "Body content"

    def test_without_frontmatter(self):
        content = "Just plain content"
        meta, body = _parse_frontmatter(content)
        assert meta == {}
        assert body == "Just plain content"

    def test_invalid_yaml(self):
        content = "---\n: [invalid\n---\nBody"
        meta, body = _parse_frontmatter(content)
        assert meta == {}
        assert body == "Body"


class TestSkillsManagerPathTraversal:
    def test_traversal_blocked(self, tmp_path: Path):
        skills_dir = tmp_path / "skills"
        skills_dir.mkdir()
        outside = tmp_path / "outside"
        outside.mkdir()
        (outside / "SKILL.md").write_text("---\nname: evil\n---\nEvil content")

        manager = SkillsManager(skills_dir=skills_dir)
        result = manager.get_skill("../../outside")
        assert result is None

    def test_valid_skill(self, tmp_path: Path):
        skills_dir = tmp_path / "skills"
        skill_dir = skills_dir / "my-skill"
        skill_dir.mkdir(parents=True)
        (skill_dir / "SKILL.md").write_text("---\nname: My Skill\ndescription: test\n---\nContent here")

        manager = SkillsManager(skills_dir=skills_dir)
        result = manager.get_skill("my-skill")
        assert result is not None
        assert result.name == "My Skill"
        assert result.content == "Content here"
