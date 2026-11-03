# Installation identity

## Installation identity

The CLI computes `shf1_<sha256>` in memory from existing OS information: hostname, home-directory path, platform and architecture, with a SandHive-specific namespace. No identity files, hardware probes or subprocesses are used. The raw inputs are not sent. The fingerprint is stable across projects and CLI updates while those inputs remain the same. Changing the host/profile can change it; cloned environments with identical inputs can share it. It is an approximate profile identifier, not proof of a unique physical installation or an anonymous identity.

Every SandHive API request includes `X-SandHive-Installation-Id: shf1_<sha256>`. JSON bodies are unchanged. Previews show the header without a network request. It is not sent to GitHub update checks or other API origins. Old `installation.json` files and `SANDHIVE_HOME` are no longer read or written; upgrading changes the former UUID to this fingerprint. This removes the identity-file permission requirement; host network permissions still apply. The ID is not an authentication token or an idempotency key.

