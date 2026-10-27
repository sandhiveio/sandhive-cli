# Client installation without project metadata writes

The first run needs Node.js 22+, a CLI checkout, readable skill instructions and a project profile. It does not need a project copy of the skill or a global package installation.

## Default agent flow

1. Reuse a current SandHive skill already loaded in the session.
2. Otherwise run `node <checkout>/bin/sandhive.js skill path --json` from the user's project. Read the returned `entrypoint` and its referenced files directly from the checkout. The command copies no files, registers nothing and makes no network request.
3. Run `doctor --json`, prepare `.sandhive/context.json` in the user's project, then complete the authorized draft workflow.

Keep the CLI checkout path separate from the project's working directory. Updating the checkout supplies updated bundled instructions; persistent installed copies do not update automatically. Loading instructions for the current task is different from registering a skill for automatic discovery in future sessions.

## Optional persistent registration

When the user specifically requests persistent registration, use the agent host's supported skill installer with its normal permission flow. Reuse an existing current installation instead of creating another copy. If a restart or a new turn is needed for discovery, explain that; an agent can read the bundled instructions to complete an already authorized task in the current session.

The CLI also retains an explicit project-copy command for environments where that installation is supported:

```sh
sandhive skill install --agent codex --target <project-directory>
# Or: --agent claude
```

This writes `.agents/skills/sandhive` or `.claude/skills/sandhive`. It refuses overwrite and does not know whether the host can subsequently protect the directory. It is not the default bootstrap path inside an agent sandbox. Do not change folder owners, ACLs or sandbox settings to make a copy succeed.

## Windows: `setup refresh had errors`

On one observed native Windows Codex installation, creating `.agents` from a sandbox process left it owned by `CodexSandboxOffline`. The following command could not start because sandbox refresh was denied `READ_CONTROL | WRITE_DAC` access while applying a deny ACL entry to that directory. The copy and `doctor` had succeeded within the previous shell process; the failure occurred before the next CLI invocation.

The default flow above avoids creating that directory. It does not repair an installation whose host permissions are already inconsistent. For an existing failure, use the host's supported sandbox recovery and collect its diagnostic log; do not automatically delete or modify `.agents`. See the official [Windows sandbox troubleshooting guide](https://learn.chatgpt.com/docs/windows/windows-sandbox).

Distinguish host process startup failures, host approval denials and SandHive HTTP/network errors. A successful local doctor does not prove that the next process or a live API call will succeed. Preserve known completed results and report what actually ran.
