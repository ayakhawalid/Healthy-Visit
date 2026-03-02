"""
Reset the database to only have the admin user (admin / asd123).
Run from the backend directory: python reset_db_admin_only.py
"""
from database import conn
from models import Users
from service.hashing import Hash

def main():
    # Delete all users
    conn.execute(Users.delete())
    conn.commit()
    # Insert only admin (username=admin, password=asd123)
    conn.execute(
        Users.insert().values(
            username="admin",
            email="admin@example.com",
            is_superuser=True,
            password=Hash.bcrypt("asd123"),
        )
    )
    conn.commit()
    print("Database reset: only admin user remains (username: admin, password: asd123)")

if __name__ == "__main__":
    main()
