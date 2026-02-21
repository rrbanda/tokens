from app.services.analyzer import _extract_json


class TestExtractJson:
    def test_plain_json(self):
        text = '{"key": "value"}'
        assert _extract_json(text) == {"key": "value"}

    def test_json_in_markdown_fence(self):
        text = '```json\n{"key": "value"}\n```'
        assert _extract_json(text) == {"key": "value"}

    def test_json_in_plain_fence(self):
        text = '```\n{"key": "value"}\n```'
        assert _extract_json(text) == {"key": "value"}

    def test_json_with_surrounding_text(self):
        text = 'Here is the result:\n{"suggestions": []}\nEnd.'
        result = _extract_json(text)
        assert result == {"suggestions": []}

    def test_trailing_comma(self):
        text = '{"items": [1, 2, 3,]}'
        result = _extract_json(text)
        assert result == {"items": [1, 2, 3]}

    def test_garbage_input(self):
        assert _extract_json("no json here at all") is None

    def test_empty_string(self):
        assert _extract_json("") is None

    def test_nested_json(self):
        text = '{"outer": {"inner": "value"}}'
        result = _extract_json(text)
        assert result == {"outer": {"inner": "value"}}

    def test_incomplete_json_auto_close(self):
        text = '{"key": "value"'
        result = _extract_json(text)
        assert result is not None
        assert result["key"] == "value"
