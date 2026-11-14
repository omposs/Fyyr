from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.auth import admin_router, router as auth_router
from app.api.public import admin_public_router, public_router
from app.api.routes import router
from app.config import get_settings
from app.db import init_db
from app.scheduler import Scheduler, build_default_jobs


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.scheduler = None
    s = get_settings()
    if s.scheduler_enabled:
        app.state.scheduler = Scheduler(build_default_jobs(s))
        app.state.scheduler.start()
    try:
        yield
    finally:
        if app.state.scheduler is not None:
            app.state.scheduler.stop()


app = FastAPI(title="Blue Science Park API", version="0.1.0", lifespan=lifespan)
# The token travels in a header, not a cookie, so credentials stay off: another site cannot ride on a
# logged-in browser session because there is none.
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(router)
app.include_router(public_router)
app.include_router(admin_public_router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")
