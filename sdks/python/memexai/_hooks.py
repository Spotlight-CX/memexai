from typing import Callable, List, Dict, Any, Awaitable

HookFn = Callable[[str, Any, Dict[str, Any]], Awaitable[Any]]

class HookRegistry:
    def __init__(self):
        self._pre_hooks: List[HookFn] = []
        self._post_hooks: List[HookFn] = []

    def register_pre_hook(self, fn: HookFn) -> None:
        self._pre_hooks.append(fn)

    def register_post_hook(self, fn: HookFn) -> None:
        self._post_hooks.append(fn)

    async def run_pre_hooks(self, tool_name: str, args: Any, ctx_dict: Dict[str, Any]) -> Any:
        current_args = args
        for hook in self._pre_hooks:
            current_args = await hook(tool_name, current_args, ctx_dict)
        return current_args

    async def run_post_hooks(self, tool_name: str, result: Any, ctx_dict: Dict[str, Any]) -> Any:
        current_result = result
        for hook in self._post_hooks:
            current_result = await hook(tool_name, current_result, ctx_dict)
        return current_result
