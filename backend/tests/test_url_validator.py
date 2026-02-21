from app.utils.url_validator import validate_server_url


class TestValidateServerUrl:
    def test_valid_https(self):
        assert validate_server_url("https://llama-stack.example.com") is None

    def test_valid_http(self):
        assert validate_server_url("http://llama-stack.example.com") is None

    def test_blocks_localhost(self):
        assert validate_server_url("http://localhost:8080") is not None

    def test_blocks_127(self):
        assert validate_server_url("http://127.0.0.1:8080") is not None

    def test_blocks_private_10(self):
        assert validate_server_url("http://10.0.0.1") is not None

    def test_blocks_private_172(self):
        assert validate_server_url("http://172.16.0.1") is not None

    def test_blocks_private_192(self):
        assert validate_server_url("http://192.168.1.1") is not None

    def test_blocks_metadata_endpoint(self):
        assert validate_server_url("http://169.254.169.254/latest/meta-data/") is not None

    def test_blocks_ipv6_loopback(self):
        assert validate_server_url("http://[::1]:8080") is not None

    def test_blocks_ftp_scheme(self):
        result = validate_server_url("ftp://example.com")
        assert result is not None
        assert "Unsupported scheme" in result

    def test_blocks_no_scheme(self):
        result = validate_server_url("example.com")
        assert result is not None
