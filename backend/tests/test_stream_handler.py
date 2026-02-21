import pytest

from app.services.stream_handler import (
    extract_text_delta_from_chat_chunk,
    extract_text_delta_from_responses_event,
    extract_usage_from_chat_chunk,
    extract_usage_from_responses_event,
    parse_sse_lines,
)


class TestExtractUsageFromResponsesEvent:
    def test_completed_event(self):
        event = {"type": "response.completed", "response": {"usage": {"input_tokens": 10, "output_tokens": 5}}}
        assert extract_usage_from_responses_event(event) == {"input_tokens": 10, "output_tokens": 5}

    def test_non_completed_event(self):
        assert extract_usage_from_responses_event({"type": "response.output_text.delta"}) is None

    def test_empty_event(self):
        assert extract_usage_from_responses_event({}) is None


class TestExtractTextDeltaFromResponsesEvent:
    def test_delta_event(self):
        event = {"type": "response.output_text.delta", "delta": "hello"}
        assert extract_text_delta_from_responses_event(event) == "hello"

    def test_wrong_type(self):
        assert extract_text_delta_from_responses_event({"type": "other"}) is None


class TestExtractUsageFromChatChunk:
    def test_with_usage(self):
        chunk = {"usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}}
        result = extract_usage_from_chat_chunk(chunk)
        assert result == {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}

    def test_no_usage(self):
        assert extract_usage_from_chat_chunk({"choices": []}) is None


class TestExtractTextDeltaFromChatChunk:
    def test_with_content(self):
        chunk = {"choices": [{"delta": {"content": "world"}}]}
        assert extract_text_delta_from_chat_chunk(chunk) == "world"

    def test_no_choices(self):
        assert extract_text_delta_from_chat_chunk({"choices": []}) is None


class TestParseSSELines:
    @pytest.mark.asyncio
    async def test_parse_data_lines(self):
        async def lines():
            yield 'data: {"type": "delta"}'
            yield ""
            yield 'data: [DONE]'

        events = []
        async for event in parse_sse_lines(lines()):
            events.append(event)

        assert len(events) == 2
        assert events[0] == {"type": "delta"}
        assert events[1] == {"type": "__done__"}

    @pytest.mark.asyncio
    async def test_skip_comments_and_empty(self):
        async def lines():
            yield ": comment"
            yield ""
            yield 'data: {"ok": true}'

        events = []
        async for event in parse_sse_lines(lines()):
            events.append(event)

        assert len(events) == 1
        assert events[0] == {"ok": True}

    @pytest.mark.asyncio
    async def test_skip_invalid_json(self):
        async def lines():
            yield "data: not-json"
            yield 'data: {"valid": true}'

        events = []
        async for event in parse_sse_lines(lines()):
            events.append(event)

        assert len(events) == 1
        assert events[0] == {"valid": True}
