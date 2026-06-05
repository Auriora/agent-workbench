from sample_service.repository_resolver import RepositoryResolver


def test_resolve_repository() -> None:
    assert RepositoryResolver().resolve_repository("/repo") == "/repo"
