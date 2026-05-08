from sample_pkg import Runner


def test_runner() -> None:
    assert Runner().run() == "ok"
