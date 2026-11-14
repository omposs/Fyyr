from conftest import H


def test_preflight_allows_listed_origin_and_token_header(client):
    r = client.options("/me", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET",
                                       "Access-Control-Request-Headers": "x-member-token"})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "x-member-token" in r.headers["access-control-allow-headers"].lower()
    assert "access-control-allow-credentials" not in r.headers


def test_unlisted_origin_gets_no_cors_headers(client):
    r = client.options("/me", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers
    r = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_actual_request_from_allowed_origin_carries_cors_header(client, tokens):
    r = client.get("/me", headers={**H(tokens["Nautilab AB"]), "Origin": "http://localhost:3000"})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_auth_still_enforced(client, tokens):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers=H("wrong")).status_code == 401
    assert client.get("/me", headers=H(tokens["Nautilab AB"])).status_code == 200


def test_docs_expose_authorize_scheme(client):
    schemes = client.get("/openapi.json").json()["components"]["securitySchemes"]
    assert any(s.get("type") == "apiKey" and s.get("name") == "X-Member-Token" and s.get("in") == "header"
               for s in schemes.values())
