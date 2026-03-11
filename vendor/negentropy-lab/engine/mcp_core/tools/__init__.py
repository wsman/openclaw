from importlib import import_module

__all__ = []


def _safe_export(module_name: str, symbols: list[str]) -> None:
    try:
        module = import_module(f"{__name__}.{module_name}")
    except Exception:
        return

    for symbol in symbols:
        if hasattr(module, symbol):
            globals()[symbol] = getattr(module, symbol)
            __all__.append(symbol)


_safe_export("architecture_sync", ["auto_update_architecture"])
_safe_export(
    "codex_navigator",
    [
        "get_codex_structure",
        "get_codex_section",
        "verify_codex_references",
        "search_codex",
        "analyze_codex_entropy",
    ],
)
_safe_export(
    "hybrid_retrieval",
    [
        "hybrid_search_codex",
        "get_hybrid_search_stats",
        "benchmark_hybrid_search",
    ],
)
