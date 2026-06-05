class ValidationService:
    def validate_uri(self, value: str) -> bool:
        return value.startswith("repo:///")

