"""Run in a stopped AstrBot service via slack:profile; use its supported KV API."""
import asyncio
import json
import re
import sys
import urllib.request
from pathlib import Path


async def main():
    channel = sys.argv[1] if len(sys.argv) == 2 else ""
    if not re.fullmatch(r"[CG][A-Z0-9]+", channel):
        raise ValueError("Provide the Slack channel ID (C… or G…).")

    from astrbot.core import db_helper, sp
    plugin_id = "lijinhao999/astrbot_plugin_hapi_connector"

    async def get(key, default=None):
        return await sp.get_async("plugin", plugin_id, key, default)

    async def put(key, value):
        await sp.put_async("plugin", plugin_id, key, value)

    try:
        umo = f"banana-slack:GroupMessage:{channel}"
        key = f"window_state_{umo}"
        state = await get(key, {})
        sid = state.get("current_session")
        if not sid or state.get("current_flavor") != "codex":
            raise ValueError("Select a Codex session in this channel with /hapi sw first.")

        path = Path("/AstrBot/data/config/astrbot_plugin_hapi_connector_config.json")
        config = json.loads(path.read_text(encoding="utf-8-sig"))
        base = config["hapi_endpoint"].rstrip("/")
        request = urllib.request.Request(base + "/api/auth", data=json.dumps({
            "accessToken": config["access_token"],
        }).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=15) as response:
            token = json.load(response)["token"]
        request = urllib.request.Request(base + f"/api/sessions/{sid}", headers={
            "Authorization": "Bearer " + token,
        })
        with urllib.request.urlopen(request, timeout=15) as response:
            session = json.load(response)["session"]
        meta = session.get("metadata") or {}
        directory = meta.get("path")
        machine = meta.get("machineId")
        if not directory or not machine:
            raise ValueError("Current session has no workspace path or machine ID.")

        templates = await get("session_templates", [])
        templates = [t for t in templates if t.get("name") != "BananaHELPER"]
        templates.append({"name": "BananaHELPER", "machine_id": machine,
                          "directory": directory, "agent": "codex", "session_type": "simple",
                          "yolo": False, "model_reasoning_effort": ""})
        # Back up only the state this command changes, using the same private KV store.
        await put("banana_profile_backup", {
            "window": umo, "state": state,
            "templates": await get("session_templates", []),
        })
        await put("session_templates", templates)
        await put(key, {**state, "focus_mode": True})
        known = await get("known_windows", [])
        await put("known_windows", list(dict.fromkeys([*known, umo])))
        print("Focus enabled for the selected Slack channel; current session retained.")
        print("BananaHELPER template saved (Codex, existing workspace, YOLO off).")
    finally:
        await sp.close()
        await db_helper.engine.dispose()


asyncio.run(main())
