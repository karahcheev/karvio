from sqlalchemy import select

from app.core.security import hash_password
from app.modules.projects.models import User


async def test_delete_user_removes_user_from_database(client, admin_headers, db_session):
    target = User(
        id="user_to_delete_1",
        username="doomed",
        password_hash=hash_password("password123"),
    )
    db_session.add(target)
    await db_session.commit()

    response = await client.delete(f"/api/v1/users/{target.id}", headers=admin_headers)
    assert response.status_code == 204

    db_session.expire_all()
    result = await db_session.execute(select(User).where(User.id == target.id))
    assert result.scalar_one_or_none() is None

    get_response = await client.get(f"/api/v1/users/{target.id}", headers=admin_headers)
    assert get_response.status_code == 404
