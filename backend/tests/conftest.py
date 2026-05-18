from collections.abc import AsyncGenerator, Iterator
from contextlib import asynccontextmanager

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport
from procrastinate.testing import InMemoryConnector
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

import app.models  # noqa: F401  populate Base.metadata with all mapped tables
from app.api.dependencies.storage import get_attachment_storage
from app.core.queue import queue_app
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db, run_after_commit_callbacks
from app.main import app
from app.models.enums import UserRole
from app.modules.attachments.adapters.storage import LocalAttachmentStorage
from app.modules.projects.models import User


def _to_async_url(url: str) -> str:
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+psycopg_async://", 1)
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql+psycopg_async://", 1)
    if url.startswith("postgresql://"):
        return "postgresql+psycopg_async://" + url.removeprefix("postgresql://")
    return url


@pytest.fixture(scope="session")
def _postgres_url() -> Iterator[str]:
    container = PostgresContainer("postgres:16-alpine", driver="psycopg")
    container.start()
    try:
        sync_url = container.get_connection_url()
        sync_engine = create_engine(sync_url, future=True)
        Base.metadata.create_all(sync_engine)
        sync_engine.dispose()
        yield sync_url
    finally:
        container.stop()


@pytest_asyncio.fixture(autouse=True)
async def _in_memory_queue() -> AsyncGenerator[InMemoryConnector, None]:
    connector = InMemoryConnector()
    with queue_app.replace_connector(connector):
        yield connector


@pytest_asyncio.fixture
async def db_session(_postgres_url: str) -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(_to_async_url(_postgres_url), future=True)
    try:
        async with engine.connect() as connection:
            outer_transaction = await connection.begin()
            factory = async_sessionmaker(
                bind=connection,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
                autocommit=False,
                join_transaction_mode="create_savepoint",
            )
            session = factory()
            try:
                yield session
            finally:
                await session.close()
                await outer_transaction.rollback()
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, tmp_path) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        try:
            yield db_session
            await db_session.commit()
            await run_after_commit_callbacks(db_session)
        except Exception:
            await db_session.rollback()
            raise

    @asynccontextmanager
    async def empty_lifespan(_):
        yield

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_attachment_storage] = lambda: LocalAttachmentStorage(str(tmp_path))
    original_lifespan = app.router.lifespan_context
    app.router.lifespan_context = empty_lifespan
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.router.lifespan_context = original_lifespan
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_user(db_session: AsyncSession) -> User:
    user = User(id="user_auth_1", username="auth_user", password_hash=hash_password("password123"))
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def auth_headers(auth_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(auth_user.id)}"}


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(id="user_admin_1", username="admin", password_hash=hash_password("password123"), role=UserRole.admin)
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def admin_headers(admin_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(admin_user.id)}"}
