"""Exercise patched Connector methods with transport doubles, without an AstrBot install."""
import ast
import asyncio
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock

ROOT = Path(__file__).resolve().parents[1] / 'data/astrbot/plugins/astrbot_plugin_hapi_connector'


def method(file, class_name, name, **namespace):
    tree = ast.parse((ROOT / file).read_text())
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == class_name)
    fn = next(n for n in cls.body if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
    fn.decorator_list = []
    module = ast.fix_missing_locations(ast.Module(body=[fn], type_ignores=[]))
    exec(compile(module, str(ROOT / file), 'exec'), namespace)
    return namespace[name]


class ConnectorBehavior(unittest.IsolatedAsyncioTestCase):
    async def test_focus_requires_real_slack_mention_and_leaves_hapi_commands_alone(self):
        class At:
            def __init__(self, qq): self.qq = qq
        fn = method('main.py', 'HapiConnectorPlugin', '_focus_forward_text',
                    AstrMessageEvent=object, Comp=types.SimpleNamespace(At=At))
        plugin = types.SimpleNamespace(_cmd_keyword_maps=[], _original_text_has_wake_prefix=lambda e: False)
        event = Mock()
        event.get_platform_name.return_value = 'slack'
        event.is_private_chat.return_value = False
        event.get_self_id.return_value = 'BOT'
        event.message_obj.message_str = '普通聊天'
        event.get_messages.return_value = []
        self.assertIsNone(await fn(plugin, event, '普通聊天'))
        event.get_messages.return_value = [At('someone-else')]
        self.assertIsNone(await fn(plugin, event, '普通聊天'))
        event.get_messages.return_value = [At('BOT')]
        self.assertEqual(await fn(plugin, event, '检查项目'), '检查项目')
        self.assertIsNone(await fn(plugin, event, '/hapi s'))

    async def test_focus_reply_route_is_claimed_before_sending_in_each_window(self):
        core = types.ModuleType('banana.core')
        core.file_ops = types.SimpleNamespace(upload_event_files=AsyncMock(return_value=([], '')))
        sys.modules['banana.core'] = core
        route = {'owner': 'old-channel'}
        async def capture(sid, umo, flavor):
            route['owner'] = umo
        async def send(client, sid, text, attachments):
            self.assertEqual(route['owner'], expected_window)
            return True, 'sent'
        ops = types.SimpleNamespace(send_message=send)
        try:
            fn = method('main.py', 'HapiConnectorPlugin', 'quick_prefix_handler',
                        __package__='banana', AstrMessageEvent=object, session_ops=ops)
            state = types.SimpleNamespace(
                ensure_primary_session=AsyncMock(), effective_sid=lambda e: 'sid',
                effective_flavor=lambda e: 'codex', current_sid=lambda e: 'sid',
                capture_window=capture, set_user_state=AsyncMock())
            plugin = types.SimpleNamespace(
                notification_mgr=types.SimpleNamespace(_event_cache={}), _quick_prefix='>',
                _is_admin=lambda e: True, state_mgr=state,
                binding_mgr=types.SimpleNamespace(get_window_focus_mode=lambda umo: True),
                _focus_forward_text=AsyncMock(return_value='你好'),
                ensure_session_for_send=AsyncMock(return_value=(True, 'sid', '')),
                client=None, _peek_staged_attachments=lambda *a: [],
                _merge_attachment_lists=lambda *a: [], _last_sends={},
                config={'banana_compact_output': True})
            for expected_window in ('private-chat', 'channel', 'private-chat'):
                event = types.SimpleNamespace(unified_msg_origin=expected_window, message_str='你好',
                                              stop_event=Mock(), plain_result=lambda text: text)
                self.assertEqual([m async for m in fn(plugin, event)], [])
                event.stop_event.assert_called_once()
        finally:
            del sys.modules['banana.core']

    async def test_success_ack_is_hidden_but_failures_and_recovery_remain(self):
        ops = types.SimpleNamespace(send_message=AsyncMock(return_value=(True, '已发送 -> [id]')))
        fn = method('chat/command_handlers.py', 'CommandHandlers', 'cmd_send',
                    AstrMessageEvent=object, session_ops=ops)
        plugin = types.SimpleNamespace(config={'banana_compact_output': True},
                                      ensure_session_for_send=AsyncMock(return_value=(True, 'sid', '')),
                                      _last_sends={})
        handler = types.SimpleNamespace(plugin=plugin, _require_sid=lambda e: ('sid', ''),
                                        client=None, state_mgr=types.SimpleNamespace(set_user_state=AsyncMock(),
                                            capture_window=AsyncMock(), effective_flavor=lambda e: "codex"))
        event = types.SimpleNamespace(unified_msg_origin='channel', plain_result=lambda text: text)
        self.assertEqual([m async for m in fn(handler, event, 'test')], [])
        ops.send_message.return_value = (False, '发送失败: 401')
        self.assertEqual([m async for m in fn(handler, event, 'test')], ['发送失败: 401'])
        ops.send_message.return_value = (True, '已发送')
        plugin.ensure_session_for_send.return_value = (True, 'sid', '会话已恢复\n')
        self.assertIn('会话已恢复', [m async for m in fn(handler, event, 'test')][0])

    async def test_compact_reply_preserves_the_actual_agent_body(self):
        present = types.SimpleNamespace(build_message_payload=Mock(return_value={}), present_push=AsyncMock())
        fmt = types.SimpleNamespace(is_sdk_noise_text=lambda s: False, get_session_title=lambda s: 'title')
        render = types.ModuleType('banana.render')
        render.output_present, render.formatters = present, fmt
        sys.modules['banana.render'] = render
        try:
            fn = method('core/sse_listener.py', 'SSEListener', '_push_message_card',
                        __package__='banana.core', formatters=fmt, logger=Mock())
            plugin = types.SimpleNamespace(config={'banana_compact_output': True}, notification_mgr=object())
            listener = types.SimpleNamespace(plugin=plugin, sessions_cache=[], client=None,
                                            _push_notification=AsyncMock())
            body = '实际正文包含 /important/path\n[Message]: 这是用户需要的原文'
            await fn(listener, session_id='sid', label='💬 /private/path\n🏷️ sid', body=body,
                     fallback_text='HEADER\n[Message]: '+body)
            self.assertEqual(present.present_push.call_args.args[4], body)
            self.assertEqual(present.build_message_payload.call_args.kwargs['label'], '')
        finally:
            del sys.modules['banana.render']

    async def test_completion_does_not_repeat_a_delivered_reply(self):
        ops = types.SimpleNamespace(fetch_messages=AsyncMock(return_value=[{'seq': 10, 'content': {'role': 'user'}}]))
        fn = method('core/sse_listener.py', 'SSEListener', '_debounced_completion',
                    asyncio=types.SimpleNamespace(sleep=AsyncMock()), session_ops=ops,
                    session_label_short=lambda *args: 'FULL PATH AND ID', logger=Mock())
        listener = types.SimpleNamespace(
            plugin=types.SimpleNamespace(config={'banana_compact_output': True}),
            _completion_sids={'sid'}, _lock=asyncio.Lock(), pending={},
            session_states={'sid': {'thinking': False, 'lastSeq': 15}},
            agent_push_level_now=lambda: 'simple', _show_simple=AsyncMock(return_value=False),
            _completion_notified_seqs={}, _message_notified_seqs={'sid': 12},
            client=None, sessions_cache=[], _push_notification=AsyncMock())
        await fn(listener)
        listener._push_notification.assert_not_called()
        # A later turn with no visible reply still gets a short completion notice.
        ops.fetch_messages.return_value = [{'seq': 20, 'content': {'role': 'user'}}]
        listener._completion_sids = {'sid'}
        listener.session_states['sid']['lastSeq'] = 22
        await fn(listener)
        listener._push_notification.assert_awaited_once_with('✅ 已完成', 'sid')
        listener._push_notification.reset_mock()
        listener._completion_sids = {'sid'}
        listener.session_states['sid']['lastSeq'] = 25
        ops.fetch_messages.side_effect = TimeoutError('temporary outage')
        await fn(listener)
        listener._push_notification.assert_awaited_once_with('✅ 已完成', 'sid')


if __name__ == '__main__':
    unittest.main()
