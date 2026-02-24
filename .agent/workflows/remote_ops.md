---
description: How to safely execute commands on the remote Mac mini server (Deploy, Restart, DB Ops)
---

# Remote Operations Workflow

Use this workflow whenever you need to interact with the production server (`mini` / 192.168.x.x).

## 1. Context Check
Before running any command, identify if you are in a **First Request** situation.
- [ ] Read `docs/OPS.md` to refresh memory on current server status and paths.
- [ ] Read `docs/context.md` to verify infrastructure details.

## 2. The Golden Rule of SSH
⚠️ **CRITICAL**: Non-interactive SSH sessions DO NOT load the user profile (`.zshrc`, `.bash_profile`) by default.
You **MUST** wrap all critical commands (node, pm2, sqlite3) in a login shell wrapper.

**❌ Incorrect:**
```bash
ssh mini "pm2 restart longhorn"  # Fails: pm2 not found
```

**✅ Correct:**
```bash
ssh -t mini "/bin/zsh -l -c 'pm2 restart longhorn'"
```

## 3. Common Operations

### Restart Server
```bash
ssh -t mini "/bin/zsh -l -c 'pm2 reload longhorn'"
```

### Clean Database (Vocabulary)
```bash
ssh -t mini "/bin/zsh -l -c \"sqlite3 ~/Documents/server/Longhorn/server/longhorn.db 'DELETE FROM vocabulary WHERE ...'\""
```

### View Logs
```bash
ssh -t mini "/bin/zsh -l -c 'pm2 logs longhorn --lines 50'"
```

## 4. Verification
After executing a remote change, always verify the result:
1. Check Exit Code (should be 0).
2. If restarting, check `uptime` or PIDs.

```bash
ssh -t mini "/bin/zsh -l -c 'pm2 list'"
```