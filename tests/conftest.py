import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["BSP_DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ.pop("BSP_ANTHROPIC_API_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.guardrails.access import reset_rate_limits  # noqa: E402
from app.llm import set_provider  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    from app import models  # noqa: F401

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    reset_rate_limits()
    set_provider(None)
    yield
    set_provider(None)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def tokens(fresh_db):
    return seed()


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


def H(token: str) -> dict:
    return {"X-Member-Token": token}
