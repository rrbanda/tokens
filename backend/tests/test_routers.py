class TestHealthRouter:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_server_health_blocks_ssrf(self, client):
        resp = client.get("/api/health/server?url=http://localhost:8080")
        assert resp.status_code == 400

    def test_server_health_blocks_metadata(self, client):
        resp = client.get("/api/health/server?url=http://169.254.169.254/latest")
        assert resp.status_code == 400


class TestDiscoverRouter:
    def test_discover_blocks_private_ip(self, client):
        resp = client.post("/api/discover", json={"server_url": "http://10.0.0.1"})
        assert resp.status_code == 400

    def test_discover_valid_url(self, client, mock_connector):
        resp = client.post("/api/discover", json={"server_url": "https://llama.example.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["healthy"] is True
        assert len(data["models"]) == 1


class TestBenchmarkRouter:
    def test_benchmark_run(self, client, mock_connector):
        resp = client.post("/api/benchmark/run", json={
            "server_url": "https://llama.example.com",
            "model_id": "test-model",
            "instructions": "Be helpful",
            "temperature": 0.7,
            "max_infer_iters": None,
            "prompts": [{"input": "Hello", "tags": []}],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["model_id"] == "test-model"
        assert len(data["results"]) == 1
        assert data["results"][0]["usage"]["total_tokens"] == 15

    def test_benchmark_too_many_prompts(self, client):
        prompts = [{"input": f"Prompt {i}", "tags": []} for i in range(25)]
        resp = client.post("/api/benchmark/run", json={
            "server_url": "https://llama.example.com",
            "model_id": "test-model",
            "prompts": prompts,
        })
        assert resp.status_code == 422


class TestSkillsRouter:
    def test_list_skills(self, client):
        resp = client.get("/api/skills")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_skill(self, client):
        resp = client.get("/api/skills")
        skills = resp.json()
        if skills:
            name = skills[0]["name"]
            resp = client.get(f"/api/skills/{name}")
            assert resp.status_code == 200
            assert resp.json()["name"] == name

    def test_skill_not_found(self, client):
        resp = client.get("/api/skills/nonexistent-skill-xyz")
        assert resp.status_code == 404

    def test_path_traversal_blocked(self, client):
        resp = client.get("/api/skills/..%2F..%2Fetc")
        assert resp.status_code == 404
