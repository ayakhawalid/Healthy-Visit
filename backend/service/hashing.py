import bcrypt


class Hash:
    @staticmethod
    def bcrypt(password: str) -> str:
        return bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")

    @staticmethod
    def verify(hashed: str, plain: str) -> bool:
        try:
            return bcrypt.checkpw(
                plain.encode("utf-8"),
                hashed.encode("utf-8"),
            )
        except Exception:
            return False
